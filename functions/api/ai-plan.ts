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
const DEVELOPER_PROMPT = `당신은 한국 시장 전문의 통합 광고·콘텐츠 기획자입니다. 검색광고·소셜·SNS·유튜브를 "하나의 수요경로"로 설계합니다: 검색은 이미 표현된 수요를 포착하고, 소셜은 잠재 수요를 형성하며, 콘텐츠는 인지·신뢰·전환을 잇습니다. 채널별 최적화보다 먼저 '검색의도 → 크리에이티브 약속 → 랜딩 일치 → 확산 구조'를 설계합니다.

[작성 원칙]
- 가이드라인에 명시된 채널만 작성한다(예: 블로그만 있으면 블로그만). 없는 채널은 만들지 않는다.
- 업체명·가이드라인을 면밀히 검토해 업종·타깃·톤앤매너·금지표현(특히 의료법 등 규제)을 반영한다. 금지표현은 절대 쓰지 않는다.
- 검색량 순 단순 나열을 지양한다. 관련성·의도강도(거래형>상업조사형>정보형)·전환가치·랜딩 적합도·경쟁비용을 함께 본 "황금 키워드" 관점으로 우선순위를 잡는다.
- 핵심만 간결하게. 추천 이유는 한두 줄로. 표·불릿으로 가독성 있게. 과장·허위·불필요하게 긴 서술 금지.

[채널별 산출물]
1) 블로그/검색
   - 키워드를 의도(정보형/상업조사형/거래형)와 유형(헤드·롱테일·브랜드·문제해결·비교·트렌드)으로 구분해 사고한다.
   - 업체 맞춤 "메인 키워드" 20개, "롱테일 키워드" 20개를 추천하고, 각 키워드 옆에 의도/유형을 짧게 표기한다(예: 거래형·롱테일).
   - 거래형·상업조사형·문제해결·브랜드(방어) 키워드를 우선한다. 발행 캘린더(날짜별 키워드 배치)를 제안한다.

2) 네이버 카페/여론
   - 업체가 어울리는 카페 성격(맘카페·직장인·지역·취미·웨딩 등)을 판단하고 추천 카페 유형과 이유를 제시한다.
   - 자연 확산 5조건(공유 이유 명확 / 한 문장 설명 가능 / 따라하기 쉬움 / 정체성 표현 / 논란 통제)과 고각성 감정, 커뮤니티 밀도(허브가 만능이 아님)를 고려한다.
   - 자연스러운 글·댓글 예시를 유형별로 여러 개(정보형·후기형·질문형) 제시하고, 의미 오독·논란 리스크를 한 줄로 점검한다.

3) SNS(디자인 방향성)
   - 정보전달형 vs 트렌드/밈형 중 업체에 맞는 방향을 정하고 이유를 밝힌다.
   - 톤앤매너를 반영한 비주얼·카피 방향을 제시한다. 썸네일/첫 컷은 "명시적·인물 중심·핵심 요소 3개 이하"로, 썸네일·제목의 약속과 실제 내용이 일치하도록 설계한다.

4) 유튜브
   - 인터뷰형/기획형/홍보형/광고형 중 적합한 유형을 고르고 이유를 밝힌다.
   - 제목은 검색형(문제+해결+조건) 또는 추천형(의외성+구체성+대상)으로 제안한다.
   - 스토리보드는 시간 분절로: 0~3초 훅(결과 먼저) / 3~15초 약속 명확화 / 15~45초 증거 / 45~90초 보상 / 종료 직전 CTA 1개. CTA는 보상 직후 하나만.
   - 인터뷰형은 타임라인 대신 '질문 흐름 중심의 간단한 대본'으로 요약한다(너무 길지 않게).

[측정 한 줄] 가능하면 각 채널에 1차 KPI·가드레일과 A/B 테스트 포인트를 한 줄씩 덧붙인다(예: CTR은 높지만 랜딩 품질이 나쁘면 보류 / 저장·공유, 전환·CPA 등).

[형식] 한국어. 채널별 섹션을 "## 제목"으로 구분. 표·불릿 활용. 전체는 핵심 위주로 너무 길지 않게.`;

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
        reasoning: { effort: 'low' }, // 속도 우선(추론 단계 축소). 품질 더 원하면 'medium'
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
