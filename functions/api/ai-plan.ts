// ───────────────────────────────────────────────────────────────
// Cloudflare Pages Function:  POST /api/ai-plan
//  • "AI 기획 어시스턴트" 화면이 호출한다.
//  • OpenAI Responses API (/v1/responses) 로 광고 기획 리포트를 생성한다.
//    - 추론(reasoning) 사용. 웹 검색은 속도 때문에 기본 비활성화
//      (필요 시 아래 tools 줄 주석 해제).
//    - 출력은 자유형 텍스트(마크다운) 리포트.
//
// 환경변수 (Cloudflare Pages → Settings → Environment variables):
//  • OPENAI_API_KEY  (필수, Secret)
//  • OPENAI_MODEL    (선택, 기본 gpt-5.5)
//
// ⚠️ 키에 VITE_ 접두사를 붙이지 말 것 — 브라우저 번들에 노출됩니다.
// ───────────────────────────────────────────────────────────────

interface Env {
  OPENAI_API_KEY: string;
  OPENAI_MODEL?: string;
}

interface PlanRequest {
  clientName?: string;
  industry?: string;
  period?: { start?: string; end?: string };
  campaignType?: string;
  goal?: string;
  guideline?: string; // 업로드한 가이드라인 파일 텍스트(앞부분)
}

// 광고 기획 전문가 지시문 (developer 메시지)
const DEVELOPER_PROMPT = `당신은 광고 기획 전문가 입니다.

다음 가이드라인이 담긴 파일을 읽고 기획 보고서를 작성해주세요.
기획 보고서에는 다음을 포함해주세요.

1. 블로그의 경우 키워드를 작성해주세요. 업체를 꼼꼼히 검토한 후 "메인키워드"와 "롱테일키워드"를 20개씩 추천해주세요. 그리고 당신이 추천하는 날짜별 키워드 조합도 알려주세요.

2. 카페의 경우 여론 작업을 어떻게 진행할지 기획해주세요. 예를 들어 업체가 맘카페에 잘 어울릴지, 공부 카페에 잘 어울릴지, 웨딩 카페에 잘 어울릴지 등 파악한 후 네이버 카페의 대해 추천해주시길 바랍니다. 특히 어떻게 자연스럽게 글과 댓글을 작성할지도 여러개 추천해주시길 바랍니다.

3. SNS의 경우 디자인의 느낌을 추천해주세요. 각 카테고리 마다 정보 전달형이 있을 수 있고 최근 밈이나 트렌드를 따라가야 될 경우도 있습니다. 업체명과 가이드라인을 검토하여 어울리는 방향성을 잡아주고 그에 대해 자세한 기획을 만들어주세요.

4. 유튜브의 경우 인터뷰형, 기획형, 홍보형, 광고형에 따라서 기획을 달리해주셔야 됩니다. 특히나 인터뷰형은 대본이 필요합니다. 기업의 대한 정보와 조회수가 잘 나오는 관련 업체의 유튜브 정보를 가져와서 기획 및 대본의 대해 흐름을 잡아주시길 바랍니다. 타임라인까지 하면 너무 길어지니 너무 길어지지 않도록 잘 요약해주세요.

꼭 가이드에 있는 마케팅만 작성해주시길 바랍니다. 예를 들어 마케팅이 블로그만 있을 경우 1번만 해주시면 됩니다. 너무 길어지지 않도록 해주시고 핵심만 잘 짚어주시길 바랍니다. 그리고 추천하는 이유도 간략하게 적어주시길 바라며, 업체명의 경우 검색하여 자세히 검토 후 리포트를 내주시길 바랍니다.`;

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

// Responses API 응답에서 최종 텍스트를 추출
function extractText(data: any): string {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text;
  const out = Array.isArray(data?.output) ? data.output : [];
  const parts: string[] = [];
  for (const item of out) {
    if (item?.type === 'message' && Array.isArray(item.content)) {
      for (const c of item.content) {
        if ((c?.type === 'output_text' || c?.type === 'text') && typeof c.text === 'string') {
          parts.push(c.text);
        }
      }
    }
  }
  return parts.join('\n').trim();
}

export const onRequestPost = async (context: { request: Request; env: Env }): Promise<Response> => {
  const { request, env } = context;

  if (!env.OPENAI_API_KEY) {
    return json({ error: 'OPENAI_API_KEY 가 설정되지 않았습니다. Cloudflare Pages 환경변수를 확인하세요.' }, 500);
  }

  let req: PlanRequest;
  try {
    req = await request.json();
  } catch {
    return json({ error: '잘못된 요청 본문입니다.' }, 400);
  }

  const period = req.period ?? {};
  const userText = [
    '아래는 기획 보고서를 작성할 업체/캠페인 정보와 업로드된 가이드라인입니다.',
    '',
    `업체명: ${req.clientName ?? '(미지정)'}`,
    `업종: ${req.industry ?? '(미지정)'}`,
    `캠페인 기간: ${period.start ?? '?'} ~ ${period.end ?? '?'}`,
    `캠페인 유형: ${req.campaignType ?? '(미지정)'}`,
    `캠페인 목표: ${req.goal || '(별도 명시 없음)'}`,
    '',
    '── 업로드한 가이드라인 내용 ──',
    (req.guideline || '(가이드라인 텍스트 없음)').slice(0, 12000),
  ].join('\n');

  let aiRes: Response;
  try {
    aiRes = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL || 'gpt-5.5',
        input: [
          { role: 'developer', content: [{ type: 'input_text', text: DEVELOPER_PROMPT }] },
          { role: 'user', content: [{ type: 'input_text', text: userText }] },
        ],
        text: { format: { type: 'text' }, verbosity: 'medium' },
        reasoning: { effort: 'medium', summary: 'auto' },
        // 웹 검색 비활성화(속도 우선). 필요 시 아래 줄 주석 해제:
        // tools: [{ type: 'web_search' }],
        store: true,
      }),
    });
  } catch (e) {
    return json({ error: `OpenAI 요청 실패: ${e instanceof Error ? e.message : '네트워크 오류'}` }, 502);
  }

  if (!aiRes.ok) {
    const detail = await aiRes.text();
    return json({ error: `OpenAI 오류 (${aiRes.status})`, detail: detail.slice(0, 800) }, 502);
  }

  const data = await aiRes.json();
  const report = extractText(data);
  if (!report) return json({ error: 'OpenAI 응답에서 리포트 텍스트를 찾지 못했습니다.' }, 502);

  return json({ report });
};
