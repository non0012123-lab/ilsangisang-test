// ───────────────────────────────────────────────────────────────
// Cloudflare Pages Function:  POST /api/ai-assistant
//  • 대시보드 AI 어시스턴트. 대화형으로 일정 관련 질문에 답하고,
//    필요하면 일정 생성(entries)·기존 일정 변경(updates) 액션을 제안한다.
//  • 내부 시스템 맥락(현재 일정·담당자·업체·카테고리)을 받아 근거 있는 답을 한다.
//  • 등록/변경은 프론트에서 사용자가 "적용"을 눌러야 반영된다.
//
// 환경변수: OPENAI_API_KEY (필수), OPENAI_MODEL (선택, 기본 gpt-5.5)
// ───────────────────────────────────────────────────────────────

interface Env {
  OPENAI_API_KEY: string;
  OPENAI_MODEL?: string;
}

interface CtxEntry {
  id: string;
  date: string;
  endDate?: string | null;
  managerName?: string;
  clientName?: string;
  category?: string;
  keyword?: string;
  status?: string;
}

interface CtxHandover {
  clientName?: string;
  overview?: string;
  guidelines?: string;
  tone?: string;
  dontDo?: string;
  specialNotes?: string;
  managerMemo?: string;
}

interface CtxAiPlan {
  clientName?: string;
  campaignType?: string;
  period?: { start?: string; end?: string };
  report?: string;
}

interface CtxVendor {
  name?: string;
  services?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  pricing?: string;
  notes?: string;
}

interface AssistantRequest {
  message?: string;
  history?: { role: 'user' | 'assistant'; text: string }[];
  today?: string;
  managers?: string[];
  clients?: string[];
  categories?: string[];
  entries?: CtxEntry[];
  handoverDocs?: CtxHandover[];
  aiPlans?: CtxAiPlan[];
  vendors?: CtxVendor[];
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

// OpenAI Responses API 출력에서 텍스트만 추출
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

export const onRequestPost = async (context: { request: Request; env: Env }): Promise<Response> => {
  const { request, env } = context;

  if (!env.OPENAI_API_KEY) {
    return json({ error: 'OPENAI_API_KEY 가 설정되지 않았습니다. Cloudflare Pages 환경변수를 확인하세요.' }, 500);
  }

  let req: AssistantRequest;
  try {
    req = await request.json();
  } catch {
    return json({ error: '잘못된 요청 본문입니다.' }, 400);
  }
  if (!req.message || !req.message.trim()) return json({ error: '입력 메시지가 비어 있습니다.' }, 400);

  const today = req.today || new Date().toISOString().slice(0, 10);
  const managers = req.managers ?? [];
  const clients = req.clients ?? [];
  const categories = req.categories ?? [];
  const entries = (Array.isArray(req.entries) ? req.entries : []).slice(0, 400);
  const handoverDocs = (Array.isArray(req.handoverDocs) ? req.handoverDocs : []).slice(0, 60);
  const aiPlans = (Array.isArray(req.aiPlans) ? req.aiPlans : []).slice(0, 20);

  // 업체별 가이드라인 컨텍스트: 인수인계 문서의 운영 규칙·톤·금지사항 등을 정리
  const guidelineContext = handoverDocs
    .map(d => {
      const parts = [
        d.overview ? `개요: ${d.overview}` : '',
        d.guidelines ? `운영 가이드라인: ${d.guidelines}` : '',
        d.tone ? `톤앤매너: ${d.tone}` : '',
        d.dontDo ? `절대 하지 말 것: ${d.dontDo}` : '',
        d.specialNotes ? `특이사항: ${d.specialNotes}` : '',
        d.managerMemo ? `인수인계 메모: ${d.managerMemo}` : '',
      ].filter(Boolean).join('\n  ');
      return parts ? `■ ${d.clientName || '(업체명 미상)'}\n  ${parts}` : '';
    })
    .filter(Boolean)
    .join('\n\n');

  // AI 기획 결과 컨텍스트: 업체별 캠페인 기획 리포트 요약(가이드라인 보강용)
  const aiPlanContext = aiPlans
    .map(p => {
      const period = p.period?.start ? `${p.period.start} ~ ${p.period?.end ?? ''}` : '';
      const report = (p.report || '').slice(0, 2000);
      return report
        ? `■ ${p.clientName || '(업체명 미상)'}${p.campaignType ? ` · ${p.campaignType}` : ''}${period ? ` · ${period}` : ''}\n  ${report}`
        : '';
    })
    .filter(Boolean)
    .join('\n\n');

  // 외주사 컨텍스트: "○○ 작업 어디에 맡겨?" 류 질문의 근거
  const vendors = (Array.isArray(req.vendors) ? req.vendors : []).slice(0, 80);
  const vendorContext = vendors
    .map(v => {
      const parts = [
        v.services ? `서비스: ${v.services}` : '',
        v.contactPerson ? `담당: ${v.contactPerson}` : '',
        v.phone ? `연락처: ${v.phone}` : '',
        v.email ? `이메일: ${v.email}` : '',
        v.pricing ? `단가/정산: ${v.pricing}` : '',
        v.notes ? `메모: ${v.notes}` : '',
      ].filter(Boolean).join(' · ');
      return v.name ? `■ ${v.name}${parts ? `\n  ${parts}` : ''}` : '';
    })
    .filter(Boolean)
    .join('\n');

  const developer = [
    '너는 한국 마케팅 대행사의 일정 관리 AI 어시스턴트다. 항상 한국어로, 친절하고 간결하게 답한다.',
    '반드시 아래 JSON 객체로만 응답해(코드펜스·설명문 금지):',
    '{',
    '  "reply": "사용자에게 보여줄 자연스러운 한국어 답변",',
    '  "entries": [ { "date":"YYYY-MM-DD", "endDate":"YYYY-MM-DD 또는 null", "managerName":"", "clientName":"", "category":"", "keyword":"", "status":"pending|in-progress|completed" } ],',
    '  "updates": [ { "id":"기존 일정 id", "date":"YYYY-MM-DD 또는 null", "endDate":"YYYY-MM-DD 또는 null", "managerName":"문자열 또는 null", "status":"상태 또는 null" } ],',
    '  "deletes": [ "삭제할 기존 일정 id" ],',
    '  "clients": [ { "name":"", "industry":"", "categories":[], "contactPerson":"", "phone":"", "email":"" } ],',
    '  "handovers": [ { "clientName":"", "overview":"" } ],',
    '  "vendors": [ { "name":"", "services":"", "contactPerson":"", "phone":"", "email":"", "pricing":"", "notes":"" } ],',
    '  "keywords": [ "조회수를 조회할 키워드" ]',
    '}',
    '',
    '판단 규칙:',
    `- 오늘 날짜는 ${today}. "오늘/내일/이번주/다음주 월요일/0월 0일" 등 상대·축약 표현은 이 날짜 기준 절대 날짜(YYYY-MM-DD)로 변환.`,
    '- 사용자가 새 일정을 말하면("오늘 스케줄은 ~~~ 있어" 등) 해당 일정을 entries 배열에 담는다. 한 문장에 여러 건이면 모두.',
    '- 단순 질문·조언("시간 분배 어떻게 효율적일까?" 등)이면 모든 액션 배열은 비우고 reply 에만 구체적이고 실용적으로 답한다. 현재 일정 목록을 근거로 답할 것.',
    '- "배분/재배치/나눠줘" 요청이면, 아래 현재 일정을 참고해 날짜·담당자를 합리적으로 분산한다. 기존 일정을 옮기는 것은 updates(그 일정의 id 사용), 새로 만드는 것은 entries 에 담는다. 변경하지 않는 필드는 null.',
    '- 일정 삭제/취소("6/10 현대자동차 블로그관리 삭제해줘", "○○ 일정 취소해줘", "방금 추가한 거 삭제" 등): 아래 현재 일정 목록에서 날짜·업체·카테고리·키워드로 가장 잘 맞는 일정을 찾아 그 id 를 deletes 배열에 담는다. 여러 건이 맞으면 모두 담는다. 일치하는 게 없거나 어느 것인지 모호하면 삭제하지 말고 reply 에서 어떤 일정인지 되묻는다. 삭제는 되돌리기 어려우니, reply 에 무엇을 삭제할지 명확히 적고 "적용"을 눌러야 반영된다고 안내한다.',
    '- "방금 적용한 거 취소/되돌려줘"처럼 직전 적용 자체를 되돌리는 요청이면, 일정 id 를 추측해 deletes 에 넣지 말고, reply 에서 "적용된 메시지의 \'실행 취소\' 버튼을 눌러주세요"라고 안내한다(임의 삭제 방지).',
    '- 신규 업체(클라이언트) 등록: 사용자가 새 업체 등록을 원하거나, 일정/인수인계를 만들려는 업체가 아래 "업체 목록"에 없으면 clients 에 그 업체를 담아 먼저 등록을 제안한다. 그리고 그 업체명을 entries/handovers 의 clientName 에 그대로 사용한다(적용 시 신규 업체가 먼저 생성된 뒤 연결됨). 아는 정보만 채우고 모르면 빈 문자열.',
    '- 인수인계 문서 신규 등록: 사용자가 특정 업체의 인수인계 문서를 만들어 달라고 하면 handovers 에 담는다(overview 에 간단 요약 가능).',
    '- 업체 가이드라인 질문("○○ 업체 가이드라인 알려줘", "스타벅스 톤앤매너는?", "△△ 운영 규칙/주의사항 뭐야?" 등): 아래 "업체 가이드라인(인수인계)"과 "AI 기획 결과 요약"을 근거로 해당 업체의 운영 가이드라인·톤앤매너·금지사항·특이사항·기획 방향을 정리해 reply 에 답한다. 이때는 모든 액션 배열(entries/updates/clients/handovers)을 비운다(등록이 아니라 조회·요약이므로).',
    '- 가이드라인을 답할 때는 인수인계 문서의 내용을 우선하고, AI 기획 결과의 캠페인 방향·톤을 보조적으로 덧붙인다. 해당 업체 정보가 아래에 없으면 지어내지 말고 "등록된 인수인계/기획 정보가 없다"고 안내한다.',
    '- 외주사 질문("영수증리뷰 어디에 맡겨?", "앱설치 외주 어디 있어?", "○○ 작업 외주사 추천" 등): 아래 "외주사 목록"에서 해당 서비스를 제공하는 외주사를 찾아 업체명·담당자·연락처·단가/메모를 reply 에 정리해 답한다. 여러 곳이면 모두 제시. 이때 모든 액션 배열은 비운다(조회·추천이므로). 맞는 외주사가 없으면 지어내지 말고 "등록된 외주사가 없다"고 안내한다.',
    '- 외주사 등록: 사용자가 새 외주사를 자연어로 등록하려 하면("○○ 외주사 추가해줘. 영수증리뷰·앱설치 가능, 담당 …") vendors 에 담는다. services 는 정해진 코드가 아니라 자유 서술로, 입력에 언급된 서비스를 빠짐없이 담는다. 아는 정보만 채우고 모르면 빈 문자열. reply 에는 무엇을 등록할지 요약하고 "적용"을 안내한다.',
    '- 키워드 조회수 질문("○○ 키워드 조회수 알려줘", "△△ 검색량 얼마야?", "□□ 모바일/PC 조회수"): 실제 수치는 네이버 키워드도구로 따로 조회하므로, 너는 절대 숫자를 지어내지 말고 조회할 키워드만 keywords 배열에 담는다(여러 개면 모두). reply 에는 "조회수를 조회해 아래에 표시할게요" 정도로 짧게 답하고 다른 액션 배열은 비운다.',
    '- managerName 은 아래 "담당자 목록" 중 가장 가까운 값, clientName 은 "업체 목록"(또는 이번에 새로 만들 clients 의 이름) 중 가장 가까운 값. category 는 "카테고리 목록" 중 하나(애매하면 "기타").',
    '- 기간 작업이 아니면 endDate 는 null. status 미지정이면 "pending".',
    '- 액션(entries/updates/clients/handovers)을 제안할 때 reply 에는 무엇을 제안하는지 요약하고, 사용자가 "적용" 버튼을 눌러야 실제 반영된다는 뉘앙스로 안내한다.',
    '- 확실하지 않은 정보를 지어내지 말 것. 모르면 reply 에서 추가 정보를 요청.',
    '',
    `담당자 목록: ${managers.join(', ') || '(없음)'}`,
    `업체 목록: ${clients.join(', ') || '(없음)'}`,
    `카테고리 목록: ${categories.join(', ')}`,
    '',
    '현재 등록된 일정(JSON, id 포함 — updates 에 이 id 사용):',
    JSON.stringify(entries),
    '',
    '업체 가이드라인(인수인계 문서 — 가이드라인 질문의 1차 근거):',
    guidelineContext || '(등록된 인수인계 가이드라인 없음)',
    '',
    'AI 기획 결과 요약(업체별 캠페인 방향 — 가이드라인 보조 근거):',
    aiPlanContext || '(등록된 AI 기획 결과 없음)',
    '',
    '외주사 목록(서비스별 외주 추천의 근거):',
    vendorContext || '(등록된 외주사 없음)',
  ].join('\n');

  // 대화 맥락을 하나의 사용자 메시지(트랜스크립트)로 합쳐 전달
  const transcript = [
    ...(Array.isArray(req.history) ? req.history : []).slice(-8).map(m => `${m.role === 'user' ? '사용자' : '어시스턴트'}: ${m.text}`),
    `사용자: ${req.message}`,
  ].join('\n');

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
          { role: 'user', content: [{ type: 'input_text', text: transcript }] },
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
  let parsed: { reply?: string; entries?: unknown; updates?: unknown; clients?: unknown; handovers?: unknown; vendors?: unknown; keywords?: unknown; deletes?: unknown };
  try {
    parsed = JSON.parse(content);
  } catch {
    return json({ error: 'AI 응답을 JSON 으로 해석하지 못했습니다.' }, 502);
  }

  return json({
    reply: typeof parsed?.reply === 'string' ? parsed.reply : '',
    entries: Array.isArray(parsed?.entries) ? parsed.entries : [],
    updates: Array.isArray(parsed?.updates) ? parsed.updates : [],
    clients: Array.isArray(parsed?.clients) ? parsed.clients : [],
    handovers: Array.isArray(parsed?.handovers) ? parsed.handovers : [],
    vendors: Array.isArray(parsed?.vendors) ? parsed.vendors : [],
    keywords: Array.isArray(parsed?.keywords) ? parsed.keywords.filter((k: unknown) => typeof k === 'string' && k.trim()).slice(0, 20) : [],
    deletes: Array.isArray(parsed?.deletes) ? parsed.deletes.filter((d: unknown) => typeof d === 'string' && d.trim()).slice(0, 50) : [],
  });
};
