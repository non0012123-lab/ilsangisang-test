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
  GEMINI_API_KEY?: string;   // 있으면 Gemini 를 우선 사용(OpenAI 지역차단 회피, 한국 정상)
  GEMINI_MODEL?: string;      // 기본 gemini-2.5-flash (퇴역 대비: gemini-flash-latest 도 가능)
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// 후보 생성 지시문(공통: OpenAI·Claude 동일). 의도 기반 + 헤드 키워드 금지.
const GEN_INSTRUCTIONS = [
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
  '- 최대 20개. JSON 으로만 출력: {"candidates": ["...", "..."]}',
].join('\n');

const genUser = (keyword: string, title?: string) =>
  `메인 키워드: ${keyword}\n글 제목: ${title || '(제목 없음 — 메인 키워드 기준 합리적 변형만)'}`;

// 텍스트에서 JSON 객체만 추출(모델이 앞뒤에 군말을 붙이는 경우 대비).
function extractJson(s: string): string {
  const a = s.indexOf('{'); const b = s.lastIndexOf('}');
  return a >= 0 && b > a ? s.slice(a, b + 1) : s;
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

// 제미나이로 후보 생성(지역차단 없음, 한국 정상). 실패하면 list:[] + 사유.
async function geminiCandidates(env: Env, keyword: string, title?: string): Promise<{ list: string[]; status?: number; error?: string }> {
  if (!env.GEMINI_API_KEY) return { list: [], error: 'GEMINI_API_KEY 없음' };
  const model = env.GEMINI_MODEL || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
  const reqBody = JSON.stringify({
    system_instruction: { parts: [{ text: GEN_INSTRUCTIONS }] },
    contents: [{ role: 'user', parts: [{ text: genUser(keyword, title) }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.7, maxOutputTokens: 1024 },
  });
  let lastStatus: number | undefined, lastErr: string | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: reqBody });
      if (res.ok) {
        const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
        const text = (data.candidates?.[0]?.content?.parts ?? []).map(p => p?.text ?? '').join('');
        const parsed = JSON.parse(extractJson(text)) as { candidates?: unknown };
        const list = Array.isArray(parsed?.candidates) ? parsed.candidates.filter((c): c is string => typeof c === 'string') : [];
        return { list, status: 200 };
      }
      lastStatus = res.status; lastErr = (await res.text()).slice(0, 160);
      if ((res.status === 429 || res.status >= 500) && attempt < 2) { await sleep(800 * (attempt + 1)); continue; }
      return { list: [], status: lastStatus, error: lastErr };
    } catch (e) { lastErr = (e as Error).message; if (attempt < 2) await sleep(600); }
  }
  return { list: [], status: lastStatus, error: lastErr };
}

// OpenAI 폴백(지역차단 가능). 실패하면 list:[] + 사유(status/error).
async function llmCandidates(env: Env, keyword: string, title?: string): Promise<{ list: string[]; status?: number; error?: string }> {
  if (!env.OPENAI_API_KEY) return { list: [], error: 'OPENAI_API_KEY 없음' };
  const reqBody = JSON.stringify({
    model: env.OPENAI_MODEL || 'gpt-5.4-mini',
    input: [
      { role: 'developer', content: [{ type: 'input_text', text: GEN_INSTRUCTIONS }] },
      { role: 'user', content: [{ type: 'input_text', text: genUser(keyword, title) }] },
    ],
    text: { format: { type: 'json_object' } },
    reasoning: { effort: 'low' },
    store: false,
  });
  let lastStatus: number | undefined, lastErr: string | undefined;
  // 429(레이트리밋)·5xx 는 일시적이라 백오프 재시도. 403(지역차단)은 재시도 무의미 → 즉시 반환(폴백).
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.OPENAI_API_KEY}` },
        body: reqBody,
      });
      if (res.ok) {
        const parsed = JSON.parse(extractText(await res.json())) as { candidates?: unknown };
        const list = Array.isArray(parsed?.candidates) ? parsed.candidates.filter((c): c is string => typeof c === 'string') : [];
        return { list, status: 200 };
      }
      lastStatus = res.status; lastErr = (await res.text()).slice(0, 160);
      if ((res.status === 429 || res.status >= 500) && attempt < 2) { await sleep(800 * (attempt + 1)); continue; }
      return { list: [], status: lastStatus, error: lastErr };
    } catch (e) { lastErr = (e as Error).message; if (attempt < 2) await sleep(600); }
  }
  return { list: [], status: lastStatus, error: lastErr };
}

// LLM 완전 실패 시 '최후의' 폴백(쓰레기 방지). AI 의도기반이 정석이고, 이건 발굴이 0이 되는 것만 막는 보조.
//  - 보편적으로 말 되는 접미어만(원인/증상/치료 같은 증상형 제외 → "문신제거 원인" 방지).
//  - 키워드에 이미 든 단어는 스킵(→ "문신제거병원 병원" 중복 방지).
//  - 검색량으로 실재 검색어만 살아남고, 순위확인이 최종 게이트.
function ruleCandidates(keyword: string, title?: string): string[] {
  const SAFE = ['추천', '후기', '잘하는곳', '비용', '가격', '상담'];
  const out: string[] = [];
  for (const s of SAFE) if (!keyword.includes(s)) out.push(`${keyword} ${s}`);
  if (title) {
    const words = title.replace(/[^가-힣a-zA-Z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length >= 2 && !keyword.includes(w));
    for (const w of words.slice(0, 8)) out.push(`${keyword} ${w}`);   // 제목 단어 조합(증상형 일반접미어보다 글과 연관)
  }
  return Array.from(new Set(out));
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
  // 임계치는 '우선순위'로만 쓴다(하드 게이트 아님). 잘못된 파라미터(과도한 threshold·max 0 등)가 와도
  // 후보가 0이 되지 않도록 클램프 + 폴백. 진짜 가치 판정은 수집기 순위확인.
  const threshold = Math.max(0, typeof body.threshold === 'number' ? body.threshold : 10);
  const max = Math.min(20, Math.max(1, typeof body.max === 'number' ? body.max : 8));
  const excluded = new Set([normKw(keyword), ...(body.existing ?? []).map(normKw)]);

  try {
    // ① AI 의도 기반 후보: Gemini 우선(지역차단 없음) → OpenAI 폴백 → 규칙 폴백.
    let cands: string[] = [];
    let via: 'gemini' | 'llm' | 'rule' = 'rule';
    const diag: { geminiStatus?: number; geminiError?: string; llmStatus?: number; llmError?: string } = {};
    if (env.GEMINI_API_KEY) {
      const g = await geminiCandidates(env, keyword, body.title);
      diag.geminiStatus = g.status; diag.geminiError = g.error;
      if (g.list.length) { cands = g.list; via = 'gemini'; }
    }
    if (!cands.length) {
      const o = await llmCandidates(env, keyword, body.title);
      diag.llmStatus = o.status; diag.llmError = o.error;
      if (o.list.length) { cands = o.list; via = 'llm'; }
    }
    if (!cands.length) { cands = ruleCandidates(keyword, body.title); via = 'rule'; }
    if (!cands.length) return json({ keyword, threshold, max, via, ...diag, count: 0, candidates: [] });

    // ② 후보 검색량 조회
    const vol = await keywordVolumes(env, cands);

    // ③ dedup + 메인/기존 제외 (컨테인먼트 강제 없음 — 의도형 서브 허용)
    const merged = new Map<string, { keyword: string; volume: number; source: 'gemini' | 'llm' | 'rule' }>();
    for (const c of cands) {
      const n = normKw(c);
      if (!c || excluded.has(n)) continue;
      const v = vol.get(n) ?? 0;
      const prev = merged.get(n);
      if (!prev || v > prev.volume) merged.set(n, { keyword: c.trim(), volume: v, source: via });
    }

    // ④ 정렬(검색량 desc) → 임계치 통과분 우선, 없으면 LLM 후보 그대로 폴백 → 상한
    //    (임계치로 후보가 0이 되어 발굴이 멈추는 일을 방지. 순위확인이 최종 게이트)
    const ranked = Array.from(merged.values()).sort((a, b) => b.volume - a.volume);
    const strong = ranked.filter(c => c.volume >= threshold);
    const candidates = (strong.length ? strong : ranked).slice(0, max);

    return json({ keyword, threshold, max, via, ...diag, count: candidates.length, candidates });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : '확장 중 오류가 발생했습니다.' }, 502);
  }
};
