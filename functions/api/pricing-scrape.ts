// 단가표 수집 함수 — 외부 마케팅 쇼핑몰(shop.gpakorea.com)에서 패키지/단일 상품 가격을 긁어온다.
//  • 브라우저에서 외부 사이트를 직접 fetch 하면 CORS 에 막히므로, 서버(Cloudflare Functions)에서 대신 가져온다.
//  • 가격은 동적 드롭다운처럼 보이지만 실제로는 상품 페이지 안의 `var pkgData = [...]` JSON 에 전부 들어있다(JS 실행 불필요).
//  • 페이지 1개가 원문 5MB(=gzip 약 340KB)로 크므로, 클라이언트가 상품 id 를 작은 청크로 나눠 detail 을 여러 번 호출한다.
//
// 사용:
//   POST { mode: "index" }              → { ids: number[] }            (수집 대상 상품 id 전체)
//   POST { mode: "detail", ids:[..] }   → { products: PriceProduct[] } (해당 id 들의 옵션·가격)

const SOURCE_ORIGIN = 'https://shop.gpakorea.com';
const UA = 'Mozilla/5.0 (compatible; ilsangisang-pricebot/1.0)';

interface ScrapedOption { name: string; price: number; desc?: string }
interface ScrapedGroup { title: string; isPackage: boolean; options: ScrapedOption[] }
interface ScrapedProduct {
  id: string; name: string; category: string; url: string;
  repPrice: number; groups: ScrapedGroup[]; updatedAt: number;
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ko' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// `var pkgData = [ ... ];` 의 배열 리터럴을, 문자열/이스케이프를 존중하며 대괄호 균형으로 정확히 잘라낸다.
// (요약문에 ] 가 들어있어 단순 정규식으로는 잘리는 문제를 피한다.)
function extractBalancedArray(html: string, marker: string): string | null {
  const at = html.indexOf(marker);
  if (at < 0) return null;
  const start = html.indexOf('[', at);
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '[') depth++;
    else if (ch === ']') { depth--; if (depth === 0) return html.slice(start, i + 1); }
  }
  return null;
}

function firstMatch(html: string, re: RegExp): string {
  const m = html.match(re);
  return m ? (m[1] ?? '').trim() : '';
}

// 옵션 설명(summary)은 <br> 로 줄바꿈된 HTML 조각이다 → 사람이 읽을 줄글로 정리한다.
function htmlToText(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"')
    .split('\n').map(l => l.trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// 상품 페이지 HTML → 정규화된 상품 1개. 옵션이 하나도 없으면 null(상품 아님/판매중지).
function parseProduct(id: string, html: string): ScrapedProduct | null {
  const arrText = extractBalancedArray(html, 'var pkgData');
  if (!arrText) return null;
  let groupsRaw: Array<{ title?: string; pkg?: Record<string, { pkg_name?: string; price?: string; status?: string; summary?: string }> }>;
  try { groupsRaw = JSON.parse(arrText); } catch { return null; }

  const groups: ScrapedGroup[] = [];
  const prices: number[] = [];
  for (const g of groupsRaw) {
    const title = (g.title || '').trim();
    const isPackage = title.includes('패키지');
    const options: ScrapedOption[] = [];
    for (const o of Object.values(g.pkg || {})) {
      const name = (o?.pkg_name || '').trim();
      const price = Number(o?.price);
      // 판매중(status=1) + 가격>0 + 이름 있는 옵션만 단가표에 싣는다.
      if (o?.status === '1' && price > 0 && name) {
        const desc = htmlToText(o?.summary || '');
        options.push(desc ? { name, price, desc } : { name, price });
        prices.push(price);
      }
    }
    if (options.length) groups.push({ title: title || '(옵션)', isPackage, options });
  }
  if (!groups.length) return null;

  // 상품명: og:title("상품명│설명 - 온라인 마케팅 쇼핑몰 | GPA KOREA")에서 앞부분만.
  const ogTitle = firstMatch(html, /property="og:title"\s+content="([^"]*)"/i)
    || firstMatch(html, /<title>([^<]*)<\/title>/i);
  const name = (ogTitle.split('│')[0].split(/\s[-|]\s/)[0].trim()) || `상품 ${id}`;
  // 대분류: breadcrumb 첫 링크 텍스트(예: "스토어").
  const category = firstMatch(html, /breadcrumb-nav[^>]*>\s*<a[^>]*>([^<]+)<\/a>/i) || '기타';

  return {
    id, name, category,
    url: `${SOURCE_ORIGIN}/item/view/${id}`,
    repPrice: Math.min(...prices),
    groups,
    updatedAt: Date.now(),
  };
}

export const onRequestPost = async (context: { request: Request }): Promise<Response> => {
  let body: { mode?: string; ids?: unknown };
  try { body = await context.request.json(); } catch { return json({ error: '잘못된 요청 본문입니다.' }, 400); }

  // 인덱스: 홈페이지에서 수집 대상 상품 id 전체를 뽑는다.
  if (body.mode === 'index') {
    let home: string;
    try { home = await fetchPage(`${SOURCE_ORIGIN}/`); }
    catch (e) { return json({ error: `소스 접속 실패: ${e instanceof Error ? e.message : '오류'}` }, 502); }
    const ids = [...new Set((home.match(/\/item\/view\/(\d+)/g) || []).map(s => s.replace('/item/view/', '')))]
      .map(Number).filter(n => n > 0).sort((a, b) => a - b);
    return json({ ids });
  }

  // 디테일: 주어진 id 들의 옵션·가격을 병렬로 긁는다(청크 크기는 클라이언트가 조절).
  if (body.mode === 'detail') {
    const ids = (Array.isArray(body.ids) ? body.ids : []).map(String).filter(Boolean).slice(0, 12);
    if (!ids.length) return json({ error: 'ids 가 비어 있습니다.' }, 400);
    const products = await Promise.all(ids.map(async id => {
      try {
        const html = await fetchPage(`${SOURCE_ORIGIN}/item/view/${id}`);
        return parseProduct(id, html);
      } catch { return null; }
    }));
    return json({ products: products.filter((p): p is ScrapedProduct => p !== null) });
  }

  return json({ error: 'mode 는 "index" 또는 "detail" 이어야 합니다.' }, 400);
};
