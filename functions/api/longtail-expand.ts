// ───────────────────────────────────────────────────────────────
// Cloudflare Pages Function:  POST /api/longtail-expand
//  • 입력: { keyword, title?, existing?: string[], threshold?, max? }
//  • 후보 생성: ① LLM(제목→검색형 조합)  ② 검색광고 연관키워드
//    → 검색량(검색광고 keywordstool) ≥ threshold 만 채택 → 상위 max 개 반환.
//  • 출력: { candidates: [{ keyword, volume, source:'llm'|'related' }] }
//  • 검수 단계 없음(검색량 필터가 게이트). 메인 키워드/기존 키워드는 제외.
//
// 환경변수: OPENAI_API_KEY(+OPENAI_MODEL, LLM은 선택) / NAVER_AD_*(검색량, 필수)
// ───────────────────────────────────────────────────────────────
import { keywordVolumes, relatedKeywords, normKw, type SearchAdEnv } from './_searchad';

interface Env extends SearchAdEnv {
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
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

// 제목 + 메인 키워드 → 실제 검색형 롱테일 후보(문자열). 실패하면 []  (LLM 은 선택 소스)
async function llmCandidates(env: Env, keyword: string, title?: string): Promise<string[]> {
  if (!env.OPENAI_API_KEY) return [];
  const developer = [
    '너는 한국 네이버 검색 롱테일 키워드 생성기다.',
    '주어진 "글 제목"과 "메인 키워드"에서, 한국 사용자가 실제로 검색창에 칠 법한 검색어 변형을 만든다.',
    '규칙:',
    '- ★메인 키워드를 그대로(연속해서) 포함하고, 앞/뒤에 수식어만 덧붙인 확장형만 만든다. 메인 키워드를 쪼개거나 빼지 말 것.',
    '  (예: 메인 "신사모발이식" → "신사모발이식 후기", "신사모발이식 흉터", "강남 신사모발이식". X: "탈모", "모발이식")',
    '- 제목 속 수식어(후기·가격·비용·잘하는곳·흉터 등)를 활용. 2~5어절의 자연스러운 검색어. 문장·해시태그·특수문자 금지.',
    '- 메인 키워드 자체보다 더 넓은(상위) 단어나 글과 무관한 것은 금지.',
    '- 최대 25개. JSON 으로만: {"candidates": ["...", "..."]}',
  ].join('\n');
  const user = `메인 키워드: ${keyword}\n글 제목: ${title || '(제목 없음 — 메인 키워드 기준으로 합리적 변형만)'}`;
  try {
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: env.OPENAI_MODEL || 'gpt-5.4-mini',
        input: [
          { role: 'developer', content: [{ type: 'input_text', text: developer }] },
          { role: 'user', content: [{ type: 'input_text', text: user }] },
        ],
        text: { format: { type: 'json_object' } },
        reasoning: { effort: 'low' },
        store: false,
      }),
    });
    if (!res.ok) return [];
    const parsed = JSON.parse(extractText(await res.json())) as { candidates?: unknown };
    return Array.isArray(parsed?.candidates) ? parsed.candidates.filter((c): c is string => typeof c === 'string') : [];
  } catch { return []; }
}

export const onRequestPost = async (context: { request: Request; env: Env }): Promise<Response> => {
  const { request, env } = context;
  if (!env.NAVER_AD_API_KEY || !env.NAVER_AD_SECRET_KEY || !env.NAVER_AD_CUSTOMER_ID) {
    return json({ error: '검색광고 API 키가 설정되지 않았습니다(검색량 필터 필요).' }, 500);
  }

  let body: { keyword?: string; title?: string; existing?: string[]; threshold?: number; max?: number };
  try { body = await request.json(); } catch { return json({ error: '잘못된 요청 본문입니다.' }, 400); }

  const keyword = (body.keyword ?? '').trim();
  if (!keyword) return json({ error: '메인 키워드가 필요합니다.' }, 400);
  // 롱테일은 본질적으로 저볼륨(네이버 "< 10" → 20). 검색량은 '실재 검색어(>0)' 게이트 역할만 하고
  // 진짜 가치 필터는 다운스트림 순위확인이므로 기본 임계치를 낮게 둔다.
  const threshold = typeof body.threshold === 'number' ? body.threshold : 10;
  const max = typeof body.max === 'number' ? body.max : 5;
  const excluded = new Set([normKw(keyword), ...(body.existing ?? []).map(normKw)]);

  try {
    // ① 두 소스 동시 수집 (한쪽 실패해도 진행)
    const [llm, related] = await Promise.all([
      llmCandidates(env, keyword, body.title),
      relatedKeywords(env, keyword, 100).catch(() => [] as { keyword: string; volume: number }[]),
    ]);

    // ② LLM 후보의 검색량 조회
    const llmVol = llm.length ? await keywordVolumes(env, llm) : new Map<string, number>();

    // ③ 통합 + dedup(같은 키워드면 검색량 큰 쪽 유지)
    //    ★롱테일만: 메인 키워드를 포함하는 확장형만 채택(헤드/무관 단어 배제). 어순/띄어쓰기는 정규화로 흡수.
    const baseNorm = normKw(keyword);
    const merged = new Map<string, { keyword: string; volume: number; source: 'llm' | 'related' }>();
    const add = (kw: string, volume: number, source: 'llm' | 'related') => {
      const n = normKw(kw);
      if (!kw || excluded.has(n) || !n.includes(baseNorm)) return;
      const prev = merged.get(n);
      if (!prev || volume > prev.volume) merged.set(n, { keyword: kw.trim(), volume, source });
    };
    for (const r of related) add(r.keyword, r.volume, 'related');
    for (const c of llm) add(c, llmVol.get(normKw(c)) ?? 0, 'llm');

    // ④ 검색량 필터 → 정렬 → 상한
    const candidates = Array.from(merged.values())
      .filter(c => c.volume >= threshold)
      .sort((a, b) => b.volume - a.volume)
      .slice(0, max);

    return json({ keyword, threshold, max, count: candidates.length, candidates });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : '확장 중 오류가 발생했습니다.' }, 502);
  }
};
