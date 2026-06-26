// ───────────────────────────────────────────────────────────────
// Cloudflare Pages Function:  POST /api/longtail-expand
//  • 입력: { keyword, title?, existing?: string[], threshold?, max? }
//  • LLM 이 제목의 '의도'를 읽어 이 글이 노릴 만한 구체 검색어를 생성(지역 스왑·시술 압축 포함).
//    → 검색량(검색광고) ≥ threshold(기본 10, 실재 검색어 게이트) → 상위 max(기본 5) 반환.
//  • 광범위 헤드 키워드는 LLM 프롬프트로 배제하고, 최종 가치 판정은 수집기의 순위확인이 한다.
//  • 메인 키워드 '포함' 강제(컨테인먼트) 없음 — 압구정피부과·신사리프팅 같은 의도형 서브를 살리기 위함.
//
// 환경변수: OPENAI_API_KEY(+OPENAI_MODEL) / NAVER_AD_*(검색량, 필수)
// ───────────────────────────────────────────────────────────────
import { keywordVolumes, normKw, type SearchAdEnv } from './_searchad';

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

// 제목의 의도를 읽어 구체적 롱테일 후보 생성. 실패하면 [].
async function llmCandidates(env: Env, keyword: string, title?: string): Promise<string[]> {
  if (!env.OPENAI_API_KEY) return [];
  const developer = [
    '너는 한국 네이버 상위노출 롱테일 키워드 발굴기다.',
    '"메인 키워드"와 "글 제목"을 보고, 이 글이 실제로 노출을 노릴 만한 구체적인 검색어를 만든다.',
    '핵심(제목의 의도를 읽어라):',
    '- 제목에 다른 지역/장소가 등장하면 그 지역으로 바꾼 조합도 만든다.',
    '  (예: 메인 "신사피부과" + 제목에 "압구정" → "압구정피부과", "신사피부과 압구정")',
    '- 제목이 특정 시술/항목을 강조하면 지역+항목을 압축한 키워드도 만든다.',
    '  (예: 메인 "신사피부과" + 제목에 "리프팅" → "신사리프팅", "신사피부과 리프팅")',
    '- 메인 키워드의 확장형(메인 + 수식어)도 포함한다. (예: "신사피부과 잘하는곳", "신사피부과 후기")',
    '규칙:',
    '- 사람이 실제로 검색창에 칠 법한 2~4어절(또는 지역+업종 압축형) 구체 검색어만.',
    '- ★광범위한 단일 일반어 금지: "피부과", "리프팅", "성형", "탈모" 처럼 너무 넓은 단어는 절대 만들지 마라.',
    '- 글 주제와 무관한 것 금지. 문장·해시태그·특수문자 금지.',
    '- 최대 20개. JSON 으로만: {"candidates": ["...", "..."]}',
  ].join('\n');
  const user = `메인 키워드: ${keyword}\n글 제목: ${title || '(제목 없음 — 메인 키워드 기준 합리적 변형만)'}`;
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
  // 롱테일은 저볼륨이라 임계치는 '실재 검색어(>0)' 게이트 역할만. 진짜 가치는 수집기 순위확인이 판정.
  const threshold = typeof body.threshold === 'number' ? body.threshold : 10;
  const max = typeof body.max === 'number' ? body.max : 8;
  const excluded = new Set([normKw(keyword), ...(body.existing ?? []).map(normKw)]);

  try {
    // ① LLM 의도 기반 후보 (related API 는 광범위 헤드 키워드를 줘서 사용하지 않음)
    const cands = await llmCandidates(env, keyword, body.title);
    if (!cands.length) return json({ keyword, threshold, max, count: 0, candidates: [] });

    // ② 후보 검색량 조회
    const vol = await keywordVolumes(env, cands);

    // ③ dedup + 메인/기존 제외 (컨테인먼트 강제 없음 — 의도형 서브 허용)
    const merged = new Map<string, { keyword: string; volume: number; source: 'llm' }>();
    for (const c of cands) {
      const n = normKw(c);
      if (!c || excluded.has(n)) continue;
      const v = vol.get(n) ?? 0;
      const prev = merged.get(n);
      if (!prev || v > prev.volume) merged.set(n, { keyword: c.trim(), volume: v, source: 'llm' });
    }

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
