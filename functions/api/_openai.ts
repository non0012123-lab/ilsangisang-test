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

// ── 대형 메시지 소실 방지 (ai-assistant 에서 실측·해결한 패턴의 공용화) ──────────
// OpenAI Responses API 는 input 메시지 1개가 약 11만 자(≈6.4만 토큰)를 넘으면 "오류 없이"
// 그 메시지를 통째로 무시한다(usage.input_tokens 가 질문 한 줄 분량으로 추락). 모델은 지침·데이터
// 없이 임의 JSON 을 지어내고, 화면엔 빈 응답이 뜬다. → 메시지를 한계 아래 여러 개로 쪼개 보낸다.
const MSG_CHUNK_CHARS = 60000; // 한계(약 11만 자)의 절반 수준 — 줄 경계로 자르므로 여유를 둔다

// 긴 텍스트를 줄 경계 기준 MSG_CHUNK_CHARS 이하 덩어리로 분할(한 줄이 한계를 넘으면 강제 분할).
export function chunkText(text: string): string[] {
  if (text.length <= MSG_CHUNK_CHARS) return [text];
  const chunks: string[] = [];
  let buf = '';
  for (const line of text.split('\n')) {
    const pieces = line.length > MSG_CHUNK_CHARS
      ? Array.from({ length: Math.ceil(line.length / MSG_CHUNK_CHARS) }, (_, i) => line.slice(i * MSG_CHUNK_CHARS, (i + 1) * MSG_CHUNK_CHARS))
      : [line];
    for (const piece of pieces) {
      if (buf && buf.length + piece.length + 1 > MSG_CHUNK_CHARS) { chunks.push(buf); buf = piece; }
      else buf = buf ? `${buf}\n${piece}` : piece;
    }
  }
  if (buf) chunks.push(buf);
  return chunks;
}

// Responses API 의 input 메시지 배열을 만든다 — 긴 텍스트는 같은 role 메시지 여러 개로 분할.
export function toInputMessages(role: 'developer' | 'user', text: string): { role: string; content: { type: string; text: string }[] }[] {
  return chunkText(text).map(t => ({ role, content: [{ type: 'input_text', text: t }] }));
}

// 입력 소실 감지: 응답 usage.input_tokens 가 보낸 문자수 대비 터무니없이 작으면(한국어 ≈ 0.5~0.6
// 토큰/자, chars/20 은 정상에선 절대 안 걸리는 보수 기준) 메시지가 버려진 것이다.
export function inputWasDropped(data: unknown, sentChars: number): boolean {
  const tokens = (data as { usage?: { input_tokens?: number } })?.usage?.input_tokens;
  return typeof tokens === 'number' && tokens < sentChars / 20;
}

// 소실 시 사용자에게 돌려줄 공통 안내문.
export const INPUT_DROPPED_MSG = '전달할 내용이 너무 커서 AI 에 전달되지 못했습니다. 범위(업체·기간·분량)를 줄여 다시 시도해 주세요.';

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
