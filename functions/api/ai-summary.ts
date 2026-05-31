// ───────────────────────────────────────────────────────────────
// Cloudflare Pages Function:  POST /api/ai-summary
//  • 담당자의 하루 업무(대기중/작업중/완료)를 받아 AI가 한국어로 간결히 요약.
//  • 일일보고서 PDF 상단에 들어가는 "AI 요약"에 사용된다.
//
// 환경변수: OPENAI_API_KEY (필수), OPENAI_MODEL (선택, 기본 gpt-5.5)
// ───────────────────────────────────────────────────────────────

interface Env {
  OPENAI_API_KEY: string;
  OPENAI_MODEL?: string;
}

interface Row { date?: string; clientName?: string; category?: string; title?: string }

interface SummaryRequest {
  managerName?: string;
  date?: string;
  note?: string;
  pending?: Row[];
  inProgress?: Row[];
  completed?: Row[];
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

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

const fmtRows = (rows: Row[]) => rows.length
  ? rows.map(r => `- ${[r.clientName, r.category, r.title].filter(Boolean).join(' / ')}`).join('\n')
  : '(없음)';

export const onRequestPost = async (context: { request: Request; env: Env }): Promise<Response> => {
  const { request, env } = context;
  if (!env.OPENAI_API_KEY) return json({ error: 'OPENAI_API_KEY 가 설정되지 않았습니다.' }, 500);

  let req: SummaryRequest;
  try { req = await request.json(); } catch { return json({ error: '잘못된 요청 본문입니다.' }, 400); }

  const pending = Array.isArray(req.pending) ? req.pending : [];
  const inProgress = Array.isArray(req.inProgress) ? req.inProgress : [];
  const completed = Array.isArray(req.completed) ? req.completed : [];

  const developer = [
    '너는 마케팅 대행사의 일일 업무 보고 요약 도우미다. 담당자의 하루 업무를 관리자가 빠르게 파악하도록 한국어로 간결하게 요약한다.',
    '아래 JSON 으로만 응답해(코드펜스 금지): { "summary": "3~5문장 요약" }',
    '규칙: 완료/진행중/대기 비중과 핵심 업무, 주의가 필요한 점(특이사항이 있으면 반영)을 담는다. 수치를 지어내지 말고 주어진 내용만 근거로. 담백하고 업무적인 톤.',
  ].join('\n');

  const userInput = [
    `담당자: ${req.managerName || '-'} / 날짜: ${req.date || '-'}`,
    `완료(${completed.length}):\n${fmtRows(completed)}`,
    `작업중(${inProgress.length}):\n${fmtRows(inProgress)}`,
    `대기중(${pending.length}):\n${fmtRows(pending)}`,
    req.note ? `특이사항: ${req.note}` : '',
  ].filter(Boolean).join('\n\n');

  let aiRes: Response;
  try {
    aiRes = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: env.OPENAI_MODEL || 'gpt-5.5',
        input: [
          { role: 'developer', content: [{ type: 'input_text', text: developer }] },
          { role: 'user', content: [{ type: 'input_text', text: userInput }] },
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
    return json({ error: `OpenAI 오류 (${aiRes.status})`, detail: detail.slice(0, 300) }, 502);
  }

  const data = await aiRes.json();
  let summary: string;
  try { summary = (JSON.parse(extractText(data)) as { summary?: string }).summary ?? ''; }
  catch { summary = extractText(data); }

  return json({ summary });
};
