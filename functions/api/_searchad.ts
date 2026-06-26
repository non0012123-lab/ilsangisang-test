// 네이버 검색광고 API(키워드도구) 공유 헬퍼. (_ 접두사 = 라우트 아님, import 전용)
//  • 기존 naver-keywords.ts 와 동일한 서명/호출 방식. 롱테일 확장에서 재사용.
export interface SearchAdEnv {
  NAVER_AD_API_KEY: string;
  NAVER_AD_SECRET_KEY: string;
  NAVER_AD_CUSTOMER_ID: string;
}

export const normKw = (s: string) => s.replace(/\s+/g, '').toLowerCase();

const toNum = (v: unknown): number => {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') { const n = parseInt(v.replace(/[^0-9]/g, ''), 10); return Number.isNaN(n) ? 0 : n; }
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

// hintKeywords(콤마구분, 최대 5개) 1회 호출 → keywordList 행들
async function callTool(env: SearchAdEnv, hint: string): Promise<Record<string, unknown>[]> {
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
  if (!res.ok) throw new Error(`검색광고 API 오류 (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const data = await res.json() as { keywordList?: unknown };
  return Array.isArray(data?.keywordList) ? data.keywordList as Record<string, unknown>[] : [];
}

const volOf = (k: Record<string, unknown>) => toNum(k.monthlyPcQcCnt) + toNum(k.monthlyMobileQcCnt);

// 입력 키워드들의 월 검색량(PC+모바일) → Map<normKw, total>. (5개씩 나눠 호출)
export async function keywordVolumes(env: SearchAdEnv, keywords: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const uniq = Array.from(new Set(keywords.map(k => k.trim()).filter(Boolean)));
  for (let i = 0; i < uniq.length; i += 5) {
    const chunk = uniq.slice(i, i + 5).map(normKw).join(',');
    try {
      for (const k of await callTool(env, chunk)) map.set(normKw(k.relKeyword as string), volOf(k));
    } catch { /* 청크 실패는 건너뜀(나머지 키워드는 계속) */ }
  }
  return map;
}

// 시드 키워드의 연관키워드 → [{keyword, volume}] (검색량 내림차순, 상위 limit)
export async function relatedKeywords(env: SearchAdEnv, seed: string, limit = 100): Promise<{ keyword: string; volume: number }[]> {
  const list = await callTool(env, normKw(seed));
  return list
    .map(k => ({ keyword: k.relKeyword as string, volume: volOf(k) }))
    .filter(r => r.keyword && normKw(r.keyword) !== normKw(seed))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, limit);
}
