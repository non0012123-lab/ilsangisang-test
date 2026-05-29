// ───────────────────────────────────────────────────────────────
// Cloudflare Pages Function:  POST /api/naver-keywords
//  • 네이버 "검색광고 API" 키워드도구(/keywordstool)
//  • 두 가지 모드:
//    - { keywords: string[] }  → 입력한 키워드(최대 50개)들의 지표만 반환
//      (키워드도구는 호출당 hintKeywords 5개 제한 → 5개씩 나눠 호출)
//    - { related: string }     → 그 키워드 하나의 연관키워드 목록 반환
//
// 환경변수: NAVER_AD_API_KEY / NAVER_AD_SECRET_KEY / NAVER_AD_CUSTOMER_ID
// ───────────────────────────────────────────────────────────────

interface Env {
  NAVER_AD_API_KEY: string;
  NAVER_AD_SECRET_KEY: string;
  NAVER_AD_CUSTOMER_ID: string;
}

interface Row {
  keyword: string;
  pc: number | string;
  mobile: number | string;
  total: number;
  pcClick: number | string;
  mobileClick: number | string;
  pcCtr: number | string;
  mobileCtr: number | string;
  compIdx: string;
  found: boolean;
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase();
const toNum = (v: unknown): number => {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') { const n = parseInt(v.replace(/[^0-9]/g, ''), 10); return isNaN(n) ? 0 : n; }
  return 0;
};

async function sign(timestamp: string, method: string, path: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${timestamp}.${method}.${path}`));
  let bin = '';
  const bytes = new Uint8Array(sig);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

// hintKeywords(콤마구분, 최대 5개) 한 번 호출 → keywordList 행들
async function callTool(env: Env, hint: string): Promise<Record<string, unknown>[]> {
  const timestamp = Date.now().toString();
  const path = '/keywordstool';
  const signature = await sign(timestamp, 'GET', path, env.NAVER_AD_SECRET_KEY);
  const url = `https://api.searchad.naver.com${path}?hintKeywords=${encodeURIComponent(hint)}&showDetail=1`;
  const res = await fetch(url, {
    headers: {
      'X-Timestamp': timestamp,
      'X-API-KEY': env.NAVER_AD_API_KEY,
      'X-Customer': env.NAVER_AD_CUSTOMER_ID,
      'X-Signature': signature,
    },
  });
  if (!res.ok) throw new Error(`네이버 API 오류 (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return Array.isArray(data?.keywordList) ? data.keywordList : [];
}

function toRow(k: Record<string, unknown>): Row {
  const pc = k.monthlyPcQcCnt, mobile = k.monthlyMobileQcCnt;
  return {
    keyword: k.relKeyword as string,
    pc: pc as number | string,
    mobile: mobile as number | string,
    total: toNum(pc) + toNum(mobile),
    pcClick: (k.monthlyAvePcClkCnt as number | string) ?? 0,
    mobileClick: (k.monthlyAveMobileClkCnt as number | string) ?? 0,
    pcCtr: (k.monthlyAvePcCtr as number | string) ?? 0,
    mobileCtr: (k.monthlyAveMobileCtr as number | string) ?? 0,
    compIdx: (k.compIdx as string) ?? '-',
    found: true,
  };
}

const byTotalDesc = (a: Row, b: Row) => b.total - a.total;

export const onRequestPost = async (context: { request: Request; env: Env }): Promise<Response> => {
  const { request, env } = context;
  if (!env.NAVER_AD_API_KEY || !env.NAVER_AD_SECRET_KEY || !env.NAVER_AD_CUSTOMER_ID) {
    return json({ error: '네이버 검색광고 API 키가 설정되지 않았습니다. 환경변수를 확인하세요.' }, 500);
  }

  let body: { keywords?: string[]; related?: string };
  try { body = await request.json(); } catch { return json({ error: '잘못된 요청 본문입니다.' }, 400); }

  try {
    // ── 연관키워드 모드 ──
    if (body.related) {
      const seed = body.related.trim();
      if (!seed) return json({ error: '키워드를 입력하세요.' }, 400);
      const list = await callTool(env, norm(seed));
      const related = list.map(toRow).filter(r => norm(r.keyword) !== norm(seed)).sort(byTotalDesc).slice(0, 200);
      return json({ query: seed, related });
    }

    // ── 입력 키워드 모드 (최대 50개, 5개씩 나눠 호출) ──
    const typed = Array.from(new Set((body.keywords ?? []).map(k => k.trim()).filter(Boolean))).slice(0, 50);
    if (typed.length === 0) return json({ error: '키워드를 입력하세요.' }, 400);

    const map = new Map<string, Row>();
    for (let i = 0; i < typed.length; i += 5) {
      const chunk = typed.slice(i, i + 5);
      const list = await callTool(env, chunk.map(norm).join(','));
      for (const k of list) {
        const row = toRow(k);
        map.set(norm(row.keyword), row);
      }
    }
    // 입력한 키워드만, 입력 순서 유지(정렬은 화면에서 클릭으로). 못 찾으면 빈 행
    const keywords = typed.map(t => map.get(norm(t)) ?? {
      keyword: t, pc: '-', mobile: '-', total: 0, pcClick: '-', mobileClick: '-', pcCtr: '-', mobileCtr: '-', compIdx: '-', found: false,
    } as Row);

    return json({ keywords });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : '조회 중 오류가 발생했습니다.' }, 502);
  }
};
