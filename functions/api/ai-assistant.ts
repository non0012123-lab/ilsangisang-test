// ───────────────────────────────────────────────────────────────
// Cloudflare Pages Function:  POST /api/ai-assistant
//  • 대시보드 AI 어시스턴트. 대화형으로 일정 관련 질문에 답하고,
//    필요하면 일정 생성(entries)·기존 일정 변경(updates) 액션을 제안한다.
//  • 내부 시스템 맥락(현재 일정·담당자·업체·카테고리)을 받아 근거 있는 답을 한다.
//  • 등록/변경은 프론트에서 사용자가 "적용"을 눌러야 반영된다.
//
// 환경변수: OPENAI_API_KEY (필수), OPENAI_MODEL (선택, 기본 gpt-5.5)
// ───────────────────────────────────────────────────────────────

interface Env {
  OPENAI_API_KEY: string;
  OPENAI_MODEL?: string;
}

interface CtxEntry {
  id: string;
  date: string;
  endDate?: string | null;
  managerName?: string;
  clientName?: string;
  category?: string;
  keyword?: string;
  status?: string;
}

interface AssistantRequest {
  message?: string;
  history?: { role: 'user' | 'assistant'; text: string }[];
  today?: string;
  managers?: string[];
  clients?: string[];
  categories?: string[];
  entries?: CtxEntry[];
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

// OpenAI Responses API 출력에서 텍스트만 추출
function extractText(data: unknown): string {
  const d = data as { output_text?: string; output?: unknown[] };
  if (typeof d?.output_text === 'string' && d.output_text.trim()) return d.output_text;
  const out = Array.isArray(d?.output) ? d.output : [];
  const parts: string[] = [];
  for (const item of out as { type?: string; content?: unknown[] }[]) {
    if (item?.type === 'message' && Array.isArray(item.content)) {
      for (const c of item.content as { type?: string; text?: string }[]) {
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

  let req: AssistantRequest;
  try {
    req = await request.json();
  } catch {
    return json({ error: '잘못된 요청 본문입니다.' }, 400);
  }
  if (!req.message || !req.message.trim()) return json({ error: '입력 메시지가 비어 있습니다.' }, 400);

  const today = req.today || new Date().toISOString().slice(0, 10);
  const managers = req.managers ?? [];
  const clients = req.clients ?? [];
  const categories = req.categories ?? [];
  const entries = (Array.isArray(req.entries) ? req.entries : []).slice(0, 400);

  const developer = [
    '너는 한국 마케팅 대행사의 일정 관리 AI 어시스턴트다. 항상 한국어로, 친절하고 간결하게 답한다.',
    '반드시 아래 JSON 객체로만 응답해(코드펜스·설명문 금지):',
    '{',
    '  "reply": "사용자에게 보여줄 자연스러운 한국어 답변",',
    '  "entries": [ { "date":"YYYY-MM-DD", "endDate":"YYYY-MM-DD 또는 null", "managerName":"", "clientName":"", "category":"", "keyword":"", "status":"pending|in-progress|completed" } ],',
    '  "updates": [ { "id":"기존 일정 id", "date":"YYYY-MM-DD 또는 null", "endDate":"YYYY-MM-DD 또는 null", "managerName":"문자열 또는 null", "status":"상태 또는 null" } ]',
    '}',
    '',
    '판단 규칙:',
    `- 오늘 날짜는 ${today}. "오늘/내일/이번주/다음주 월요일/0월 0일" 등 상대·축약 표현은 이 날짜 기준 절대 날짜(YYYY-MM-DD)로 변환.`,
    '- 사용자가 새 일정을 말하면("오늘 스케줄은 ~~~ 있어" 등) 해당 일정을 entries 배열에 담는다. 한 문장에 여러 건이면 모두.',
    '- 단순 질문·조언("시간 분배 어떻게 효율적일까?" 등)이면 entries·updates 는 빈 배열로 두고 reply 에만 구체적이고 실용적으로 답한다. 현재 일정 목록을 근거로 답할 것.',
    '- "배분/재배치/나눠줘" 요청이면, 아래 현재 일정을 참고해 날짜·담당자를 합리적으로 분산한다. 기존 일정을 옮기는 것은 updates(그 일정의 id 사용), 새로 만드는 것은 entries 에 담는다. 변경하지 않는 필드는 null.',
    '- managerName 은 아래 "담당자 목록" 중 가장 가까운 값, clientName 은 "업체 목록" 중 가장 가까운 값. category 는 "카테고리 목록" 중 하나(애매하면 "기타").',
    '- 기간 작업이 아니면 endDate 는 null. status 미지정이면 "pending".',
    '- entries 나 updates 를 제안할 때 reply 에는 무엇을 제안하는지 요약하고, 사용자가 "적용" 버튼을 눌러야 실제 반영된다는 뉘앙스로 안내한다.',
    '- 확실하지 않은 정보를 지어내지 말 것. 모르면 reply 에서 추가 정보를 요청.',
    '',
    `담당자 목록: ${managers.join(', ') || '(없음)'}`,
    `업체 목록: ${clients.join(', ') || '(없음)'}`,
    `카테고리 목록: ${categories.join(', ')}`,
    '',
    '현재 등록된 일정(JSON, id 포함 — updates 에 이 id 사용):',
    JSON.stringify(entries),
  ].join('\n');

  // 대화 맥락을 하나의 사용자 메시지(트랜스크립트)로 합쳐 전달
  const transcript = [
    ...(Array.isArray(req.history) ? req.history : []).slice(-8).map(m => `${m.role === 'user' ? '사용자' : '어시스턴트'}: ${m.text}`),
    `사용자: ${req.message}`,
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
          { role: 'user', content: [{ type: 'input_text', text: transcript }] },
        ],
        text: { format: { type: 'json_object' } },
        reasoning: { effort: 'low' },
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
  let parsed: { reply?: string; entries?: unknown; updates?: unknown };
  try {
    parsed = JSON.parse(content);
  } catch {
    return json({ error: 'AI 응답을 JSON 으로 해석하지 못했습니다.' }, 502);
  }

  return json({
    reply: typeof parsed?.reply === 'string' ? parsed.reply : '',
    entries: Array.isArray(parsed?.entries) ? parsed.entries : [],
    updates: Array.isArray(parsed?.updates) ? parsed.updates : [],
  });
};
