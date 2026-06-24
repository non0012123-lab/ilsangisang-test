// ───────────────────────────────────────────────────────────────
// Cloudflare Pages Function:  POST /api/ai-insight
//  • 광고주 포털 대시보드의 "AI 마케팅 인사이트" — "어제" 집행 내역/순위를 받아
//    클라이언트가 읽는 성과 브리핑(문단 + 핵심 포인트)을 한국어로 생성한다.
//  • 하루 1회만 호출되도록 캐시는 클라이언트(포털)에서 처리한다(여기선 생성만).
//
// 환경변수: OPENAI_API_KEY (필수), OPENAI_MODEL (선택, 기본 gpt-5.4-mini)
// ───────────────────────────────────────────────────────────────

interface Env {
  OPENAI_API_KEY: string;
  OPENAI_MODEL?: string;
}

interface InsightRow { category?: string; keyword?: string; status?: string; rank?: number; pv?: number }
interface InsightRequest { clientName?: string; dateLabel?: string; entries?: InsightRow[] }

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

const statusKo = (s?: string) => s === 'completed' ? '완료' : s === 'in-progress' ? '진행중' : '대기';
const fmtRows = (rows: InsightRow[]) => rows.length
  ? rows.map(r => `- ${[r.category, r.keyword].filter(Boolean).join(' / ')} (${statusKo(r.status)}${r.rank != null ? `, ${r.rank}위` : ''}${r.pv ? `, 조회 ${r.pv.toLocaleString()}` : ''})`).join('\n')
  : '(없음)';

export const onRequestPost = async (context: { request: Request; env: Env }): Promise<Response> => {
  const { request, env } = context;
  if (!env.OPENAI_API_KEY) return json({ error: 'OPENAI_API_KEY 가 설정되지 않았습니다.' }, 500);

  let req: InsightRequest;
  try { req = await request.json(); } catch { return json({ error: '잘못된 요청 본문입니다.' }, 400); }
  const entries = Array.isArray(req.entries) ? req.entries : [];

  const developer = [
    '너는 마케팅 대행사가 광고주에게 보여주는 "일일 성과 인사이트"를 쓰는 도우미다. 광고주가 읽기 좋게, 신뢰가 가는 담백한 톤으로 한국어로 작성한다.',
    '아래 JSON 으로만 응답해(코드펜스 금지): { "narrative": "3~4문장 브리핑", "highlights": ["핵심 포인트", "..."] }',
    '규칙: 주어진 데이터(집행 건수·완료·채널별 노출·순위)만 근거로 하고 수치를 지어내지 않는다. narrative 는 어제 무엇이 진행됐고 순위/노출이 어떤지 요약하고 마지막에 짧은 다음 제안을 포함한다. highlights 는 2~4개, 각 한 줄(최고 성과 콘텐츠·최고 순위·다음 단계 제안 등). 데이터가 없으면 "어제 집행된 활동이 없다"고 차분히 안내한다.',
  ].join('\n');

  const userInput = [
    `광고주: ${req.clientName || '-'} / 기준일: ${req.dateLabel || '어제'}`,
    `집행 내역(${entries.length}건):\n${fmtRows(entries)}`,
  ].join('\n\n');

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
  try {
    const parsed = JSON.parse(extractText(data)) as { narrative?: string; highlights?: unknown };
    const narrative = typeof parsed.narrative === 'string' ? parsed.narrative : '';
    const highlights = Array.isArray(parsed.highlights) ? parsed.highlights.filter((h): h is string => typeof h === 'string') : [];
    return json({ narrative, highlights });
  } catch {
    return json({ narrative: extractText(data), highlights: [] });
  }
};
