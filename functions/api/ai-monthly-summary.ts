// ───────────────────────────────────────────────────────────────
// Cloudflare Pages Function:  POST /api/ai-monthly-summary
//  • 클라이언트 월간 보고서의 요약(summary)·하이라이트(highlights)를 AI로 생성.
//  • 클라이언트 포털에서 전송일이 지난 월간 구간 보고서를 만들 때 1회 호출(결과는 저장·캐시).
//
// 환경변수: OPENAI_API_KEY (필수), OPENAI_MODEL (선택, 기본 gpt-5.4-mini)
// ───────────────────────────────────────────────────────────────

interface Env {
  OPENAI_API_KEY: string;
  OPENAI_MODEL?: string;
}

interface Row { date?: string; category?: string; title?: string; status?: string; rank?: number; views?: number }
interface ReportRequest {
  clientName?: string;
  industry?: string;
  period?: string;
  total?: number;
  completed?: number;
  totalViews?: number;
  totalLikes?: number;
  totalSaves?: number;
  byCategory?: { category: string; count: number }[];
  entries?: Row[];
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

export const onRequestPost = async (context: { request: Request; env: Env }): Promise<Response> => {
  const { request, env } = context;
  if (!env.OPENAI_API_KEY) return json({ error: 'OPENAI_API_KEY 가 설정되지 않았습니다.' }, 500);

  let req: ReportRequest;
  try { req = await request.json(); } catch { return json({ error: '잘못된 요청 본문입니다.' }, 400); }

  const entries = Array.isArray(req.entries) ? req.entries.slice(0, 120) : [];
  const cats = (req.byCategory ?? []).map(c => `${c.category} ${c.count}건`).join(', ') || '-';
  const rows = entries.length
    ? entries.map(r => `- ${[r.date, r.category, r.title, r.status, r.rank ? `${r.rank}위` : '', r.views ? `${r.views}회` : ''].filter(Boolean).join(' / ')}`).join('\n')
    : '(작업 없음)';

  const developer = [
    '너는 마케팅 대행사의 월간 성과 보고서 작성 도우미다. 클라이언트(광고주)에게 보내는 보고서의 요약과 하이라이트를 한국어로 작성한다.',
    '아래 JSON 으로만 응답해(코드펜스 금지): { "summary": "4~6문장 요약", "highlights": ["핵심 성과 3~5개"] }',
    '규칙: 주어진 수치/작업 내역만 근거로 하고 절대 지어내지 않는다. 광고주가 읽기 좋은 정중하고 자신감 있는 톤. 매체(SNS/유튜브/네이버/디자인제작 등)별 성과와 완료율, 주요 수치를 담는다. 하이라이트는 간결한 명사구.',
  ].join('\n');

  const userInput = [
    `클라이언트: ${req.clientName || '-'}${req.industry ? ` (${req.industry})` : ''}`,
    `보고 기간: ${req.period || '-'}`,
    `작업 ${req.total ?? 0}건 중 완료 ${req.completed ?? 0}건`,
    `매체별: ${cats}`,
    `누적 수치 — 조회수 ${req.totalViews ?? 0}, 좋아요 ${req.totalLikes ?? 0}, 저장 ${req.totalSaves ?? 0}`,
    `작업 내역:\n${rows}`,
  ].join('\n');

  let aiRes: Response;
  try {
    aiRes = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: env.OPENAI_MODEL || 'gpt-5.4-mini',
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
  const text = extractText(data);
  let summary: string;
  let highlights: string[] = [];
  try {
    const parsed = JSON.parse(text) as { summary?: string; highlights?: unknown };
    summary = parsed.summary ?? text;
    highlights = Array.isArray(parsed.highlights) ? parsed.highlights.filter((h): h is string => typeof h === 'string') : [];
  } catch {
    summary = text;
  }

  return json({ summary, highlights });
};
