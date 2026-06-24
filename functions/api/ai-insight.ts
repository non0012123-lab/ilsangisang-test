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

interface CatRow { category?: string; total?: number; completed?: number }
interface RankRow { category?: string; keyword?: string; rank?: number }
interface InsightRequest {
  clientName?: string;
  dateLabel?: string;
  total?: number;
  completed?: number;
  byCategory?: CatRow[];
  ranked?: RankRow[];
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

const fmtCats = (rows: CatRow[]) => rows.length
  ? rows.map(r => `- ${r.category ?? '-'}: ${r.total ?? 0}건(완료 ${r.completed ?? 0})`).join('\n')
  : '(없음)';
const fmtRanks = (rows: RankRow[]) => rows.length
  ? rows.map(r => `- ${[r.category, r.keyword].filter(Boolean).join(' / ')}: ${r.rank}위`).join('\n')
  : '(순위 잡힌 항목 없음)';

export const onRequestPost = async (context: { request: Request; env: Env }): Promise<Response> => {
  const { request, env } = context;
  if (!env.OPENAI_API_KEY) return json({ error: 'OPENAI_API_KEY 가 설정되지 않았습니다.' }, 500);

  let req: InsightRequest;
  try { req = await request.json(); } catch { return json({ error: '잘못된 요청 본문입니다.' }, 400); }
  // 입력은 작게 제한(프롬프트·지연 최소화 → 엣지 타임아웃 방지). 인사이트엔 상위 일부면 충분.
  const byCategory = (Array.isArray(req.byCategory) ? req.byCategory : []).slice(0, 12);
  const ranked = (Array.isArray(req.ranked) ? req.ranked : []).slice(0, 15);

  const developer = [
    '너는 마케팅 대행사가 광고주에게 보여주는 성과 인사이트의 "해석 코멘트"를 쓰는 도우미다. 카테고리별 건수·순위 표는 화면에 따로 보여주므로, 너는 그 수치를 단순 나열하지 말고 의미를 해석하고 다음 액션을 제안한다.',
    '아래 JSON 으로만 응답해(코드펜스 금지): { "narrative": "2~3문장" }',
    '규칙: 주어진 데이터만 근거로(수치 지어내기 금지). ① 어떤 채널/카테고리가 성과를 견인했는지, ② 순위 성과(상위권 진입 등)의 의미, ③ 구체적인 다음 단계 제안 1가지를 담는다. 표에 이미 있는 숫자를 그대로 반복하기보다 "왜 중요한지/다음에 무엇을"에 집중한다. 데이터가 없으면 "해당 기간 집행된 활동이 없다"고 차분히 안내한다.',
  ].join('\n');

  const userInput = [
    `광고주: ${req.clientName || '-'} / 기준: ${req.dateLabel || '-'}`,
    `총 ${req.total ?? 0}건 중 완료 ${req.completed ?? 0}건`,
    `카테고리별:\n${fmtCats(byCategory)}`,
    `순위:\n${fmtRanks(ranked)}`,
  ].join('\n\n');

  // ★ 요청이 늘어지면 Cloudflare 가 함수를 죽여 HTML 502 를 내므로, 우리가 먼저 끊고(JSON) 우아하게 폴백되게 한다.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000); // 10s 안에 못 받으면 중단(Cloudflare 엣지 제한보다 먼저 끊어 HTML 502 방지)
  try {
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
        signal: controller.signal,
      });
    } catch (e) {
      const aborted = (e as Error)?.name === 'AbortError';
      return json({ error: aborted ? 'OpenAI 응답 지연(20s 초과)으로 중단' : `OpenAI 요청 실패: ${e instanceof Error ? e.message : '네트워크 오류'}` }, 502);
    }

    if (!aiRes.ok) {
      const detail = await aiRes.text().catch(() => '');
      return json({ error: `OpenAI 오류 (${aiRes.status})`, detail: detail.slice(0, 300) }, 502);
    }

    const data = await aiRes.json();
    try {
      const parsed = JSON.parse(extractText(data)) as { narrative?: string };
      const narrative = typeof parsed.narrative === 'string' ? parsed.narrative : '';
      return json({ narrative });
    } catch {
      return json({ narrative: extractText(data) });
    }
  } catch (e) {
    // 어떤 예기치 못한 오류라도 HTML 502 대신 JSON 으로 반환(클라이언트가 폴백 + 사유 로깅)
    return json({ error: `인사이트 생성 오류: ${e instanceof Error ? e.message : String(e)}` }, 500);
  } finally {
    clearTimeout(timer);
  }
};
