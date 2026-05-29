// ───────────────────────────────────────────────────────────────
// Cloudflare Pages Function:  POST /api/ai-schedule
//  • 타임테이블의 "AI 자동 완성" 채팅 입력을 구조화된 일정으로 변환한다.
//  • 자연어 문장 → ScheduleEntry 후보(JSON) 추출. (등록은 프론트에서 확인 후)
//  • 추출 작업이라 추론 최소화 + 웹 검색 없음 → 빠르고 저렴.
//
// 환경변수: OPENAI_API_KEY (필수), OPENAI_MODEL (선택, 기본 gpt-5.5)
// ───────────────────────────────────────────────────────────────

interface Env {
  OPENAI_API_KEY: string;
  OPENAI_MODEL?: string;
}

interface ScheduleRequest {
  text?: string;          // 사용자 채팅 문장
  today?: string;         // 오늘 날짜(YYYY-MM-DD) — 상대 날짜 계산 기준
  managers?: string[];    // 유효 담당자명 목록
  clients?: string[];     // 유효 업체명 목록
  categories?: string[];  // 유효 카테고리 목록
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

function extractText(data: any): string {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text;
  const out = Array.isArray(data?.output) ? data.output : [];
  const parts: string[] = [];
  for (const item of out) {
    if (item?.type === 'message' && Array.isArray(item.content)) {
      for (const c of item.content) {
        if ((c?.type === 'output_text' || c?.type === 'text') && typeof c.text === 'string') parts.push(c.text);
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

  let req: ScheduleRequest;
  try {
    req = await request.json();
  } catch {
    return json({ error: '잘못된 요청 본문입니다.' }, 400);
  }
  if (!req.text || !req.text.trim()) return json({ error: '입력 문장이 비어 있습니다.' }, 400);

  const today = req.today || new Date().toISOString().slice(0, 10);
  const managers = req.managers ?? [];
  const clients = req.clients ?? [];
  const categories = req.categories ?? [];

  const developer = [
    '너는 마케팅 대행사의 일정 등록 도우미야.',
    '사용자의 자연어 문장에서 콘텐츠 작업 일정을 추출해서, 아래 JSON 스키마로만 응답해(설명 금지).',
    '{ "entries": [ { "date": "YYYY-MM-DD", "endDate": "YYYY-MM-DD 또는 null", "managerName": "", "clientName": "", "category": "", "keyword": "", "status": "pending|in-progress|completed" } ] }',
    `- 오늘 날짜는 ${today}. "내일/다음주 월요일/이번주" 같은 상대 표현은 이 날짜 기준으로 계산해 절대 날짜로 변환해.`,
    '- 하나의 문장에 여러 일정이 있으면 entries 배열에 모두 담아.',
    '- managerName 은 반드시 아래 "담당자 목록" 중 가장 가까운 값으로. 매칭 불가하면 빈 문자열.',
    '- clientName 은 반드시 아래 "업체 목록" 중 가장 가까운 값으로. 매칭 불가하면 빈 문자열.',
    '- category 는 반드시 아래 "카테고리 목록" 중 하나. 애매하면 가장 가까운 것, 정 없으면 "기타".',
    '- 기간 작업이 아니면 endDate 는 null.',
    '- status 가 명시 안 되면 "pending".',
    '- keyword 에는 작업 핵심(키워드/주제)을 간결히.',
    '',
    `담당자 목록: ${managers.join(', ') || '(없음)'}`,
    `업체 목록: ${clients.join(', ') || '(없음)'}`,
    `카테고리 목록: ${categories.join(', ')}`,
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
          { role: 'developer', content: [{ type: 'input_text', text: developer }] },
          { role: 'user', content: [{ type: 'input_text', text: req.text }] },
        ],
        text: { format: { type: 'json_object' } },
        reasoning: { effort: 'minimal' }, // 추출 작업 → 빠르게
        store: false,
      }),
    });
  } catch (e) {
    return json({ error: `OpenAI 요청 실패: ${e instanceof Error ? e.message : '네트워크 오류'}` }, 502);
  }

  if (!aiRes.ok) {
    const detail = await aiRes.text();
    return json({ error: `OpenAI 오류 (${aiRes.status})`, detail: detail.slice(0, 500) }, 502);
  }

  const data = await aiRes.json();
  const content = extractText(data);
  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    return json({ error: 'AI 응답을 JSON 으로 해석하지 못했습니다.' }, 502);
  }

  const entries = Array.isArray(parsed?.entries) ? parsed.entries : [];
  return json({ entries });
};
