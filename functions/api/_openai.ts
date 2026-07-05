// OpenAI 호출 라우팅 헬퍼. (_ 접두사 = 라우트 아님, import 전용)
//
// 문제: Cloudflare Pages Functions 가 홍콩(HKG) colo 에서 실행되면 OpenAI 가 403(unsupported_country)로 거부.
//   Smart Placement 는 '단일 fetch' 함수를 미국으로 옮기지 않아(휴리스틱) 간헐 차단이 남았다.
// 해결: OPENAI_PROXY_URL 이 설정되면 OpenAI 대신 '미국 고정' 프록시 워커로 보낸다.
//   프록시는 Durable Object(locationHint 'wnam')에서 OpenAI 를 호출 → 미국 IP egress → 지역차단 회피.
//   (proxy-worker/ 참고. OPENAI_PROXY_URL 미설정이면 기존처럼 api.openai.com 직접 호출 = 안전 폴백.)

export interface OpenAiRouteEnv {
  OPENAI_PROXY_URL?: string;     // 예: https://ilsangisang-openai-proxy.<sub>.workers.dev (미설정=직접 호출)
  OPENAI_PROXY_SECRET?: string;  // 프록시 인증용 공유 시크릿(프록시의 PROXY_SECRET 과 동일해야 함)
}

// OpenAI 엔드포인트로 요청한다. path 는 '/v1/responses' 처럼 슬래시로 시작.
//  • 프록시 사용 시 base 를 프록시 URL 로 바꾸고 X-Proxy-Auth 헤더를 얹는다(그 외 init 은 그대로).
//  • Authorization(Bearer OPENAI_API_KEY) 은 호출부가 init.headers 에 담아 그대로 전달된다.
export function openaiFetch(env: OpenAiRouteEnv, path: string, init: RequestInit): Promise<Response> {
  const proxy = env.OPENAI_PROXY_URL;
  const base = (proxy || 'https://api.openai.com').replace(/\/$/, '');
  const headers = new Headers(init.headers as HeadersInit | undefined);
  if (proxy && env.OPENAI_PROXY_SECRET) headers.set('X-Proxy-Auth', env.OPENAI_PROXY_SECRET);
  return fetch(`${base}${path}`, { ...init, headers });
}
