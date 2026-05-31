// ───────────────────────────────────────────────────────────────
// Cloudflare Pages Function:  POST /api/ai-vendor
//  • 대화형/붙여넣기 텍스트를 받아 외주사(아웃소싱 파트너) 정보로
//    구조화한다. 서비스는 드롭다운이 아니라 자유 서술로 정리한다.
//  • 프론트에서 사용자가 미리보기 후 "적용"하면 등록된다.
//
// 환경변수: OPENAI_API_KEY (필수), OPENAI_MODEL (선택, 기본 gpt-5.5)
// ───────────────────────────────────────────────────────────────

interface Env {
  OPENAI_API_KEY: string;
  OPENAI_MODEL?: string;
}

interface VendorRequest {
  rawText?: string;
  instruction?: string;
  knownVendors?: string[];
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

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

const asString = (v: unknown): string => (typeof v === 'string' ? v : '');

export const onRequestPost = async (context: { request: Request; env: Env }): Promise<Response> => {
  const { request, env } = context;

  if (!env.OPENAI_API_KEY) {
    return json({ error: 'OPENAI_API_KEY 가 설정되지 않았습니다. Cloudflare Pages 환경변수를 확인하세요.' }, 500);
  }

  let req: VendorRequest;
  try {
    req = await request.json();
  } catch {
    return json({ error: '잘못된 요청 본문입니다.' }, 400);
  }

  const rawText = (req.rawText ?? '').trim();
  const instruction = (req.instruction ?? '').trim();
  if (!rawText && !instruction) return json({ error: '분석할 내용(붙여넣기 또는 지시)이 비어 있습니다.' }, 400);

  const developer = [
    '너는 한국 마케팅 대행사의 외주사(아웃소싱 파트너) 정보 정리 도우미다. 입력 설명/자료를 분석해 외주사 정보를 구조화한다.',
    '외주사는 자체적으로 못 하는 작업(영수증리뷰, 앱설치, 앱후기, 체험단, 기자단 등)을 맡기는 외부 업체다.',
    '반드시 아래 JSON 객체로만 응답해(코드펜스·설명문 금지):',
    '{',
    '  "summary": "1~2문장 한국어 요약",',
    '  "name": "외주사명",',
    '  "services": "제공 서비스 자유 서술(예: 영수증리뷰, 앱설치, 앱후기). 드롭다운/코드값이 아니라 사람이 읽는 자연스러운 문장/목록으로.",',
    '  "contactPerson": "담당자명",',
    '  "phone": "",',
    '  "email": "",',
    '  "pricing": "단가/정산 정보(있으면)",',
    '  "notes": "특이사항/메모"',
    '}',
    '',
    '규칙:',
    '- 입력에서 외주사명을 반드시 찾아 name 에 넣는다(없으면 빈 문자열).',
    '- services 는 가장 중요하다. 입력에 언급된 모든 서비스를 빠짐없이 자유 서술로 담는다. 임의 분류 코드로 바꾸지 말 것.',
    '- 아는 정보만 채우고 모르면 빈 문자열. 절대 지어내지 말 것.',
    Array.isArray(req.knownVendors) && req.knownVendors.length
      ? `- 이미 등록된 외주사(중복 참고): ${req.knownVendors.slice(0, 200).join(', ')}. 같은 곳으로 보이면 그 이름을 그대로 사용.` : '',
    '- 모든 텍스트는 자연스러운 한국어로.',
  ].filter(Boolean).join('\n');

  const userInput = [
    instruction ? `[추가 지시]\n${instruction}` : '',
    rawText ? `[자료/설명]\n${rawText.slice(0, 12000)}` : '',
  ].filter(Boolean).join('\n\n');

  let aiRes: Response;
  try {
    aiRes = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL || 'gpt-5.5',
        input: [
          { role: 'developer', content: [{ type: 'input_text', text: developer }] },
          { role: 'user', content: [{ type: 'input_text', text: userInput }] },
        ],
        text: { format: { type: 'json_object' } },
        reasoning: { effort: 'low' },
        store: false,
      }),
    });
  } catch (e) {
    return json({ error: `OpenAI 요청 실패: ${e instanceof Error ? e.message : '네트워크 오류'}` }, 502);
  }

  if (!aiRes.ok) {
    const detail = await aiRes.text();
    return json({ error: `OpenAI 오류 (${aiRes.status})`, detail: detail.slice(0, 500) }, 502);
  }

  const data = await aiRes.json();
  const content = extractText(data);
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content);
  } catch {
    return json({ error: 'AI 응답을 JSON 으로 해석하지 못했습니다.' }, 502);
  }

  return json({
    summary: asString(parsed.summary),
    name: asString(parsed.name),
    services: asString(parsed.services),
    contactPerson: asString(parsed.contactPerson),
    phone: asString(parsed.phone),
    email: asString(parsed.email),
    pricing: asString(parsed.pricing),
    notes: asString(parsed.notes),
  });
};
