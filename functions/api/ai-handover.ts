// ───────────────────────────────────────────────────────────────
// Cloudflare Pages Function:  POST /api/ai-handover
//  • 대화형/붙여넣기 텍스트(기존 엑셀·PPT 내용 등)를 받아, 인수인계
//    문서의 항목(개요·가이드라인·톤·금지사항·특이사항·메모·연락처·링크)으로
//    구조화해 돌려준다. 프론트에서 사용자가 미리보기 후 "적용"한다.
//
// 환경변수: OPENAI_API_KEY (필수), OPENAI_MODEL (선택, 기본 gpt-5.5)
// ───────────────────────────────────────────────────────────────

interface Env {
  OPENAI_API_KEY: string;
  OPENAI_MODEL?: string;
}

interface ExistingDoc {
  overview?: string;
  guidelines?: string;
  tone?: string;
  dontDo?: string;
  specialNotes?: string;
  managerMemo?: string;
}

interface HandoverRequest {
  clientName?: string;
  rawText?: string;     // 붙여넣은 파일 내용 또는 대화형 입력
  instruction?: string; // 추가 지시(선택)
  existing?: ExistingDoc; // 기존 인수인계 내용(병합 참고용)
  createClient?: boolean; // true 면 신규 업체 기본정보(client)도 함께 추출
  knownClients?: string[]; // 기존 업체명 목록(중복 판단 참고)
}

const CATEGORIES = ['SNS', '유튜브', '네이버', '영상제작', '디자인제작', '네이버 여론작업', '기타'];

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

  let req: HandoverRequest;
  try {
    req = await request.json();
  } catch {
    return json({ error: '잘못된 요청 본문입니다.' }, 400);
  }

  const rawText = (req.rawText ?? '').trim();
  const instruction = (req.instruction ?? '').trim();
  if (!rawText && !instruction) return json({ error: '분석할 내용(붙여넣기 또는 지시)이 비어 있습니다.' }, 400);

  const createClient = req.createClient === true;
  const clientName = req.clientName || '(업체명 미상)';
  const existing = req.existing ?? {};

  const developer = [
    '너는 한국 마케팅 대행사의 인수인계 문서 작성 도우미다. 입력으로 받은 자료(기존 인수인계 파일에서 붙여넣은 내용, 엑셀/PPT 텍스트, 또는 대화형 설명)를 분석해 인수인계 문서 항목으로 정리한다.',
    '반드시 아래 JSON 객체로만 응답해(코드펜스·설명문 금지):',
    '{',
    '  "summary": "무엇을 어떻게 정리했는지 1~3문장 한국어 요약",',
    createClient ? '  "client": { "name":"업체명", "industry":"업종", "contactPerson":"대표 담당자명", "email":"", "phone":"", "categories":[], "reportAnchorDate":"YYYY-MM-DD 또는 빈문자열(월간 보고 기준 시작일)" },' : '',
    '  "overview": "업체 개요 및 현황",',
    '  "guidelines": "운영 가이드라인(게시 빈도, 컨펌 프로세스, 규칙 등)",',
    '  "tone": "톤앤매너(브랜드 보이스, 말투, 이모지 사용 등)",',
    '  "dontDo": "절대 하지 말 것(금지 단어, 민감 주제 등)",',
    '  "specialNotes": "특이사항(시즌 이벤트, 중요 날짜 등)",',
    '  "managerMemo": "전임 담당자 인수인계 메모(실무 팁)",',
    '  "keyContacts": [ { "name":"", "role":"", "phone":"", "email":"", "notes":"" } ],',
    '  "importantLinks": [ { "title":"", "url":"", "category":"", "notes":"" } ]',
    '}',
    '',
    '규칙:',
    createClient
      ? '- 이 요청은 "신규 업체 등록 + 인수인계"를 한 번에 만드는 것이다. 입력에서 업체명을 반드시 찾아 client.name 에 넣는다(없으면 빈 문자열). industry/contactPerson/email/phone 은 아는 것만 채우고 모르면 빈 문자열.'
      : `- 대상 업체: ${clientName}.`,
    createClient ? `- client.categories 는 다음 중에서만 고른다: ${CATEGORIES.join(', ')}. 입력에 언급된 진행 채널에 맞게 0개 이상 선택.` : '',
    createClient ? '- 보고 기준일/정산일/계약 시작일이 언급되면 client.reportAnchorDate 에 YYYY-MM-DD 로 넣는다(이 날짜 기준 30일 주기로 월간 보고서 자동 생성). 없으면 빈 문자열.' : '',
    createClient && Array.isArray(req.knownClients) && req.knownClients.length
      ? `- 이미 등록된 업체명 목록(중복 참고): ${req.knownClients.slice(0, 200).join(', ')}. 같은 업체로 보이면 그 이름을 그대로 사용한다.` : '',
    '- 입력 자료에 근거해 각 항목을 채운다. 해당 정보가 없으면 그 항목은 빈 문자열(배열은 빈 배열)로 둔다. 절대 지어내지 말 것.',
    '- 표·목록 형태(엑셀/PPT)에서 연락처(이름·직함·전화·이메일)와 링크(URL)를 발견하면 keyContacts / importantLinks 로 구조화한다.',
    '- 기존 인수인계 내용이 주어지면, 새 자료에서 보강·추가되는 부분 위주로 정리하되 기존의 유효한 내용을 함부로 삭제하지 말고 통합한다.',
    '- 모든 텍스트는 자연스러운 한국어로. 군더더기 없이 실무적으로.',
    '',
    '기존 인수인계 내용(참고, 통합 대상):',
    JSON.stringify({
      overview: asString(existing.overview), guidelines: asString(existing.guidelines),
      tone: asString(existing.tone), dontDo: asString(existing.dontDo),
      specialNotes: asString(existing.specialNotes), managerMemo: asString(existing.managerMemo),
    }),
  ].filter(Boolean).join('\n');

  const userInput = [
    instruction ? `[추가 지시]\n${instruction}` : '',
    rawText ? `[자료 내용]\n${rawText.slice(0, 12000)}` : '',
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

  const contacts = Array.isArray(parsed.keyContacts) ? parsed.keyContacts : [];
  const links = Array.isArray(parsed.importantLinks) ? parsed.importantLinks : [];
  const rawClient = (parsed.client && typeof parsed.client === 'object') ? parsed.client as Record<string, unknown> : null;
  const client = createClient && rawClient ? {
    name: asString(rawClient.name),
    industry: asString(rawClient.industry),
    contactPerson: asString(rawClient.contactPerson),
    email: asString(rawClient.email),
    phone: asString(rawClient.phone),
    categories: (Array.isArray(rawClient.categories) ? rawClient.categories : [])
      .map((c: unknown) => asString(c)).filter((c: string) => CATEGORIES.includes(c)),
    reportAnchorDate: /^\d{4}-\d{2}-\d{2}$/.test(asString(rawClient.reportAnchorDate)) ? asString(rawClient.reportAnchorDate) : '',
  } : undefined;

  return json({
    ...(client ? { client } : {}),
    summary: asString(parsed.summary),
    overview: asString(parsed.overview),
    guidelines: asString(parsed.guidelines),
    tone: asString(parsed.tone),
    dontDo: asString(parsed.dontDo),
    specialNotes: asString(parsed.specialNotes),
    managerMemo: asString(parsed.managerMemo),
    keyContacts: contacts.map((c: Record<string, unknown>) => ({
      name: asString(c.name), role: asString(c.role), phone: asString(c.phone),
      email: asString(c.email), notes: asString(c.notes),
    })).filter((c: { name: string; role: string }) => c.name || c.role),
    importantLinks: links.map((l: Record<string, unknown>) => ({
      title: asString(l.title), url: asString(l.url),
      category: asString(l.category) || 'SNS', notes: asString(l.notes),
    })).filter((l: { title: string; url: string }) => l.title || l.url),
  });
};
