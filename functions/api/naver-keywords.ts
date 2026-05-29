// ───────────────────────────────────────────────────────────────
// Cloudflare Pages Function:  POST /api/naver-keywords
//  • 네이버 "검색광고 API" 키워드도구(/keywordstool)로
//    PC/모바일 월간 조회수 + 연관키워드를 조회한다.
//  • HMAC-SHA256 서명 + 비밀키가 필요해 반드시 서버에서 호출.
//
// 환경변수 (Cloudflare Pages → Settings / 로컬 .dev.vars):
//  • NAVER_AD_API_KEY      액세스 라이선스
//  • NAVER_AD_SECRET_KEY   비밀키
//  • NAVER_AD_CUSTOMER_ID  CUSTOMER_ID
// ───────────────────────────────────────────────────────────────

interface Env {
  NAVER_AD_API_KEY: string;
  NAVER_AD_SECRET_KEY: string;
  NAVER_AD_CUSTOMER_ID: string;
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

// timestamp.method.path 를 비밀키로 HMAC-SHA256 서명 → base64
async function sign(timestamp: string, method: string, path: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${timestamp}.${method}.${path}`));
  let bin = '';
  const bytes = new Uint8Array(sig);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

// "< 10" 같은 문자열도 숫자로 (정렬용). 표시는 원본 문자열 유지.
function toNum(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') { const n = parseInt(v.replace(/[^0-9]/g, ''), 10); return isNaN(n) ? 0 : n; }
  return 0;
}

export const onRequestPost = async (context: { request: Request; env: Env }): Promise<Response> => {
  const { request, env } = context;
  if (!env.NAVER_AD_API_KEY || !env.NAVER_AD_SECRET_KEY || !env.NAVER_AD_CUSTOMER_ID) {
    return json({ error: '네이버 검색광고 API 키가 설정되지 않았습니다. 환경변수를 확인하세요.' }, 500);
  }

  let body: { keyword?: string };
  try { body = await request.json(); } catch { return json({ error: '잘못된 요청 본문입니다.' }, 400); }
  const raw = (body.keyword ?? '').trim();
  if (!raw) return json({ error: '키워드를 입력하세요.' }, 400);
  // 키워드도구는 공백 없는 키워드를 권장
  const hint = raw.replace(/\s+/g, '');

  const timestamp = Date.now().toString();
  const method = 'GET';
  const path = '/keywordstool';
  const signature = await sign(timestamp, method, path, env.NAVER_AD_SECRET_KEY);
  const url = `https://api.searchad.naver.com${path}?hintKeywords=${encodeURIComponent(hint)}&showDetail=1`;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        'X-Timestamp': timestamp,
        'X-API-KEY': env.NAVER_AD_API_KEY,
        'X-Customer': env.NAVER_AD_CUSTOMER_ID,
        'X-Signature': signature,
      },
    });
  } catch (e) {
    return json({ error: `네이버 API 요청 실패: ${e instanceof Error ? e.message : '네트워크 오류'}` }, 502);
  }

  if (!res.ok) {
    const detail = await res.text();
    return json({ error: `네이버 API 오류 (${res.status})`, detail: detail.slice(0, 400) }, 502);
  }

  const data = await res.json();
  const list = Array.isArray(data?.keywordList) ? data.keywordList : [];
  const keywords = list.map((k: Record<string, unknown>) => {
    const pc = k.monthlyPcQcCnt;
    const mobile = k.monthlyMobileQcCnt;
    return {
      keyword: k.relKeyword as string,
      pc, mobile,
      total: toNum(pc) + toNum(mobile),
      sortKey: toNum(pc) + toNum(mobile),
      compIdx: (k.compIdx as string) ?? '-',          // 경쟁정도(높음/중간/낮음)
      pcCtr: k.monthlyAvePcCtr ?? null,
      mobileCtr: k.monthlyAveMobileCtr ?? null,
    };
  }).sort((a: { sortKey: number }, b: { sortKey: number }) => b.sortKey - a.sortKey);

  return json({ query: raw, keywords });
};
