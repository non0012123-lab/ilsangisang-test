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

// ★★ 총량 한도(2026-11-26 실측으로 정정): 위 "메시지 1개 한도"는 오진이었다. 실제로는 input **합계**가
//   약 6.3만 토큰을 넘으면 OpenAI 가 오류 없이 **앞쪽 메시지부터** 버리고 마지막 약 6.3만 토큰만 모델에 준다
//   (6만 자×2=62.7K 전부 전달, ×3=62.7K 에서 멈추고 첫 메시지 소실, 3만 자×8=앞 4개 소실).
//   메시지를 쪼개는 것으로는 막을 수 없고, 맨 앞에 둔 규칙·스키마가 제일 먼저 사라져 모델이 키를 지어낸다.
//   → 각 함수는 "규칙+컨텍스트+대화" 합계를 MAX_INPUT_CHARS 아래로 스스로 줄여서 보내야 한다.
//   이 프로젝트 데이터(한국어+id+URL+순위)는 실측 0.5~0.6 토큰/자 → 7.5만 자 ≈ 3.8만~4.5만 토큰(한도 대비 30% 안팎 여유).
export const MAX_INPUT_CHARS = 75000;

// 줄 경계로 maxChars 이하가 되게 자르고, 잘렸으면 몇 줄이 빠졌는지 끝에 적는다(모델이 "없다"고 단정하지 않게).
export function clipLines(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const lines = text.split('\n');
  const kept: string[] = [];
  let len = 0;
  for (const l of lines) {
    if (len + l.length + 1 > maxChars) break;
    kept.push(l); len += l.length + 1;
  }
  if (kept.length === 0) return `${text.slice(0, Math.max(0, maxChars))}\n(이하 생략 — 분량 제한)`;
  return `${kept.join('\n')}\n(이하 ${lines.length - kept.length}줄 생략 — 분량 제한. 필요하면 범위를 좁혀 다시 요청)`;
}

// 입력 소실 감지(사후 안전망 — 1차 방어는 보내기 전 MAX_INPUT_CHARS 예산 관리).
//  ① 통째 소실: input_tokens 가 보낸 문자수 대비 터무니없이 작다(chars/20 미만).
//  ② 앞부분 잘림: 보낸 분량이 한도를 넘는데(약 0.5 토큰/자 기준) input_tokens 가 한도 근처에서 멈췄다.
//     잘린 뒤 토큰은 5.5만~6.3만으로 "그럴듯한" 값이라 ①만으로는 절대 안 잡힌다.
export function inputWasDropped(data: unknown, sentChars: number): boolean {
  const tokens = (data as { usage?: { input_tokens?: number } })?.usage?.input_tokens;
  if (typeof tokens !== 'number') return false;
  if (tokens < sentChars / 20) return true;
  return sentChars > 110000 && tokens < 66000 && tokens < sentChars * 0.42;
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
