// ── OpenAI 미국 egress 프록시 (독립 Cloudflare Worker) ──────────────
// 목적: Pages Functions 가 홍콩(HKG) colo 에서 실행되면 OpenAI 가 403(unsupported_country).
//   이 워커는 Durable Object 를 미국(locationHint 'wnam')에 고정 생성하고, 그 안에서 OpenAI 를
//   호출한다 → 요청이 미국 IP 로 나가 지역차단을 회피한다. (Smart Placement 휴리스틱에 의존 안 함)
//
// 배포:
//   cd proxy-worker
//   npx wrangler deploy
//   npx wrangler secret put PROXY_SECRET      # 임의의 긴 랜덤 문자열
// 그런 다음 Pages(프로젝트) 환경변수에 아래 2개를 설정(프로덕션):
//   OPENAI_PROXY_URL     = https://ilsangisang-openai-proxy.<계정서브도메인>.workers.dev
//   OPENAI_PROXY_SECRET  = 위 PROXY_SECRET 과 동일 값
// (functions/api/_openai.ts 가 이 두 값이 있으면 OpenAI 대신 이 워커로 보냄. 없으면 직접 호출로 폴백.)

interface Env {
  US_PROXY: DurableObjectNamespace;
  PROXY_SECRET: string;
}

// 미국에 고정된 Durable Object — 여기서 나가는 fetch 는 미국 IP egress.
export class UsProxy {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const target = `https://api.openai.com${url.pathname}${url.search}`;
    const headers = new Headers(req.headers);
    headers.delete('X-Proxy-Auth');       // 프록시 인증 헤더는 OpenAI 로 넘기지 않음
    headers.delete('Host');
    // 본문은 버퍼로 받아 전달(스트림 duplex 이슈 회피). 프롬프트 JSON 이라 작다.
    const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.arrayBuffer();
    // Authorization(Bearer OPENAI_API_KEY)·Content-Type 등은 그대로 전달.
    return fetch(target, { method: req.method, headers, body, redirect: 'manual' });
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    // 공유 시크릿 검증 — 이 워커를 아무나 OpenAI 프록시로 못 쓰게 막는다.
    if (!env.PROXY_SECRET || req.headers.get('X-Proxy-Auth') !== env.PROXY_SECRET) {
      return new Response('unauthorized', { status: 401 });
    }
    const id = env.US_PROXY.idFromName('us-egress');           // 단일 DO 인스턴스
    const stub = env.US_PROXY.get(id, { locationHint: 'wnam' }); // 미국 서부에 고정
    return stub.fetch(req);
  },
};
