// ───────────────────────────────────────────────────────────────
// Cloudflare Pages Function:  POST /api/ai-plan
//  • 기존 "AI 기획 어시스턴트" 화면이 호출한다.
//  • OpenAI Chat Completions(JSON 모드)로 월간 콘텐츠 플랜을 생성한다.
//
// 환경변수 (Cloudflare Pages → Settings → Environment variables 에 등록):
//  • OPENAI_API_KEY  (필수, Secret)   — sk-... 키
//  • OPENAI_MODEL    (선택)           — 기본값 gpt-4o-mini
//
// ⚠️ 키는 절대 VITE_ 접두사를 붙이지 말 것 — 그러면 브라우저 번들에 노출됩니다.
//    이 함수는 서버(엣지)에서만 실행되므로 키가 클라이언트로 나가지 않습니다.
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

// 앱이 사용하는 카테고리(이 값들만 사용하도록 모델에 강제)
const CATEGORIES = ['SNS', '유튜브', '네이버', '영상제작', '디자인제작', '네이버 여론작업', '기타'];

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

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
  const system = [
    '당신은 한국의 SNS·디지털 마케팅 대행사의 전문 콘텐츠 기획자입니다.',
    '주어진 클라이언트 정보와 가이드라인을 바탕으로 실행 가능한 주간 단위 콘텐츠 플랜을 한국어로 작성하세요.',
    '반드시 아래 JSON 스키마로만 응답합니다(설명 문장 금지):',
    '{',
    '  "weeks": [',
    '    { "week": "1주차", "date": "MM.DD ~ MM.DD",',
    '      "tasks": [ { "category": <카테고리>, "content": "구체적 실행 내용", "status": "예정" } ] }',
    '  ],',
    '  "memo": "전략 요약 및 추천 메모"',
    '}',
    `"category" 는 반드시 다음 중 하나여야 합니다: ${CATEGORIES.join(', ')}.`,
    '각 주차마다 2~4개의 task 를 제안하고, 기간 전체를 주 단위로 빠짐없이 나누세요.',
  ].join('\n');

  const user = [
    `클라이언트: ${req.clientName ?? '(미지정)'}`,
    `업종: ${req.industry ?? '(미지정)'}`,
    `캠페인 기간: ${period.start ?? '?'} ~ ${period.end ?? '?'}`,
    `캠페인 유형: ${req.campaignType ?? '(미지정)'}`,
    `캠페인 목표: ${req.goal || '(별도 명시 없음)'}`,
    '',
    '업로드한 가이드라인 내용:',
    (req.guideline || '(가이드라인 텍스트 없음)').slice(0, 8000),
  ].join('\n');

  let aiRes: Response;
  try {
    aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.7,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
  } catch (e) {
    return json({ error: `OpenAI 요청 실패: ${e instanceof Error ? e.message : '네트워크 오류'}` }, 502);
  }

  if (!aiRes.ok) {
    const detail = await aiRes.text();
    return json({ error: `OpenAI 오류 (${aiRes.status})`, detail: detail.slice(0, 500) }, 502);
  }

  const completion = await aiRes.json();
  const content: string | undefined = completion?.choices?.[0]?.message?.content;
  if (!content) return json({ error: 'OpenAI 응답이 비어 있습니다.' }, 502);

  let plan: unknown;
  try {
    plan = JSON.parse(content);
  } catch {
    return json({ error: 'AI 응답을 JSON 으로 해석하지 못했습니다.' }, 502);
  }

  return json(plan);
};
