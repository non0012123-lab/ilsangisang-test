// ───────────────────────────────────────────────────────────────
// Cloudflare Pages Function:  POST /api/ai-image
//  • AI 기획 결과 화면의 "이미지 시안 생성" 이 호출한다.
//  • OpenAI Images API (gpt-image-2) 로 가이드라인 기반 광고 시안을 만든다.
//    블로그 2장 + SNS 2장(총 4장)을 병렬 생성해 base64(data URL)로 반환.
//
// 환경변수:
//  • OPENAI_API_KEY      (필수, Secret)
//  • OPENAI_IMAGE_MODEL  (선택, 기본 gpt-image-2)
// ───────────────────────────────────────────────────────────────

interface Env {
  OPENAI_API_KEY: string;
  OPENAI_IMAGE_MODEL?: string;
}

interface ImageRequest {
  clientName?: string;
  guideline?: string; // 업로드한 가이드라인 텍스트
}

interface Channel { key: string; label: string; framing: string }

// 생성할 채널 시안 (각 2장)
const CHANNELS: Channel[] = [
  { key: '블로그', label: '블로그', framing: '블로그 대표 이미지/썸네일용 가로형 디자인' },
  { key: 'SNS', label: 'SNS', framing: '인스타그램 피드용 정사각형 디자인' },
];

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

function buildPrompt(channel: Channel, clientName: string, guideline: string): string {
  return [
    '너는 광고 디자인 전문가야.',
    `다음 가이드라인을 참고해서 "${clientName}"에 어울리는 ${channel.framing} 시안(초안)을 만들어줘.`,
    '가이드라인의 톤앤매너를 반영하고, 금지표현(특히 의료법 등 규제 위반 소지가 있는 문구)은 절대 넣지 마.',
    '이미지 안의 텍스트는 최소화하고, 넣을 경우 자연스러운 한국어로.',
    '',
    '── 가이드라인 ──',
    (guideline || '(가이드라인 텍스트 없음)').slice(0, 4000),
  ].join('\n');
}

// 채널 1개당 이미지 2장 생성
async function generate(env: Env, channel: Channel, clientName: string, guideline: string) {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.OPENAI_IMAGE_MODEL || 'gpt-image-2',
      prompt: buildPrompt(channel, clientName, guideline),
      n: 2,
      size: 'auto',
      quality: 'auto',
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`${channel.label} 이미지 생성 실패 (${res.status}): ${detail.slice(0, 300)}`);
  }
  const data = await res.json();
  const list = Array.isArray(data?.data) ? data.data : [];
  return list
    .map((d: any) => d?.b64_json)
    .filter((b: unknown): b is string => typeof b === 'string')
    .map((b64: string) => ({ channel: channel.label, url: `data:image/png;base64,${b64}` }));
}

export const onRequestPost = async (context: { request: Request; env: Env }): Promise<Response> => {
  const { request, env } = context;

  if (!env.OPENAI_API_KEY) {
    return json({ error: 'OPENAI_API_KEY 가 설정되지 않았습니다. Cloudflare Pages 환경변수를 확인하세요.' }, 500);
  }

  let req: ImageRequest;
  try {
    req = await request.json();
  } catch {
    return json({ error: '잘못된 요청 본문입니다.' }, 400);
  }

  const clientName = req.clientName || '해당 업체';
  const guideline = req.guideline || '';

  try {
    // 블로그 / SNS 시안을 병렬로 생성
    const results = await Promise.all(CHANNELS.map(ch => generate(env, ch, clientName, guideline)));
    const images = results.flat();
    if (images.length === 0) return json({ error: '생성된 이미지가 없습니다.' }, 502);
    return json({ images });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : '이미지 생성 중 오류가 발생했습니다.' }, 502);
  }
};
