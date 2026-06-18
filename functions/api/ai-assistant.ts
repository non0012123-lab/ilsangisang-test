// ───────────────────────────────────────────────────────────────
// Cloudflare Pages Function:  POST /api/ai-assistant
//  • 대시보드 AI 어시스턴트. 대화형으로 일정 관련 질문에 답하고,
//    필요하면 일정 생성(entries)·기존 일정 변경(updates) 액션을 제안한다.
//  • 내부 시스템 맥락(현재 일정·담당자·업체·카테고리)을 받아 근거 있는 답을 한다.
//  • 등록/변경은 프론트에서 사용자가 "적용"을 눌러야 반영된다.
//
// 환경변수: OPENAI_API_KEY (필수), OPENAI_MODEL (선택, 기본 gpt-5.4-mini)
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
  link?: string | null;
  rank?: number | null;
}

interface CtxHandover {
  clientName?: string;
  overview?: string;
  guidelines?: string;
  tone?: string;
  dontDo?: string;
  specialNotes?: string;
  managerMemo?: string;
  keyContacts?: { name?: string; role?: string; phone?: string; email?: string; notes?: string }[];
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

interface CtxAccount { id?: string; name?: string; platform?: string; grade?: string; ownership?: string; username?: string; password?: string; category?: string; ip?: string }
interface CtxSite { id?: string; name?: string; url?: string; username?: string; password?: string; description?: string }

interface AssistantRequest {
  message?: string;
  history?: { role: 'user' | 'assistant'; text: string }[];
  today?: string;
  currentUser?: string; // 로그인한 본인 이름 — 담당자 미지정 시 기본 담당자, "나/내가" 매핑용
  currentUserId?: string;
  existingRequests?: CtxRequest[]; // 요청함(이미 등록된 업무 요청) — 조회용
  existingNotices?: CtxNotice[];   // 공지(팀/전체) — 조회용
  managers?: ({ name?: string; department?: string; title?: string; position?: string } | string)[];
  clients?: {
    id?: string; name?: string; industry?: string; categories?: string[]; reportAnchorDate?: string; status?: string;
    contactPerson?: string; email?: string; phone?: string; startDate?: string; contractEnd?: string; description?: string;
    monthlyBudget?: string; budgetItems?: { product?: string; amount?: number; notes?: string }[];
  }[];
  categories?: string[];
  internalCategories?: string[];  // 내부 일정 종류(회의실/미팅/면접/촬영/휴가 등)
  internalEvents?: { id?: string; title?: string; category?: string; date?: string; endDate?: string | null; startTime?: string | null; participantNames?: string[]; location?: string | null }[]; // 기존 내부 일정(수정 대상)
  entries?: CtxEntry[];
  handoverDocs?: CtxHandover[];
  aiPlans?: CtxAiPlan[];
  vendors?: CtxVendor[];
  accounts?: CtxAccount[];
  sites?: CtxSite[];
  priceTable?: CtxPriceProduct[];
  salesEnabled?: boolean;   // 영업관리 권한 여부 — true 일 때만 상담 기록을 다룬다
  sales?: CtxSales[];       // 기존 상담 목록(조회/수정 대상 식별용)
  rankGuarantees?: CtxRankG[]; // 순위 보장 캠페인(조회/수정/삭제 대상 식별용)
}

// 순위 보장 캠페인 컨텍스트 — "○○ 보장 몇 건 찼어?", "△△ 보장 종료" 등 조회/수정 근거
interface CtxRankG {
  id?: string; clientName?: string; title?: string; guaranteedCount?: number; achievedCount?: number;
  alertOffset?: number; cycle?: number; closed?: boolean; status?: string;
}

// 요청함(업무 요청) 컨텍스트 — "오늘 들어온 요청", "내가 보낸 요청" 등 조회용
interface CtxRequest {
  id?: string; fromName?: string; toName?: string; fromMe?: boolean; toMe?: boolean;
  title?: string; body?: string; status?: string; date?: string; doneNote?: string;
}

// 공지 컨텍스트 — "올라온 공지", "우리팀 공지" 조회용
interface CtxNotice {
  id?: string; audienceLabel?: string; fromName?: string; fromMe?: boolean; title?: string; body?: string; date?: string;
}

// 영업관리(상담 로그) 컨텍스트 — 권한자에게만 전달됨
interface CtxSales {
  id?: string; consultedAt?: string; handlerName?: string; channel?: string;
  phone?: string; email?: string; customerName?: string; content?: string;
  sentiment?: string; status?: string; followUpDate?: string; nasLink?: string;
  replyCount?: number; lastReply?: string;  // 답글 스레드(답글 추가 시 이 상담 id 를 부모로)
}

// 단가표(외부 마케팅 쇼핑몰에서 수집한 패키지/단일 상품 가격) — 단가/견적 질문의 근거
interface CtxPriceProduct {
  name?: string;
  category?: string;
  repPrice?: number;  // 대표가(최저가)
  options?: { n?: string; p?: number; pkg?: boolean; g?: string; d?: string }[]; // n=옵션명, p=가격(원), pkg=패키지 여부, g=패키지(그룹)명, d=설명(주의문구 포함)
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
  const currentUser = (req.currentUser || '').trim();
  // 담당자 명단: 이름 + 팀(department)·직함(title)·직책(position).
  // 문자열로 와도(구버전) 이름만 있는 것으로 취급.
  const managerList = (Array.isArray(req.managers) ? req.managers : []).map(m =>
    typeof m === 'string' ? { name: m } : (m || {}));
  const managerNames = managerList.map(m => m.name).filter(Boolean) as string[];
  // 사람 식별용 명단 줄: "홍길동 (디자인팀 · 과장 · 팀장)"
  const rosterLines = managerList
    .filter(m => m.name)
    .map(m => {
      const meta = [m.department, m.title, m.position].filter(Boolean).join(' · ');
      return `- ${m.name}${meta ? ` (${meta})` : ''}`;
    })
    .join('\n');
  const clients = (Array.isArray(req.clients) ? req.clients : []).filter(c => c && c.name);
  const clientNames = clients.map(c => c.name as string);
  const categories = req.categories ?? [];
  const internalCategories = (Array.isArray(req.internalCategories) ? req.internalCategories : []).filter(Boolean);
  const existingInternal = (Array.isArray(req.internalEvents) ? req.internalEvents : []).slice(0, 80);
  const internalEventsContext = existingInternal
    .map(e => {
      if (!e.title) return '';
      const period = e.endDate && e.endDate !== 'null' && e.endDate > (e.date ?? '') ? `${e.date}~${e.endDate}` : (e.date ?? '');
      return `■ id=${e.id ?? '?'} | ${period}${e.startTime ? ` ${e.startTime}` : ''} | ${e.category ?? ''} | ${e.title}${Array.isArray(e.participantNames) && e.participantNames.length ? ` | 참여자:${e.participantNames.join(',')}` : ''}${e.location ? ` | 장소:${e.location}` : ''}`;
    })
    .filter(Boolean).join('\n');
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
        Array.isArray(d.keyContacts) && d.keyContacts.length
          ? `담당자 연락처: ${d.keyContacts.map(k => [k.name, k.role, k.phone, k.email, k.notes].filter(Boolean).join(' / ')).filter(Boolean).join(' · ')}`
          : '',
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

  // 아이디 목록 / 홈페이지 목록 (조회·수정·삭제 시 id 사용)
  // 비밀번호는 컨텍스트에 포함하지 않는다 — 조회는 id 로 식별만 하고 실제 값은 프론트가 표시한다.
  const accounts = (Array.isArray(req.accounts) ? req.accounts : []).slice(0, 300);
  const ownLabel = (o?: string) => o === 'client' ? '업체소유' : o === 'inhouse' ? '사내' : '';
  const accountContext = accounts
    .map(a => a.name || a.username
      ? `■ id=${a.id ?? '?'} | 이름:${a.name ?? '-'}${a.platform ? ` | 구분:${a.platform}` : ''}${a.grade ? ` | 등급:${a.grade}` : ''}${a.ownership ? ` | 소유:${ownLabel(a.ownership)}` : ''} | 아이디:${a.username ?? '-'}${a.category ? ` | 카테고리:${a.category}` : ''}${a.ip ? ` | IP:${a.ip}` : ''}`
      : '')
    .filter(Boolean).join('\n');
  const sites = (Array.isArray(req.sites) ? req.sites : []).slice(0, 300);
  const siteContext = sites
    .map(s => s.name
      ? `■ id=${s.id ?? '?'} | 홈페이지:${s.name}${s.url ? ` | 주소:${s.url}` : ''} | 아이디:${s.username ?? '-'}${s.description ? ` | 용도:${s.description}` : ''}`
      : '')
    .filter(Boolean).join('\n');

  // 단가표 컨텍스트: "○○ 단가 얼마야?", "10만원 이하 패키지" 류 질문의 근거.
  const priceProducts = (Array.isArray(req.priceTable) ? req.priceTable : []).slice(0, 200);
  const won = (n?: number) => typeof n === 'number' ? `${n.toLocaleString('ko-KR')}원` : '-';
  const priceContext = priceProducts
    .map(p => {
      if (!p.name) return '';
      const opts = (Array.isArray(p.options) ? p.options : [])
        .map(o => {
          const desc = (o.d ?? '').replace(/\s*\n\s*/g, ' / ').trim();
          const label = o.g ? `${o.g} – ${o.n ?? '-'}` : (o.n ?? '-'); // 패키지면 "패키지명 – 옵션명"
          return `  · ${o.pkg ? '[패키지] ' : ''}${label}: ${won(o.p)}${desc ? `\n    └ 설명: ${desc}` : ''}`;
        })
        .join('\n');
      return `■ ${p.name}${p.category ? ` (${p.category})` : ''} — 최저가 ${won(p.repPrice)}${opts ? `\n${opts}` : ''}`;
    })
    .filter(Boolean)
    .join('\n');

  // 영업관리(상담 로그) 컨텍스트 — 권한자(salesEnabled)에게만. 조회/수정 대상 식별 근거.
  const salesEnabled = req.salesEnabled === true;
  const salesEntries = salesEnabled ? (Array.isArray(req.sales) ? req.sales : []).slice(0, 60) : [];
  const salesContext = salesEntries
    .map(s => `■ id=${s.id ?? '?'} | ${s.consultedAt ?? '-'} | 응대:${s.handlerName ?? '-'} | 채널:${s.channel ?? '-'} | 전화:${s.phone ?? '-'} | 이메일:${s.email ?? '-'} | 고객:${s.customerName ?? '-'} | 척도:${s.sentiment ?? '-'} | 상태:${s.status ?? '-'}${s.followUpDate ? ` | 후속:${s.followUpDate}` : ''} | 내용:${(s.content ?? '').slice(0, 80)}${s.replyCount ? ` | 답글 ${s.replyCount}개(최근:${s.lastReply ?? ''})` : ''}`)
    .join('\n');

  // 순위 보장 컨텍스트 — 캠페인별 목표/달성/상태. "○○ 보장 현황", "△△ 종료/연장" 근거.
  const RANKG_STATUS_LABEL: Record<string, string> = { active: '진행중', due_soon: '임박', reached: '도달', closed: '종료' };
  const rankGList = (Array.isArray(req.rankGuarantees) ? req.rankGuarantees : []).slice(0, 80);
  const rankGContext = rankGList
    .map(g => `■ id=${g.id ?? '?'} | ${g.clientName ?? '-'} · ${g.title ?? '-'} | 달성:${g.achievedCount ?? 0}/${g.guaranteedCount ?? '?'}건 | ${g.cycle ? `${g.cycle}회차 | ` : ''}상태:${RANKG_STATUS_LABEL[g.status ?? ''] ?? g.status ?? '-'}${g.closed ? '(종료)' : ''}`)
    .join('\n');

  // 요청함(업무 요청) 컨텍스트 — 받은/보낸 방향과 상태·날짜를 표기
  const REQ_STATUS_LABEL: Record<string, string> = { pending: '대기(미확인)', confirmed: '확인함(진행)', done: '완료', returned: '반려' };
  const requestList = (Array.isArray(req.existingRequests) ? req.existingRequests : []).slice(0, 80);
  const requestContext = requestList
    .map(r => `■ id=${r.id ?? '?'} | ${r.date ?? '-'} | ${r.fromName ?? '?'}${r.fromMe ? '(나)' : ''} → ${r.toName ?? '?'}${r.toMe ? '(나)' : ''} | 상태:${REQ_STATUS_LABEL[r.status ?? ''] ?? r.status ?? '-'} | ${r.title ?? ''}${r.body ? ` — ${r.body.slice(0, 50)}` : ''}${r.doneNote ? ` | 완료메모:${r.doneNote.slice(0, 50)}` : ''}`)
    .join('\n');

  // 공지(팀/전체) 컨텍스트 — 대상·작성자·날짜를 표기
  const noticeList = (Array.isArray(req.existingNotices) ? req.existingNotices : []).slice(0, 60);
  const noticeContext = noticeList
    .map(n => `■ id=${n.id ?? '?'} | ${n.date ?? '-'} | 대상:${n.audienceLabel ?? '?'} | 작성:${n.fromName ?? '?'}${n.fromMe ? '(나)' : ''} | ${n.title ?? ''}${n.body ? ` — ${n.body.slice(0, 60)}` : ''}`)
    .join('\n');

  const developer = [
    '너는 한국 마케팅 대행사의 일정 관리 AI 어시스턴트다. 항상 한국어로, 친절하고 간결하게 답한다.',
    '반드시 아래 JSON 객체로만 응답해(코드펜스·설명문 금지):',
    '{',
    '  "reply": "사용자에게 보여줄 자연스러운 한국어 답변",',
    '  "entries": [ { "date":"YYYY-MM-DD", "endDate":"YYYY-MM-DD 또는 null", "managerName":"", "clientName":"", "category":"", "keyword":"", "status":"pending|in-progress|completed", "link":"결과/키워드 링크 URL(없으면 생략)", "rank":"순위 숫자(예: 3, 언급 없으면 생략)", "recurrence":{ "freq":"daily|weekly|monthly", "interval":1, "weekday":"weekly일 때 0(일)~6(토)", "day":"monthly일 때 1~31", "count":"생성 횟수(미지정 시 생략)", "until":"YYYY-MM-DD(종료일 있으면)" } } ],',
    '  "updates": [ { "id":"기존 일정 id(아래 목록에서 정확히 복사)", "clientName":"대상 업체명(식별 보조 — id 와 함께 항상 채움)", "keyword":"대상 일정의 키워드/제목(있으면)", "matchDate":"대상 일정의 날짜 YYYY-MM-DD(변경 전 그 일정이 잡힌 날, 식별용)", "date":"새 날짜 YYYY-MM-DD 또는 null(날짜를 옮길 때만)", "endDate":"YYYY-MM-DD 또는 null", "managerName":"문자열 또는 null", "status":"상태 또는 null", "link":"링크 URL(추가/수정) 또는 ""(빈문자열=링크 삭제) 또는 null(변경 안 함)", "rank":"순위 숫자(변경) 또는 null(변경 안 함)" } ],',
    '  "deletes": [ "삭제할 기존 일정 id" ],',
    '  "clients": [ { "op":"add|update|delete", "id":"수정/삭제 시 기존 업체 id", "name":"", "industry":"", "categories":[], "contactPerson":"", "phone":"", "email":"", "status":"active|inactive|pending", "reportAnchorDate":"YYYY-MM-DD (월간 보고 기준 시작일)" } ],',
    '  "handovers": [ { "op":"add|update|delete", "id":"수정/삭제 시 기존 인수인계 id(없으면 clientName 으로 식별)", "clientName":"", "overview":"", "guidelines":"운영 가이드라인", "tone":"톤앤매너", "dontDo":"절대 하지 말 것", "specialNotes":"특이사항", "managerMemo":"인수인계 메모" } ],',
    '  "vendors": [ { "op":"add|update|delete", "id":"수정/삭제 시 기존 외주사 id(없으면 name 으로 식별)", "name":"", "services":"", "contactPerson":"", "phone":"", "email":"", "pricing":"", "notes":"" } ],',
    '  "accounts": [ { "op":"add|update|delete", "id":"수정/삭제 시 기존 id", "name":"", "platform":"블로그|SNS|유튜브|기타", "grade":"블로그 등급(준최2~준최6/최적1~최적4)", "ownership":"client|inhouse", "username":"", "password":"", "category":"", "ip":"" } ],',
    '  "sites": [ { "op":"add|update|delete", "id":"수정/삭제 시 기존 id", "name":"", "url":"", "username":"", "password":"", "description":"" } ],',
    '  "requests": [ { "op":"add|delete", "id":"회수(delete) 시 기존 요청 id", "toName":"요청 받을 담당자 이름", "title":"요청 내용 한 줄(예: 디자인 제작)", "body":"상세 설명(없으면 생략)" } ],',
    '  "notices": [ { "op":"add|delete", "id":"삭제(delete) 시 기존 공지 id", "audience":"공지 대상 — \'전체\'(전 직원) 또는 팀 이름(마케팅팀/디자인팀/영상팀/총괄팀)", "title":"공지 내용 한 줄", "body":"상세 설명(없으면 생략)" } ],',
    '  "internalEvents": [ { "op":"add|update|delete", "id":"수정/삭제 시 기존 내부일정 id", "title":"일정 제목", "category":"내부 일정 종류", "date":"YYYY-MM-DD", "endDate":"YYYY-MM-DD 또는 null", "startTime":"HH:MM(없으면 생략)", "endTime":"HH:MM(없으면 생략)", "participantNames":["참여자 이름"], "location":"장소(없으면 생략)", "notes":"메모(없으면 생략)", "reminder":"off|1h|30m|10m|onTime" } ],',
    '  "sales": [ { "op":"add|update|reply|delete", "id":"수정/답글/삭제 시 대상(부모) 상담 id", "consultedAt":"YYYY-MM-DD HH:mm 또는 YYYY-MM-DD", "channel":"phone|inquiry|referral|etc", "phone":"전화번호", "email":"이메일", "customerName":"고객/업체명", "content":"상담 내용", "sentiment":"very_positive|positive|neutral|negative|very_negative", "status":"new|absent|prospect|in_progress|done|hold", "followUpDate":"YYYY-MM-DD(있으면)", "nasLink":"첨부/자료 링크(있으면)", "result":"결과/메모(있으면)" } ],',
    '  "accountLookups": [ "조회 질문일 때 답으로 보여줄 아이디 목록 id" ],',
    '  "siteLookups": [ "조회 질문일 때 답으로 보여줄 홈페이지 id" ],',
    '  "rankGuarantees": [ { "op":"add|update|delete", "id":"수정/삭제 시 기존 순위보장 id", "clientName":"대상 업체명", "title":"상품/캠페인명(예: 네이버 자동완성 보장)", "guaranteedCount":"보장 목표 건수(정수, 기본 20)", "alertOffset":"목표 몇 건 전 알림(정수, 기본 2)", "closed":"종료면 true" } ],',
    '  "keywords": [ "조회수를 조회할 키워드" ]',
    '}',
    '',
    '판단 규칙:',
    `- 오늘 날짜는 ${today}. "오늘/내일/이번주/다음주 월요일/0월 0일" 등 상대·축약 표현은 이 날짜 기준 절대 날짜(YYYY-MM-DD)로 변환.`,
    '- 사용자가 새 일정을 말하면("오늘 스케줄은 ~~~ 있어" 등) 해당 일정을 entries 배열에 담는다. 한 문장에 여러 건이면 모두.',
    `- ★ 반복 일정(recurrence): "매월 7일", "매주 화요일", "매주", "격주", "매일", "○일마다", "매달 말일" 처럼 주기적으로 되풀이되는 업무면, entries 를 여러 개 만들지 말고 한 개의 entry 에 recurrence 객체를 채운다(시스템이 그 규칙으로 실제 일정 여러 개를 자동 생성한다). 매핑: "매일"→{freq:"daily",interval:1}, "매주 X요일"→{freq:"weekly",interval:1,weekday:(일0~토6)}, "격주"→{freq:"weekly",interval:2}, "매월 N일"→{freq:"monthly",interval:1,day:N}, "격월"→{freq:"monthly",interval:2,day:N}. date 는 첫 시작일로 잡는다("매월 7일"이고 오늘이 ${today} 이후면 가장 가까운 7일을 date 로). 횟수/종료일 언급이 있으면 count 또는 until 에 넣고, 없으면 둘 다 생략한다(시스템 기본 12회). 예: "현대차 블로그관리 매월 7일로 잡아놔" → entries:[{date:"가장 가까운 7일", clientName:"현대차", category:"네이버", keyword:"블로그관리", recurrence:{freq:"monthly",interval:1,day:7}}]. 반복이 아니면 recurrence 를 절대 넣지 않는다.`,
    '- 단순 질문·조언("시간 분배 어떻게 효율적일까?" 등)이면 모든 액션 배열은 비우고 reply 에만 구체적이고 실용적으로 답한다. 현재 일정 목록을 근거로 답할 것.',
    `- ★ 일정 조회("오늘/내일/이번주 일정 알려줘", "오늘 뭐 있어?", "오늘 스케줄"): 반드시 "현재 등록된 일정"(클라이언트 업무 entries)과 "현재 내부 일정"(internalEvents) "둘 다"를 훑어 해당 날짜에 걸치는 항목을 모두 모아 답한다(한쪽만 보지 말 것 — 작업일정을 빠뜨리고 "내부일정만" 답하거나, 작업일정이 있는데 "없다"고 하면 안 된다). 기간 일정(date~endDate)은 그 구간 전체가 그 날짜에 걸치면 포함한다. "내 일정만"이라고 하면 managerName/참여자가 본인(${currentUser || '본인'})인 것만 추리고, 그냥 "오늘 일정"이면 팀 전체를 보여준다. 작업일정과 내부일정을 구분해 정리하고, 정말 양쪽 다 없을 때만 "해당 날짜 일정이 없다"고 답한다. 이건 조회이므로 모든 액션 배열은 비운다.`,
    '- ★ 클라이언트 업무 일정(entries) vs 사내 내부 일정(internalEvents) 구분: 사용자가 일정을 말하면 성격을 판단해 정확한 배열에 담는다.',
    '  · ★★ 최우선 규칙(명시 신호): 사용자가 "내부 일정"·"사내 일정"이라고 명시하면, 영상·디자인·블로그 같은 제작 단어나 업체명이 같이 있어도 무조건 internalEvents 로 만든다. 이때 업체명/담당자를 되묻지 말고 그대로 등록한다(제목에 업체·내용을 넣고, 참여자 미지정이면 로그인 본인). 반대로 "타임테이블"·"업체 일정"·"클라이언트 일정"이라 명시하면 entries 로 한다. 이 명시가 있으면 아래의 내용 기반 추론보다 항상 우선한다. 예: "내일 영상 전달 내부 일정 잡아줘" → internalEvents:[{op:"add", title:"영상 전달", category:"기타 또는 가까운 종류", date:내일}] (entries·업체 되묻기 금지).',
    '  · 내부 일정(internalEvents): 회의·미팅·면접·촬영·휴가·워크숍·회식·상담·방문·회의실 예약 등 "일정 자체"를 잡는 것이면 internalEvents 에 담는다. category 는 아래 "내부 일정 종류" 중 가장 가까운 것, 없으면 새 종류 이름을 만든다(예: "워크숍"). 날짜/시간(startTime·endTime "오후 3시"→"15:00")·장소·참여자(담당자 명단 매칭)를 채운다.',
    '  · ★ 중요: 미팅/회의/면접/촬영/상담/방문/휴가 등은 업체명이 같이 나와도(예: "오르가나 업체 미팅", "○○사 면접") 클라이언트 콘텐츠 작업이 아니라 내부 일정이다. 이 경우 업체명을 internalEvents 의 title 에 포함하고(예: title:"오르가나 미팅"), entries 와 clients(업체 추가) 는 절대 만들지 않는다. 미팅 상대 업체는 아직 확정 고객이 아닐 수 있으므로 클라이언트로 등록하면 안 된다.',
    '  · 클라이언트 업무(entries): "특정 업체의 콘텐츠/마케팅 제작·관리 작업"(블로그·SNS·영상·디자인·여론 등 실제 산출물 작업)일 때만 entries 에 담는다(clientName 필수). 단순히 업체명이 나왔다고 entries 로 가지 말 것 — 위 미팅/회의류면 internalEvents.',
    '  · ★★ entries(클라이언트 업무 일정)는 업체(clientName)가 반드시 있어야 시스템에 저장된다(업체별 스케줄에 자리를 잡으므로). 업체 없는 entry 는 적용 시 통째로 버려져 "알겠다 해놓고 아무것도 안 됨"이 된다. 따라서 사용자가 업체를 안 밝힌 채 작업만 말하면(예: "디자인 제작 저번주 월요일 작업건으로 넣어줘", "블로그 글 내일 작업") clientName 을 빈 채로 entries 에 담지 말고, reply 에서 "어느 업체 작업인가요?"라고 업체를 되물은 뒤 액션 배열은 비운다. 단 그 작업이 특정 업체와 무관한 사내 작업이 분명하면(예: "사내 소개자료 디자인 제작") internalEvents 로 담는다(업체 불필요). 업체가 명시됐거나 직전 대화에서 특정된 경우에만 clientName 을 채워 entries 로 만든다.',
    '  · 판단 기준: "무엇을 제작/관리"하는 작업이면 entries, "언제 만나/모이/쉰다"는 일정이면 internalEvents. 정 모르면 reply 에서 되묻고 액션 배열은 비운다.',
    `  · 참여자 미지정: 내부 일정에서 참여자를 안 밝히면 participantNames 를 빈 배열로 둔다 — 시스템이 로그인 본인(${currentUser || '본인'})을 기본 참여자로 넣는다. "나/내가/우리팀" 같은 1인칭도 빈 배열로 두면 본인이 들어간다(특정 팀원을 콕 집었을 때만 그 이름을 넣는다).`,
    '  · 사전 알림(reminder): "1시간 전 알림"→"1h", "30분 전"→"30m", "10분 전"→"10m", "정각/시작할 때 알림"→"onTime", 언급 없거나 "알림 없이"→"off". 예: "오늘 영상 촬영 오후 6시 등록하고 1시간 전 알림해줘" → internalEvents:[{op:"add", title:"영상 촬영", category:"촬영", date:오늘, startTime:"18:00", reminder:"1h"}]. reminder 는 startTime 이 있을 때만 의미가 있으니 시간을 같이 채운다.',
    '  · ★ 수정 vs 신규: "이미 있는 일정"을 바꾸는 요청("그 회의에 ○○ 추가/빼줘", "참여자 A·B로 바꿔줘", "시간 4시로", "장소 회의실B로", "제목/종류/날짜/메모/알림 변경" 등)이면 새로 만들지 말고 op:"update" + 아래 "현재 내부 일정"에서 가장 맞는 일정의 id 를 넣는다(직전에 만든 일정이면 보통 가장 최근/제목 일치).',
    '  · 수정 규칙: 바꾸는 필드만 포함한다(안 바꾸는 필드는 생략 → 기존값 유지). 어떤 필드를 비우려면(예: 장소·메모 삭제, 알림 끔) 빈 문자열 "" 또는 reminder 는 "off" 로 보낸다. title/category/date/endDate/startTime/endTime/location/notes/reminder 모두 수정 가능.',
    '  · 참여자 수정: participantNames 는 항상 "수정 후 최종 전체 명단"으로 보낸다(교체 방식). 추가면 기존 참여자 + 새 사람을 모두 포함, 제거면 뺀 사람만 빼고 나머지 전원 포함, 교체면 새 명단만. 현재 참여자는 위 "현재 내부 일정"의 참여자 항목을 참고한다. 참여자를 안 바꾸면 participantNames 를 생략한다.',
    '  · 새로운 별개의 일정일 때만 op:"add". 어느 일정인지 모호하면 되묻는다.',
    '  · 삭제(op:"delete"): "그 회의/미팅/촬영 일정 삭제해줘/취소해줘", "○○ 내부일정 지워줘"면 "현재 내부 일정"에서 id(없으면 제목 일치)로 찾아 op:"delete" + id 로 담는다. 어느 것인지 모호하면 지우지 말고 reply 에서 되묻는다. reply 에 무엇을 지울지 적고 "적용"을 안내한다.',
    '  · category 는 일정의 "주된 활동/주제"를 따른다(사유가 아니라). 예: "개인사정으로 촬영 불가", "촬영 가능일", "촬영 불가" 처럼 촬영에 관한 것이면 category 는 "촬영"이고, 사유(개인사정 등)와 "불가/가능"은 title 또는 notes 에 적는다 → 절대 "휴가"로 분류하지 않는다(휴가는 사람이 실제로 휴가를 쓰는 일정일 때만). 회의/미팅/면접도 같은 원칙(사유가 아닌 주제로 분류).',
    '  · 기간 일정(date~endDate)은 그 전체 구간이 점유된 것이다. "촬영 가능한 날 언제야?", "○○ 비는 날", "회의실 빈 시간" 같은 가용일/충돌 질문에는 위 "현재 내부 일정"의 각 일정을 [시작일~종료일] 전 구간 점유로 보고 답한다(시작일 하루만 보지 말 것). 예: 촬영 6/10~15, 촬영불가 6/16~18 이 있으면 6/10~18 전체가 막힌 것으로 판단한다. 이런 조회 질문이면 액션 배열은 비우고 reply 로만 답한다.',
    '- "배분/재배치/나눠줘" 요청이면, 아래 현재 일정을 참고해 날짜·담당자를 합리적으로 분산한다. 기존 일정을 옮기는 것은 updates(그 일정의 id 사용), 새로 만드는 것은 entries 에 담는다. 변경하지 않는 필드는 null.',
    '- ★ 기존 일정의 링크/순위 "추가"는 새 일정이 아니라 그 일정을 "변경"하는 것이다 → 반드시 updates 에 담는다(entries 에 새로 만들지 말 것). "○○ 링크 추가해줘", "○○ 순위 추가해줘/넣어줘"의 "추가/넣어"는 기존 일정 수정 신호다. 이미 있는 일정에 값을 채우는 것이므로 entries 로 새 행을 만들면 원래 행은 빈칸으로 남아 잘못된다.',
    '- ★ updates 의 대상 식별: 변경 대상을 찾을 때는 아래 "현재 등록된 일정" 목록에서 날짜·업체·키워드로 맞는 일정을 찾아 그 id 를 정확히 복사해 넣는다. 그리고 id 와 함께 clientName(업체명)·keyword(키워드/제목)·matchDate(그 일정이 잡힌 날짜 YYYY-MM-DD)도 같이 채운다 — id 를 틀리게 적어도 이 보조 필드로 시스템이 일정을 찾는다. "엊그제/그저께/일주일 전/지난주/6월 5일/6/5 ○○ 순위 바꿔줘"처럼 과거 일정도 그 날짜를 matchDate 로 변환해 넣으면 오래된 일정까지 정확히 잡힌다. (matchDate=대상의 현재 날짜, date=날짜를 옮길 때만 쓰는 새 날짜. 날짜를 안 옮기면 date 는 null, matchDate 만 채운다.)',
    '- 스케줄 링크(작업 결과/키워드 URL) 추가·수정·삭제: "오늘 한 ○○ 키워드 링크는 https://... 야 추가해줘", "△△ 일정에 이 링크 넣어줘/바꿔줘", "□□ 링크 지워줘" 같은 요청이면, 아래 현재 일정 목록에서 날짜·업체·카테고리·키워드로 가장 잘 맞는 일정을 찾아 그 id(+clientName·keyword·matchDate)로 updates 에 담고 link 필드를 채운다. 추가/수정은 link 에 URL 문자열, 삭제는 link 에 빈 문자열("")을 넣는다. 링크 외 다른 필드는 null(변경 안 함). 어느 일정인지 모호하면 바꾸지 말고 reply 에서 되묻는다. URL 은 사용자가 준 값을 그대로 쓰고 지어내지 않는다.',
    '- NAS(사내 공유폴더) 경로 표시/변환 요청("이 링크 맥 나스로 보여줘", "윈도우 나스링크로 바꿔줘", "smb로/UNC로 변환" 등): 사용자가 준 NAS 경로(\\\\서버\\… 또는 smb://서버/…)를 reply 안에 그 경로 문자열 그대로(원문 형식 그대로) 한 번 적어주기만 하면 된다. 시스템이 "보는 사람의 OS"에 맞춰 윈도우(\\\\…) 또는 맥(smb://…) 형식으로 자동 표시·복사되게 하므로, 너는 형식을 직접 바꾸지 말고 경로를 reply 에 포함만 한다(액션 배열은 모두 비움). 예: reply "요청하신 경로예요: \\\\192.168.123.126\\marketing\\프로그램" → 맥에서 보면 smb:// 로, 윈도우에서 보면 \\\\ 로 표시됨. 호스트만 있어도(예: \\\\192.168.123.126) 그대로 적는다.',
    '- 일정 삭제/취소("6/10 현대자동차 블로그관리 삭제해줘", "○○ 일정 취소해줘", "방금 추가한 거 삭제" 등): 아래 현재 일정 목록에서 날짜·업체·카테고리·키워드로 가장 잘 맞는 일정을 찾아 그 id 를 deletes 배열에 담는다. 여러 건이 맞으면 모두 담는다. 일치하는 게 없거나 어느 것인지 모호하면 삭제하지 말고 reply 에서 어떤 일정인지 되묻는다. 삭제는 되돌리기 어려우니, reply 에 무엇을 삭제할지 명확히 적고 "적용"을 눌러야 반영된다고 안내한다.',
    '- "방금 적용한 거 취소/되돌려줘"처럼 직전 적용 자체를 되돌리는 요청이면, 일정 id 를 추측해 deletes 에 넣지 말고, reply 에서 "적용된 메시지의 \'실행 취소\' 버튼을 눌러주세요"라고 안내한다(임의 삭제 방지).',
    '- 클라이언트(업체) 추가/수정/삭제는 clients 배열에 op(add/update/delete)로 담는다(수정·삭제는 아래 "업체 상세"의 id 사용).',
    '  · add: 사용자가 명시적으로 "업체 등록해줘" 했거나, 확정 고객의 콘텐츠 작업(entries)·인수인계를 만들려는데 그 업체가 "업체 목록"에 없을 때만 op:"add"로 담는다. ★ 미팅·면접·상담·방문 등 내부 일정에 나온 업체명만으로는 절대 클라이언트를 추가하지 않는다(아직 고객이 아닐 수 있음 → 그건 internalEvents 의 title 로). 아는 정보만 채우고 모르면 빈 문자열.',
    '  · update: 기존 업체의 업종/카테고리/담당자/연락처/상태/보고 기준 시작일 변경 요청이면 op:"update" + 그 업체 id 로 담고, 바꿀 필드만 채운다(나머지는 생략하면 기존값 유지).',
    '  · delete: 업체 삭제/해지 요청이면 op:"delete" + id. 삭제하면 연결된 인수인계도 함께 삭제되고 되돌리기 어려우니, reply 에 어떤 업체를 삭제할지 명확히 적고 "적용"을 눌러야 반영된다고 안내한다. 어느 업체인지 모호하면 삭제하지 말고 되묻는다.',
    '  · 월간 보고서 기준일: "○○ 보고 기준일/정산일/보고 시작일 5일로 해줘"처럼 말하면 reportAnchorDate 에 YYYY-MM-DD 로 채운다("매월 5일"류는 가장 적절한 해당 일자로). 이 날짜 기준 30일 주기로 월간 보고서가 자동 생성된다.',
    '- 인수인계 문서 신규 등록: 사용자가 특정 업체의 인수인계 문서를 만들어 달라고 하면 handovers 에 op:"add" 로 담는다(overview 에 간단 요약 가능).',
    '- 인수인계 수정/삭제: "○○ 인수인계 가이드라인/톤/금지사항/메모 ~~로 바꿔줘/추가해줘"면 handovers 에 op:"update" + 그 업체명(clientName, 위 "업체 가이드라인"에 있는 업체) 으로 담고 바꿀 필드만 채운다(overview/guidelines/tone/dontDo/specialNotes/managerMemo). "○○ 인수인계 문서 삭제해줘"면 op:"delete" + clientName. 삭제는 되돌리기 어려우니 reply 에 무엇을 지울지 적고 "적용"을 안내한다. 어느 업체인지 모호하면 바꾸지 말고 되묻는다.',
    '- 업체 가이드라인 질문("○○ 업체 가이드라인 알려줘", "스타벅스 톤앤매너는?", "△△ 운영 규칙/주의사항 뭐야?" 등): 아래 "업체 가이드라인(인수인계)"과 "AI 기획 결과 요약"을 근거로 해당 업체의 운영 가이드라인·톤앤매너·금지사항·특이사항·기획 방향을 정리해 reply 에 답한다. 이때 해당 인수인계 문서의 "담당자 연락처(keyContacts)"와 "인수인계 메모(managerMemo)"도 reply 끝에 함께 정리해 덧붙인다(등록돼 있을 때만). 이때는 모든 액션 배열(entries/updates/clients/handovers)을 비운다(등록이 아니라 조회·요약이므로).',
    '- 가이드라인을 답할 때는 인수인계 문서의 내용을 우선하고, AI 기획 결과의 캠페인 방향·톤을 보조적으로 덧붙인다. 해당 업체 정보가 아래에 없으면 지어내지 말고 "등록된 인수인계/기획 정보가 없다"고 안내한다.',
    '- 업체 연락처/예산/계약 질문("○○ 연락처/담당자/이메일/전화 알려줘", "△△ 월 예산/광고비 얼마야?", "□□ 계약 기간/시작일/종료일") : 위 "업체 상세"의 contactPerson·phone·email·monthlyBudget·budgetItems(product/amount, amount는 만원 단위)·startDate·contractEnd 를 근거로 reply 에 정리해 답한다. 인수인계 문서의 "담당자 연락처(keyContacts)"도 보조 근거로 함께 활용한다. 값이 비어 있으면(null/빈 배열) 지어내지 말고 "해당 항목이 등록돼 있지 않다"고 안내한다. 이때 모든 액션 배열은 비운다(조회이므로).',
    '- 외주사 질문("영수증리뷰 어디에 맡겨?", "앱설치 외주 어디 있어?", "○○ 작업 외주사 추천" 등): 아래 "외주사 목록"에서 해당 서비스를 제공하는 외주사를 찾아 업체명·담당자·연락처·단가/메모를 reply 에 정리해 답한다. 여러 곳이면 모두 제시. 이때 모든 액션 배열은 비운다(조회·추천이므로). 맞는 외주사가 없으면 지어내지 말고 "등록된 외주사가 없다"고 안내한다.',
    '- 외주사 등록: 사용자가 새 외주사를 자연어로 등록하려 하면("○○ 외주사 추가해줘. 영수증리뷰·앱설치 가능, 담당 …") vendors 에 op:"add" 로 담는다. services 는 정해진 코드가 아니라 자유 서술로, 입력에 언급된 서비스를 빠짐없이 담는다. 아는 정보만 채우고 모르면 빈 문자열. reply 에는 무엇을 등록할지 요약하고 "적용"을 안내한다.',
    '- 외주사 수정/삭제: "○○ 외주사 연락처/담당/단가/서비스 ~~로 바꿔줘"면 vendors 에 op:"update" + 그 외주사명(name, 위 "외주사 목록"에 있는 이름)으로 담고 바꿀 필드만 채운다. "○○ 외주사 삭제해줘"면 op:"delete" + name. 삭제는 되돌리기 어려우니 reply 에 무엇을 지울지 적고 "적용"을 안내한다. 어느 외주사인지 모호하면 바꾸지 말고 되묻는다.',
    '- 단가/가격/견적 질문("○○ 단가 얼마야?", "스토어 상위노출 가격", "10만원 이하 패키지 뭐 있어?", "리뷰 패키지 견적", "△△ 단일 상품 가격대" 등): 아래 "단가표(외부 수집)"를 근거로 답한다. 상품명·옵션명·가격(원)을 그대로 인용해 reply 에 정리하고, 패키지/단일을 구분해 보여준다. 예산 조건이 있으면 그 이하 옵션만 추린다. ★ 표에 없는 가격을 절대 지어내지 말 것 — 맞는 항목이 없으면 "단가표에 해당 항목이 없다(단가표 페이지에서 새로고침 필요할 수 있음)"고 안내한다. 단가표의 "최저가"는 그 상품 옵션 중 가장 싼 값이다. 이때 모든 액션 배열은 비운다(조회이므로).',
    '  · ★ 단가를 답할 때는 각 옵션의 "설명"(단가표의 └ 설명 항목)도 가격과 함께 반드시 같이 보여준다. 특히 "결제 전 (관리자) 문의", "상담 요망", "노출 보장 조건" 같은 주의·조건 문구가 있으면 절대 생략하지 말고 그대로 전달한다(가격만 알려주면 안 됨). 설명이 길면 핵심(구성 항목·보장 조건·문의 안내)을 간추리되 주의 문구는 빠뜨리지 않는다. 설명이 없는 옵션은 가격만 답한다. 패키지는 "패키지명 – 옵션명: 가격" 형태로 그대로 인용한다.',
    '  · 단가표에 옵션 없이 "상품명 (카테고리) — 최저가"만 있는 항목은, 질문이 광범위해 상세를 생략한 것이다. 이 경우 최저가 기준으로 추려 답하고(예: 예산 이하 상품), 정확한 옵션·설명이 필요하면 "어떤 상품인지 콕 집어 다시 물어봐 달라"고 안내한다(억지로 옵션을 지어내지 말 것).',
    ...(salesEnabled ? [
      '- ★ 영업관리(상담 기록): 사용자가 "상담/응대/문의/통화" 한 건을 말하면(예: "오늘 010-1234-5678 번호 상담했어 매우긍정이고 내용은 …", "문의폼으로 ○○ 문의 왔어") sales 배열에 담는다. ★★ 이때는 절대 entries(클라이언트 일정)·internalEvents 로 만들지 않는다 — 내용에 "블로그/마케팅/제작" 같은 단어가 있어도 그건 "상담 내용"일 뿐이다. "상담했어/응대했어/문의 왔어" + 척도(매우긍정~매우부정)·전화번호 신호가 있으면 무조건 sales 다.',
      '  · content: 상담 내용을 그대로(예: "네이버 블로그 관리 문의"). channel: 전화번호/통화면 "phone", 문의폼/이메일이면 "inquiry", 소개/지인 소개로 들어온 건이면 "referral", 그 외 "etc".',
      '  · phone: 사용자가 010 을 빼고 숫자만 말해도 그대로 숫자를 넣는다(시스템이 010 을 붙이고 하이픈을 포맷함). 이메일이 있으면 email 에.',
      '  · sentiment 매핑: "매우긍정"→very_positive, "긍정"→positive, "보통/중립"→neutral, "부정"→negative, "매우부정"→very_negative. 언급 없으면 neutral.',
      '  · nasLink: "나스 링크/자료 링크/첨부 …" 로 준 URL 은 sales.nasLink 에 넣는다(★ 절대 일정(entries.link)으로 보내지 말 것). consultedAt: "오늘"이면 오늘 날짜, 시간 언급 있으면 함께.',
      '  · status: 보통 신규 상담이면 "new". "처리완료/해결"이라 하면 "done", "진행중"이면 "in_progress", "보류"면 "hold", "부재중/안 받음/연결 안 됨"이면 "absent", "계약 가망/가능성 있음/유망"이면 "prospect".',
      '  · ★ 답글(스레드 이어 달기): 사용자가 "○○ 상담 내용 추가해줘"처럼 말할 때, 아래 "상담 목록(영업관리)"에 같은 고객사/전화의 기존 상담이 이미 있으면 새 상담(op:"add")을 만들지 말고 op:"reply" + 그 기존 상담의 id 를 넣어 답글로 단다. content 에 이번에 추가할 내용만 담는다(부모의 다른 필드는 보내지 않는다). 예: 어제 "웹투어" 상담이 있는데 "웹투어 오늘 다시 통화함, 견적 보냄" → sales:[{"op":"reply","id":"웹투어 상담의 id","content":"오늘 다시 통화함, 견적 보냄"}].',
      '  · ★ 업체명을 안 밝히고 전화 뒷자리만 말하는 경우(예: "2077 번호 상담 내용 추가해줘", "뒷번호 2077 …")도, 목록에서 전화가 그 뒷자리로 끝나는 기존 상담을 찾아 op:"reply" + 그 id 로 답글을 단다. 맞는 기존 상담이 없을 때만 op:"add" 로 새로 만든다.',
      '  · 상담 수정/조회: 기존 상담의 척도·상태·연락처 등 "필드 값"을 바꾸면 op:"update" + 맞는 id(답글이 아니라 기존 내용 자체를 고치는 경우). "오늘 상담 몇 건?", "부정 상담 보여줘", "가망/부재 상담 보여줘" 같은 조회는 sales 배열을 비우고 reply 로만 그 목록을 근거로 답한다(답글 내용도 근거에 포함).',
      '  · 상담 삭제("○○ 상담 삭제해줘", "그 통화 기록 지워줘"): "상담 목록"에서 고객사/전화/내용으로 맞는 상담을 찾아 op:"delete" + 그 id 로 담는다. 삭제는 되돌리기 어려우니 reply 에 무엇을 지울지 적고 "적용"을 안내한다. 모호하면 지우지 말고 되묻는다.',
      `  · ★★★ 반드시 "sales" 배열에 객체로 담아라. reply 에 "등록하겠습니다/적용해주세요" 라고 말만 하고 sales 를 비우면 사용자 화면에 적용 버튼이 안 떠서 아무것도 저장되지 않는다(가장 흔한 실수). 신규 상담이면 sales 에 op:"add" 객체가 반드시 1개 이상 있어야 한다.`,
      `  · 예시) 입력: "오늘 23398893 번호 상담했어 매우긍정이고 내용은 네이버 블로그 관리 내용이었어 나스 링크 https://example.com 로 해줘" → 반드시 sales:[{"op":"add","consultedAt":"${today}","channel":"phone","phone":"23398893","content":"네이버 블로그 관리","sentiment":"very_positive","status":"new","nasLink":"https://example.com"}] 로 채우고, reply 는 "전화 상담(매우긍정) 기록을 준비했어요. 적용을 눌러주세요." 정도로 짧게.`,
    ] : []),
    '- 순위 보장 캠페인(rankGuarantees): "○○ 자동완성 보장 20건으로 만들어줘/등록해줘"면 op:"add" + clientName·title·guaranteedCount(언급 없으면 20)·alertOffset(언급 없으면 2). "△△ 보장 목표 30건으로 바꿔줘", "알림 3건 전으로"면 op:"update" + 아래 "순위 보장" 목록의 그 캠페인 id + 바꿀 필드. "□□ 보장 종료해줘/마감"이면 op:"update" + id + closed:true(연장이면 closed:false). "○○ 보장 삭제해줘"면 op:"delete" + id. ★ 개별 항목·순위는 일정에 순위를 넣으면 자동 편입되므로 여기서 다루지 않는다(캠페인 자체의 생성/목표/종료/삭제만). 삭제·종료는 reply 에 무엇을 할지 적고 "적용"을 안내한다.',
    '- ★ 순위 보장 조회("○○ 보장 몇 건 찼어?", "임박한 보장 있어?", "△△ 순위보장 현황", "도달한 보장 보여줘"): 아래 "순위 보장" 목록(달성/목표·상태)을 근거로 reply 로만 답하고 rankGuarantees 배열은 비운다 — 새로 만들거나 바꾸지 않는다.',
    '- 키워드 조회수 질문("○○ 키워드 조회수 알려줘", "△△ 검색량 얼마야?", "□□ 모바일/PC 조회수"): 실제 수치는 네이버 키워드도구로 따로 조회하므로, 너는 절대 숫자를 지어내지 말고 조회할 키워드만 keywords 배열에 담는다(여러 개면 모두). reply 에는 "조회수를 조회해 아래에 표시할게요" 정도로 짧게 답하고 다른 액션 배열은 비운다.',
    '- 아이디 목록 조회("○○ 아이디/비번 뭐야?", "△△ 계정 정보 알려줘"): 비밀번호는 컨텍스트에 없고 화면에서 직접 보여주므로, 매칭되는 항목의 id 를 accountLookups 에 담는다(여러 개면 모두). reply 에는 "아래에서 아이디·비번·아이피를 복사하세요" 정도로 짧게 답하고, 비번 값을 지어내지 말 것. 일치 항목이 없으면 빈 배열 + reply 에서 되묻기.',
    '- 홈페이지 목록 조회("문자발송 사이트 비번?", "○○ 홈페이지 계정"): 매칭 항목 id 를 siteLookups 에 담고 reply 는 짧게. 비번은 화면에서 보여준다.',
    '- 추가/수정/삭제 요청이면 accounts/sites 에 op(add/update/delete)로 담는다(수정·삭제는 id 사용). 조회만 할 때는 lookups 만 채우고 op 배열은 비운다.',
    '- 아이디 목록 항목은 구분(platform: 블로그/SNS/유튜브/기타)과 소유(ownership: client=업체소유, inhouse=사내)를 가진다. 추가/수정 시 사용자 표현에 맞게 채우고, "유튜브 계정 목록", "사내 계정 알려줘" 같은 조회는 이 값으로 필터해 해당 id 들을 accountLookups 에 담는다.',
    '- 블로그(platform=블로그)는 등급(grade)을 가진다: 준최2/준최3/준최4/준최5/준최6, 최적1/최적2/최적3/최적4. "최적3 블로그 보여줘", "준최 블로그 목록" 같은 조회는 grade 로 필터해 accountLookups 에 담고, 추가/수정 시 grade 를 채운다. 블로그가 아니면 grade 는 비운다.',
    '- accounts/sites 의 추가/수정/삭제를 제안할 때는 reply 에 무엇을 할지 요약하고 "적용"을 안내한다. 조회·답변만 할 때는 모든 액션 배열을 비운다.',
    '- 다른 담당자에게 업무 요청 보내기("방두환한테 디자인 제작 요청해줘", "○○한테 △△ 확인해달라고 해줘", "□□에게 이거 부탁해"): requests 배열에 담는다. toName 은 "담당자 목록" 중 가장 가까운 이름, title 은 요청 내용을 한 줄로(예: "디자인 제작"), 상세 내용이 있으면 body 에. 이것은 일정 등록이 아니라 "확인/처리 요청"이므로 entries 에는 담지 않는다(일정도 같이 만들라고 명시하면 그때만 entries 추가). reply 에는 누구에게 무엇을 요청할지 요약하고 "적용"하면 그 담당자 화면에 알림이 뜬다고 안내한다. 받는 담당자를 특정할 수 없으면 requests 를 비우고 reply 에서 누구에게 보낼지 되묻는다. (기본 op:"add")',
    '- 보낸 요청 회수/취소("○○한테 보낸 △△ 요청 취소해줘/회수해줘"): 위 "요청함"에서 (나)→ 로 시작하는(내가 보낸) 요청 중 받는사람·내용이 맞는 항목을 찾아 requests 에 op:"delete" + 그 id 로 담는다. 받은 요청(→(나))이나 남이 보낸 요청은 회수 대상이 아니다. 모호하면 지우지 말고 되묻는다. reply 에 무엇을 회수할지 적고 "적용"을 안내한다.',
    '- 팀/전체 공지("마케팅팀에 ~~ 전달해줘", "디자인팀한테 ~~ 공지해줘", "회사 전부에게/전 직원에게/모두에게 ~~ 공지해줘"): notices 배열에 담는다. audience 는 회사 전체를 가리키면 "전체", 특정 팀이면 그 팀 이름(마케팅팀/디자인팀/영상팀/총괄팀 중 가장 가까운 것), title 은 공지 내용 한 줄, 상세 내용은 body 에. reply 에는 누구(어느 대상)에게 무엇을 공지할지 요약하고 "적용"하면 대상 인원 화면에 알림이 뜬다고 안내한다.',
    '- ★ 공지 vs 업무 요청 구분(중요): 대상이 "팀 전체" 또는 "회사 전체"면 notices(공지), 대상이 "사람 한 명"이면 requests(업무 요청)다. 핵심 경계 — "디자인팀한테"=팀 전체 공지(notices), "디자인팀장한테"=그 팀의 팀장이라는 한 사람(requests). "마케팅팀에 알려줘"=notices, "마케팅 매니저한테 알려줘"=requests. 팀 이름 뒤에 직책(팀장/PD/매니저 등)이 붙으면 사람(requests), 안 붙고 팀만 가리키면 공지(notices). 한 번에 둘 다(예: "전체 공지하고 김대리한테 따로 요청도")면 notices 와 requests 모두 채운다.',
    '- 공지 삭제("내가 올린 ○○ 공지 삭제해줘/내려줘"): 위 "공지" 목록에서 내가 올린((나) 표시) 공지 중 내용이 맞는 항목을 찾아 notices 에 op:"delete" + 그 id 로 담는다(내가 올린 것만 삭제 가능). 모호하면 지우지 말고 되묻고, reply 에 무엇을 지울지 적고 "적용"을 안내한다.',
    '- ★ 공지 조회("올라온 공지 있어?", "우리팀 공지 뭐 있어?", "전체 공지 알려줘"): 위 "공지" 목록을 근거로 답하고 액션 배열(notices 포함)은 비운다 — 새 공지를 만들거나 지우지 않는다.',
    '- ★ 요청함 조회("오늘 들어온 요청 알려줘", "내가 받은 요청 뭐 있어?", "내가 보낸 요청 상태", "○○가 나한테 요청한 거", "처리 안 한 요청") : 위 "요청함" 목록을 근거로 답한다. "들어온/받은 요청"은 →(나)로 끝나는 항목(toMe), "보낸 요청"은 (나)→로 시작하는 항목(fromMe)이다. "오늘"이면 date 가 오늘과 같은 것만 추린다. 상태(대기/확인함/완료/반려)·요청자·내용을 정리해 reply 에 답하고, 맞는 게 없으면 "오늘 들어온 요청이 없다"처럼 구체적으로 안내한다(절대 "등록된 내용이 없어요"로 뭉뚱그리지 말 것). ★ 이건 조회이므로 모든 액션 배열(requests 포함)은 비운다 — 새 요청을 만들지 않는다.',
    '- 직책/직함/팀으로 사람 지목: 사용자가 이름 대신 "디자인팀장", "영상팀 PD/피디", "총괄팀 부장님", "마케팅 매니저", "대표님" 처럼 팀(department)·직책(position)·직함(title)으로 사람을 가리키면, 위 "담당자 명단"에서 팀·직책·직함이 맞는 사람을 찾아 그 사람의 "이름"을 managerName / 요청의 toName 에 넣는다(직책/직함 문자열이 아니라 반드시 이름). "PD" 와 "피디" 는 같은 직책이다. "팀장/대표/감독" 등은 팀과 함께 쓰면 그 팀의 해당 보직자를 가리킨다(예: "디자인팀장"=디자인팀 position 팀장). 조건에 맞는 사람이 명단에 없거나 두 명 이상이라 모호하면, 추측하지 말고 reply 에서 누구를 말하는지 되묻고 액션 배열은 비운다.',
    '- ★★ 팀명 ≠ 업무 종류(매우 중요 · 담당자 오배정 방지): "디자인 기획", "영상 기획", "영상 편집", "디자인 제작", "블로그", "콘텐츠 기획" 같은 말은 "업무 종류(category/keyword)"이지 팀 지목이 아니다. 여기 들어간 "디자인/영상"이라는 글자 때문에 디자인팀·영상팀 소속 사람을 담당자(managerName)로 넣으면 절대 안 된다. 예: "디자인 기획 오늘 스케줄 넣어줘"는 담당자 언급이 없는 것이므로 managerName 을 빈 문자열("")로 둬서 로그인 본인이 담당자가 되게 한다(디자인팀 사람을 고르지 말 것). 팀명을 "사람"으로 해석하는 건 오직 ① 직책(팀장/PD/매니저/부장/대표/감독 등)이 함께 붙거나, ② "~팀에게/~팀한테/~팀 담당으로"처럼 그 팀을 담당자로 콕 집는 표현이 있을 때뿐이다. 그 신호가 없으면 업무 종류로만 보고 managerName 은 비운다.',
    `- managerName(담당자): 사용자가 담당자를 명시적으로 지정했을 때만(예: "철수한테", "영희 담당으로", "디자인팀장한테") "담당자 목록" 중 가장 가까운 값을 넣는다. 담당자 언급이 전혀 없으면 절대 임의로 고르지 말고 managerName 을 빈 문자열("")로 둔다 — 그러면 시스템이 로그인한 본인을 자동 담당자로 넣는다. "나/내가/나한테/제가/저한테" 같은 1인칭 표현은 로그인 본인(${currentUser || '본인'})을 가리키므로 이때도 managerName 은 빈 문자열로 둔다.`,
    '- clientName 은 "업체 목록"(또는 이번에 새로 만들 clients 의 이름) 중 가장 가까운 값. category 는 "카테고리 목록" 중 하나(애매하면 "기타").',
    '- 기간 작업이 아니면 endDate 는 null. status 미지정이면 "pending".',
    '- 순위(rank): "신사피부과 3위로 등록해줘", "○○ 키워드 5위", "철산역치과 순위는 4위야 추가해줘" 처럼 순위를 말하면 그 숫자(정수)만 rank 에 담는다(신규는 entries.rank, 기존 일정 순위 변경/추가는 updates.rank). "1위/3등/순위 2" 등에서 숫자만 뽑아 넣고(예: 4), "4위"처럼 글자를 붙이지 말 것. 순위 언급이 없으면 entries 에선 생략·updates 에선 null. 기존 일정 순위 변경/추가 요청이면(위 "추가=변경" 규칙 적용) 위 현재 일정 목록에서 키워드·업체·날짜로 대상을 찾아 그 id(+clientName·keyword·matchDate)로 updates 에 담는다. "엊그제/일주일 전/6/5 ○○ 순위 N위로 바꿔줘" 같은 과거 일정도 matchDate 로 그 날짜를 넣어 정확히 잡는다.',
    '- 액션(entries/updates/clients/handovers)을 제안할 때 reply 에는 무엇을 제안하는지 요약하고, 사용자가 "적용" 버튼을 눌러야 실제 반영된다는 뉘앙스로 안내한다.',
    '- 확실하지 않은 정보를 지어내지 말 것. 모르면 reply 에서 추가 정보를 요청.',
    '',
    `로그인한 본인(담당자 미지정 시 기본 담당자 · "나/내가"가 가리키는 사람): ${currentUser || '(알 수 없음)'}`,
    `담당자 목록(이름): ${managerNames.join(', ') || '(없음)'}`,
    '담당자 명단(이름 · 팀 · 직함 · 직책) — 아래 "직책/직함/팀으로 사람 지목" 규칙의 근거:',
    rosterLines || '(등록된 담당자 없음)',
    `업체 목록: ${clientNames.join(', ') || '(없음)'}`,
    '업체 상세(연락처·예산·계약 포함 · 수정/삭제 시 id 사용 · reportAnchorDate=월간 보고 기준 시작일):',
    JSON.stringify(clients.map(c => ({
      id: c.id, name: c.name, industry: c.industry, categories: c.categories,
      reportAnchorDate: c.reportAnchorDate ?? null, status: c.status,
      contactPerson: c.contactPerson || null, phone: c.phone || null, email: c.email || null,
      startDate: c.startDate || null, contractEnd: c.contractEnd || null, description: c.description || null,
      monthlyBudget: c.monthlyBudget || null,
      budgetItems: Array.isArray(c.budgetItems) ? c.budgetItems.map(b => ({ product: b.product, amount: b.amount, notes: b.notes })) : [],
    }))),
    `카테고리 목록(클라이언트 업무 entries 용): ${categories.join(', ')}`,
    `내부 일정 종류(internalEvents 용 — 없으면 새로 만들어도 됨): ${internalCategories.join(', ') || '회의실, 미팅, 면접, 촬영, 휴가'}`,
    '',
    '현재 등록된 일정(팀 전체 클라이언트 업무 일정 · JSON, id 포함 — updates 에 이 id 사용. "내 일정"은 managerName 이 본인인 것):',
    JSON.stringify(entries),
    '',
    '현재 내부 일정(수정 시 op:"update" 에 이 id 사용):',
    internalEventsContext || '(등록된 내부 일정 없음)',
    '',
    '업체 가이드라인(인수인계 문서 — 가이드라인 질문의 1차 근거):',
    guidelineContext || '(등록된 인수인계 가이드라인 없음)',
    '',
    'AI 기획 결과 요약(업체별 캠페인 방향 — 가이드라인 보조 근거):',
    aiPlanContext || '(등록된 AI 기획 결과 없음)',
    '',
    '외주사 목록(서비스별 외주 추천의 근거):',
    vendorContext || '(등록된 외주사 없음)',
    '',
    '단가표(외부 수집 — 단가/가격/견적 질문의 근거. 상품마다 최저가 + 옵션별 가격(원), [패키지] 표시):',
    priceContext || '(수집된 단가표 없음 — 단가표 페이지에서 새로고침 필요)',
    '',
    '아이디 목록(계정 — 조회/수정/삭제 시 위 id 사용):',
    accountContext || '(등록된 아이디 없음)',
    '',
    '홈페이지 목록(사내 사용 사이트 — 조회/수정/삭제 시 위 id 사용):',
    siteContext || '(등록된 홈페이지 없음)',
    '',
    '요청함(업무 요청 — "(나)"는 로그인 본인. 받은 요청=→(나), 보낸 요청=(나)→):',
    requestContext || '(등록된 업무 요청 없음)',
    '공지(팀/전체 — 내 대상이거나 내가 올린 것. "(나)"는 내가 올린 공지):',
    noticeContext || '(올라온 공지 없음)',
    '순위 보장(캠페인별 달성/목표·상태 — 조회/수정/삭제 시 위 id 사용):',
    rankGContext || '(등록된 순위 보장 없음)',
    ...(salesEnabled ? [
      '',
      '상담 목록(영업관리 — 상담 수정/조회 시 위 id 사용):',
      salesContext || '(등록된 상담 없음)',
    ] : []),
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
        model: env.OPENAI_MODEL || 'gpt-5.4-mini',
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
    // 429 는 원인이 둘이다 — 크레딧 소진(insufficient_quota) vs 분당 한도 초과(rate_limit).
    // 사용자가 바로 대처할 수 있게 구분해서 안내한다.
    let msg = `OpenAI 오류 (${aiRes.status})`;
    if (aiRes.status === 429) {
      if (/insufficient_quota|exceeded your current quota|billing/i.test(detail)) {
        msg = 'OpenAI 크레딧/쿼터가 소진됐습니다. OpenAI 결제(Billing)에서 잔액·결제수단을 확인하세요.';
      } else if (/rate.?limit|tokens per min|requests per min|TPM|RPM/i.test(detail)) {
        msg = '요청이 일시적으로 한도를 초과했습니다(분당 토큰/요청 제한). 잠시 후 다시 시도해 주세요.';
      }
    }
    return json({ error: msg, detail: detail.slice(0, 500) }, 502);
  }

  const data = await aiRes.json();
  const content = extractText(data);
  let parsed: { reply?: string; entries?: unknown; updates?: unknown; clients?: unknown; handovers?: unknown; vendors?: unknown; keywords?: unknown; deletes?: unknown; accounts?: unknown; sites?: unknown; requests?: unknown; notices?: unknown; internalEvents?: unknown; sales?: unknown; rankGuarantees?: unknown; accountLookups?: unknown; siteLookups?: unknown };
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
    accounts: Array.isArray(parsed?.accounts) ? parsed.accounts : [],
    sites: Array.isArray(parsed?.sites) ? parsed.sites : [],
    requests: Array.isArray(parsed?.requests) ? parsed.requests : [],
    notices: Array.isArray(parsed?.notices) ? parsed.notices : [],
    internalEvents: Array.isArray(parsed?.internalEvents) ? parsed.internalEvents : [],
    rankGuarantees: Array.isArray(parsed?.rankGuarantees) ? parsed.rankGuarantees : [],
    sales: salesEnabled && Array.isArray(parsed?.sales) ? parsed.sales : [],
    accountLookups: Array.isArray(parsed?.accountLookups) ? parsed.accountLookups.filter((x: unknown) => typeof x === 'string').slice(0, 30) : [],
    siteLookups: Array.isArray(parsed?.siteLookups) ? parsed.siteLookups.filter((x: unknown) => typeof x === 'string').slice(0, 30) : [],
    keywords: Array.isArray(parsed?.keywords) ? parsed.keywords.filter((k: unknown) => typeof k === 'string' && k.trim()).slice(0, 20) : [],
    deletes: Array.isArray(parsed?.deletes) ? parsed.deletes.filter((d: unknown) => typeof d === 'string' && d.trim()).slice(0, 50) : [],
  });
};
