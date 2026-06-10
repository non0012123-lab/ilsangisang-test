export type Category = 'SNS' | '유튜브' | '네이버' | '영상제작' | '디자인제작' | '네이버 여론작업' | '기타';
export type ScheduleStatus = 'pending' | 'in-progress' | 'completed';
export type UserRole = 'admin' | 'manager' | 'client' | 'pending';

export interface AIMetrics {
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  impressions?: number;
  reach?: number;
  followers?: number;
  blogViews?: number;
  cafeViews?: number;
  watchTime?: string;
  subscribers?: number;
  clicks?: number;
  custom?: { label: string; value: string }[];
  aiAnalyzed?: boolean;
  analyzedAt?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department?: string;
  clientId?: string;
  password: string;
}

// 스케줄 담당자 드롭다운에 쓰는 팀원 (승인된 manager/admin)
export interface TeamMember {
  id: string;
  name: string;
  department?: string;  // 팀 (마케팅팀/디자인팀/영상팀/총괄팀/대표)
  title?: string;       // 직함 (사원~부장)
  position?: string;    // 직책 (팀장/파트장/실장/본부장/이사/대표이사/매니저/PD/감독)
}

// AI 기획 결과 (내역으로 보관 — 재생성 없이 다시 보기 위함)
// 이미지는 플랫폼별 "그리드 시안"(2×2=4안 / 3×3=9안) 한 장으로 생성된다.
export interface AiPlanImage {
  id: string;
  platform: string;   // 플랫폼 키 (naver-blog, sns-feed 등)
  channel: string;    // 표시용 라벨 (네이버 블로그 등)
  url: string;        // base64 data URL
  cols: number;       // 그리드 열 수 (2 또는 3)
  saved?: boolean;    // 사용자가 "저장"한 시안만 DB에 영속화됨
}
export interface AiPlanResult {
  id: string;
  createdAt: number;
  clientId: string;    // 인수인계 연계용
  clientName: string;
  campaignType: string;
  period: { start: string; end: string };
  guideline: string;   // 이미지 재생성 시 재사용
  report: string;
  authorName?: string; // 작성자
  images: AiPlanImage[]; // 세션 한정(공유 저장 안 됨)
}

// ── 대시보드 AI 어시스턴트 ──
// 어시스턴트가 제안하는 액션들 (사용자가 "적용" 해야 반영됨)
export interface AssistantProposalEntry { date?: string; endDate?: string | null; managerName?: string; clientName?: string; category?: string; keyword?: string; status?: string; link?: string; rank?: number | string; recurrence?: Recurrence }
// 변경 대상 식별: id 가 1순위지만, AI 가 긴 내부 id 를 틀리게 옮기는 경우가 많아
// clientName·keyword·matchDate(=대상 일정의 날짜) 로도 기존 일정을 찾을 수 있게 한다.
export interface AssistantProposalUpdate { id?: string; clientName?: string; keyword?: string; matchDate?: string | null; date?: string | null; endDate?: string | null; managerName?: string | null; status?: string | null; link?: string | null; rank?: number | string | null }
// 클라이언트는 추가/수정/삭제를 op 로 구분 (수정·삭제는 id 사용). reportAnchorDate = 월간 보고 기준 시작일.
export interface AssistantProposalClient { op?: 'add' | 'update' | 'delete'; id?: string; name?: string; industry?: string; categories?: string[]; contactPerson?: string; phone?: string; email?: string; status?: 'active' | 'inactive' | 'pending'; reportAnchorDate?: string }
export interface AssistantProposalHandover { clientName?: string; overview?: string }
// 다른 담당자에게 보낼 업무 요청 (예: "방두환한테 디자인 제작 요청해줘")
export interface AssistantProposalRequest { toName?: string; title?: string; body?: string }
// 사내 내부 일정 (예: "내일 3시 디자인팀 회의 잡아줘", "금요일 면접 일정")
// op:'update' + id 면 기존 내부 일정 수정(참여자는 합쳐 추가). 생략/add 면 신규.
export interface AssistantProposalInternal { op?: 'add' | 'update'; id?: string; title?: string; category?: string; date?: string; endDate?: string | null; startTime?: string; endTime?: string; participantNames?: string[]; location?: string; notes?: string; reminder?: string }
export interface AssistantProposalVendor { name?: string; services?: string; contactPerson?: string; phone?: string; email?: string; pricing?: string; notes?: string }
// 아이디 목록/홈페이지 목록은 추가·수정·삭제를 op 로 구분
export interface AssistantAccountOp { op?: 'add' | 'update' | 'delete'; id?: string; name?: string; platform?: string; grade?: string; ownership?: 'client' | 'inhouse'; username?: string; password?: string; category?: string; ip?: string }
export interface AssistantSiteOp { op?: 'add' | 'update' | 'delete'; id?: string; name?: string; url?: string; username?: string; password?: string; description?: string }
// 키워드 조회수(대시보드 어시스턴트가 네이버 키워드도구로 조회한 결과 — 모바일/PC/총)
export interface KeywordStat { keyword: string; mobile: number | string; pc: number | string; total: number; found: boolean }
// 적용을 되돌리기 위해 저장하는 스냅샷(생성된 레코드 id + 삭제/수정 전 원본)
export interface AssistantUndo {
  entryIds: string[];
  clientIds: string[];
  vendorIds: string[];
  handoverIds: string[];
  deletedEntries: ScheduleEntry[]; // 삭제했던 일정(되돌릴 때 복원)
  updatedPrev: ScheduleEntry[];    // 수정 전 원본(되돌릴 때 복원)
  // 클라이언트 수정/삭제 되돌리기 (삭제 시 연결 인수인계도 함께 스냅샷)
  deletedClients?: Client[];
  updatedClientsPrev?: Client[];
  deletedHandovers?: HandoverDoc[];
  // 아이디 목록/홈페이지 목록
  accountIds: string[];
  siteIds: string[];
  requestIds?: string[];           // 어시스턴트로 생성한 업무 요청(되돌릴 때 삭제)
  internalEventIds?: string[];     // 어시스턴트로 생성한 내부 일정(되돌릴 때 삭제)
  updatedInternalPrev?: InternalEvent[]; // 어시스턴트로 수정한 내부 일정의 이전 상태(되돌릴 때 복원)
  salesIds?: string[];             // 어시스턴트로 생성한 상담 기록(되돌릴 때 삭제)
  updatedSalesPrev?: SalesEntry[]; // 어시스턴트로 수정한 상담의 이전 상태(되돌릴 때 복원)
  deletedAccounts: AccountEntry[];
  deletedSites: SiteEntry[];
  updatedAccountsPrev: AccountEntry[];
  updatedSitesPrev: SiteEntry[];
}
export interface AssistantMessage {
  role: 'user' | 'assistant';
  text: string;
  entries?: AssistantProposalEntry[];
  updates?: AssistantProposalUpdate[];
  clients?: AssistantProposalClient[];
  handovers?: AssistantProposalHandover[];
  vendors?: AssistantProposalVendor[];
  accounts?: AssistantAccountOp[];  // 아이디 목록 추가/수정/삭제
  sites?: AssistantSiteOp[];        // 홈페이지 목록 추가/수정/삭제
  requests?: AssistantProposalRequest[]; // 다른 담당자에게 보낼 업무 요청
  internalEvents?: AssistantProposalInternal[]; // 사내 내부 일정
  sales?: AssistantProposalSales[]; // 영업관리 상담 기록 추가/수정
  accountLookups?: string[];        // 조회 답변에 복사 카드로 표시할 아이디 목록 id
  siteLookups?: string[];           // 조회 답변에 복사 카드로 표시할 홈페이지 id
  deletes?: string[];         // 삭제할 기존 일정 id
  keywords?: string[];        // 조회 요청된 키워드(조회수 질문 시)
  keywordStats?: KeywordStat[]; // 조회 결과(모바일/PC/총)
  applied?: number; // 적용한 건수(적용 후 표시)
  undo?: AssistantUndo; // 적용 후 되돌리기용 스냅샷
  undone?: boolean;   // 되돌리기 완료 표시
}

// AI 어시스턴트 대화(채팅) — 계정별로 여러 개를 만들고 기록을 관리한다.
// 개인 대화이므로 Supabase 에 소유자(user_id) RLS 로 저장한다(공유 데이터 아님).
export interface AssistantConversation {
  id: string;
  title: string;        // 첫 사용자 메시지에서 자동 생성(없으면 '새 대화')
  messages: AssistantMessage[];
  createdAt: number;
  updatedAt: number;
}

export type AccountStatus = 'active' | 'suspended';

// Supabase 인증 + profiles 테이블에서 만들어지는 로그인 사용자
export interface AuthUser {
  id: string;          // auth.users.id (uuid)
  name: string;
  email: string;
  role: UserRole;
  department?: string;
  title?: string;       // 직함
  position?: string;    // 직책
  clientId?: string;
  status?: AccountStatus;   // 'suspended' 면 내부 접근 차단
  salesAccess?: boolean;    // 영업관리(상담 로그) 게시판 접근 권한 — 관리자가 사람별로 부여
}

// 첨부 이미지 종류: 'design'=시안/결과물(그리드로 작게), 'insight'=인사이트 캡처(글씨·숫자·그래프 → 크게·잘림없이)
export type ImageKind = 'design' | 'insight';
export interface EntryImage {
  url: string;       // base64 data URL
  kind: ImageKind;
}

// 반복 일정 규칙 — 등록 시 해당 날짜마다 실제 일정(ScheduleEntry)들을 생성하고 seriesId 로 묶는다.
//  • 규칙형(가상)이 아니라 실체화 방식: 각 회차가 독립 레코드라 상태·링크·순위·지표를 따로 가진다.
export interface Recurrence {
  freq: 'daily' | 'weekly' | 'monthly';
  interval: number;   // 1=매주/매월, 2=격주/격월
  weekday?: number;   // weekly: 0(일)~6(토)
  day?: number;       // monthly: 1~31 (그 달에 그 날이 없으면 말일로 당김)
  count?: number;     // 생성 횟수(종료일 미지정 시)
  until?: string;     // 종료일 YYYY-MM-DD (있으면 이 날까지 생성)
}

export interface ScheduleEntry {
  id: string;
  date: string;        // 시작일 (하루 작업이면 종료일과 동일)
  endDate?: string;    // 마감일 (기간 작업일 때만; 없으면 date 하루)
  seriesId?: string;       // 같은 반복에서 생성된 일정 묶음 id (시리즈 일괄 삭제용)
  recurrence?: Recurrence; // 생성 근거(시리즈 대표 정보, 첫 회차에 보관)
  managerId: string;
  managerName: string;
  category: Category;
  keyword?: string;
  link?: string;
  rank?: number;
  opinionTitle?: string;
  opinionContent?: string;
  opinionComments?: string;
  screenshot?: string;             // 레거시: 단일 이미지 (신규는 images 사용 — entryImages 헬퍼로 통합 조회)
  images?: (string | EntryImage)[]; // 첨부 이미지, 최대 10장. 문자열은 레거시(시안 취급), 신규는 {url,kind}
  metrics?: AIMetrics;
  clientId: string;
  clientName: string;
  status: ScheduleStatus;
  notes?: string;
}

// 월 예산 내 상품(서비스)별 배분 항목. amount 는 "만원" 단위 숫자.
export interface BudgetItem {
  id: string;
  product: string;   // 예: 네이버 블로그 관리, 자동완성, 여론작업, 영상제작, 유튜브
  amount: number;    // 만원 단위
  notes?: string;
}

export interface Client {
  id: string;
  name: string;
  industry: string;
  contactPerson: string;
  email: string;
  phone: string;
  startDate: string;
  contractEnd?: string;
  categories: Category[];
  status: 'active' | 'inactive' | 'pending';
  description?: string;
  monthlyBudget?: string;
  budgetItems?: BudgetItem[];
  // ── 월간 보고서 자동화 (고정 30일 롤링) ──
  // 기준 시작일부터 30일 단위로 구간을 끊는다. 예) 6/5 → 6/5~7/5, 다음 7/5~8/4, …
  // 종료 당일 작업까지 포함되고 그 다음 날(종료+1) 자동 공개된다. 비우면 계약 시작일(startDate)을 기준으로 사용.
  reportAnchorDate?: string;      // 보고 기준 시작일 (YYYY-MM-DD). 설정 시 30일 주기로 월간 보고서 자동 생성
  reportPeriods?: ReportPeriod[]; // 수동 지정 기간(예: 5/1~5/31, 공개일 직접 지정)
}

// ── 외주사(아웃소싱 파트너) ──────────────────────────
// 자체 처리 못 하는 작업(영수증리뷰, 앱설치, 앱후기 등)을 맡기는 외부 업체.
// 서비스는 드롭다운/체크가 아니라 자유 서술(services)로 관리한다.
export interface Vendor {
  id: string;
  name: string;
  services: string;       // 제공 서비스 자유 서술 (예: "영수증리뷰, 앱설치, 앱후기, 체험단")
  contactPerson?: string;
  phone?: string;
  email?: string;
  pricing?: string;       // 단가/정산 메모 (선택)
  notes?: string;         // 특이사항/메모
  status: 'active' | 'inactive';
}

// ── 아이디 목록 (블로그/SNS/유튜브 등 계정) ──
// 메모장 양식은 username,password,(category),ip 파생값(저장 안 함, 표시 시 생성).
export interface AccountEntry {
  id: string;
  name: string;        // 이름 (블로그/SNS/유튜브 등 무엇이든)
  platform?: string;   // 구분: 블로그 | SNS | 유튜브 | 기타
  grade?: string;      // 블로그 등급: 준최2~준최6 / 최적1~최적4 (블로그일 때만)
  ownership?: 'client' | 'inhouse'; // 소유: 업체 소유 | 사내 계정
  username: string;    // 아이디
  password: string;    // 비밀번호
  category?: string;   // 카테고리(없으면 생략)
  ip?: string;         // 프록시 아이피(:포트)
}

// ── 홈페이지 목록 (회사가 사용하는 외부 사이트 + 사내 계정) ──
export interface SiteEntry {
  id: string;
  name: string;          // 홈페이지 이름
  url?: string;          // 주소
  username?: string;     // 회사 내 사용 아이디
  password?: string;     // 비밀번호
  description?: string;  // 어떤 홈페이지인지/용도 (예: 문자발송, 외주 주문)
}

export interface Report {
  id: string;
  clientId: string;
  clientName?: string;
  title: string;
  date: string;            // 발행일(생성일). 표시용
  period: string;          // 사람이 읽는 기간 라벨 (예: "2026년 5월" / "2026.05.01 ~ 05.31")
  type: 'monthly' | 'weekly' | 'custom';
  summary: string;
  highlights?: string[];
  fileSize?: string;
  // ── 자동 월간 보고서용 ──
  periodStart?: string;    // 집계 시작일 YYYY-MM-DD (있으면 PDF/집계가 이 기간을 사용)
  periodEnd?: string;      // 집계 종료일 YYYY-MM-DD
  releaseDate?: string;    // 공개일 — 오늘 ≥ releaseDate 면 클라이언트 포털에 노출
  aiGenerated?: boolean;   // AI 요약 성공 여부 (false면 규칙기반 폴백)
  createdAt?: number;
}

// ── 알림 ──────────────────────────────────────────────
// 우측 상단 종 아이콘에 쌓이는 인앱 알림. 읽음 상태·데스크톱 권한은 기기마다 다르므로
// localStorage(기기별)에만 저장하고 Supabase 동기화는 하지 않는다.
export interface AppNotification {
  id: string;
  type: 'schedule' | 'ai-plan' | 'ai-image' | 'assistant' | 'request' | 'internal' | 'rank';
  title: string;
  body?: string;
  link?: string;        // 클릭 시 이동할 라우트 (예: '/ai-results', '/schedule/daily')
  createdAt: number;
  read: boolean;
}

// 화면 우하단에 잠깐 띄우는 스티커 알림(휘발성) — PC/종 알림과 별개로 "눈에 보이는" 확인용.
// 새 스케줄 등록처럼 놓치기 쉬운 알림을 이중으로 보여줄 때 사용.
export interface StickyNotice {
  id: string;
  type: AppNotification['type'];
  title: string;
  body?: string;
  link?: string;
}

// ── 업무 요청(요청함) ──────────────────────────────────
// 다른 담당자에게 보내는 "이것 좀 해줘" 요청. 일정과 별개로 일정 없이도 가능.
// 흐름: pending(대기) → confirmed(담당자 확인) → done(완료).
// 사내 공유 데이터라 localStorage 캐시 + Supabase 영속 + realtime 으로 상대 화면에 반영.
// returned = 요청자가 잘못 보낸 요청을 회수/반려한 상태
export type RequestStatus = 'pending' | 'confirmed' | 'done' | 'returned';
export interface WorkRequest {
  id: string;
  fromUid: string;     // 요청자 (로그인 사용자 id)
  fromName: string;
  toUid: string;       // 담당자 (members 의 id = profiles.id)
  toName: string;
  title: string;       // 요청 내용 한 줄 (예: "디자인 제작")
  body?: string;       // 상세 설명 (선택)
  status: RequestStatus;
  createdAt: number;
  confirmedAt?: number;
  doneAt?: number;
  doneNote?: string;   // 완료 시 담당자가 남기는 선택 메모(결과물 NAS 경로 등) → 요청자에게 전달
  returnedAt?: number;
}

// ── 내부 일정 ─────────────────────────────────────────
// 클라이언트로 넘어가지 않는 사내 일정(회의실·미팅·면접·촬영·휴가 등). 종류(카테고리)는 확장 가능.
export interface InternalCategory {
  id: string;
  name: string;
  color: string;   // hex
}
// 시작 시각 기준 사전 알림. off=알림 없음, onTime=정각(시작 시각)
export type ReminderOption = 'off' | '1h' | '30m' | '10m' | 'onTime';
export interface InternalEvent {
  id: string;
  title: string;
  category: string;            // InternalCategory.name
  date: string;                // 시작일 YYYY-MM-DD
  endDate?: string;            // 종료일 (기간일 때)
  startTime?: string;          // HH:MM (선택)
  endTime?: string;            // HH:MM (선택)
  participantIds: string[];    // 담당자/참여자 (members id)
  participantNames: string[];
  location?: string;           // 장소(회의실 등)
  notes?: string;
  reminder?: ReminderOption;   // 시작 N분 전 PC+스티커 알림 (참여자 전원)
  createdAt: number;
}

// ── 순위 보장 (순위가 잡혀야 카운팅되는 보장형 상품) ──────
// 키워드(항목) 단건이 "1건". 항목의 rank 가 채워지면(값 존재) 카운트되고,
// 보장 목표(guaranteedCount)에 도달하면 연장 여부를 체크한다. 목표 N건 전(alertOffset)에 알림.
//  • 카운트는 저장값이 아니라 items 에서 매번 파생(파생 규칙은 utils/rankGuarantee.ts).
//  • status 는 파생 결과를 캐시한 값 — 전이(active→due_soon→reached) 감지로 알림을 1회만 띄운다.
//  • 다른 업무 데이터와 동일하게 localStorage 캐시 + Supabase(rank_guarantees) + realtime 으로 공유.
export type RankGuaranteeStatus = 'active' | 'due_soon' | 'reached' | 'closed';
//  진행중      / 임박(목표-offset 도달) / 도달(목표 달성)    / 종료(연장 안 함)

// 항목 1개 = "1건". rank 값이 있으면 카운트 대상.
export interface RankGuaranteeItem {
  id: string;
  cycle: number;       // 소속 회차(연장 시 +1) — 현재 회차 항목만 카운트
  keyword: string;     // 키워드/항목명
  rank?: number;       // 순위. 값이 있으면 '유효=카운트'(1~N위 제한 없음)
  rankedAt?: string;   // 순위 최초 기재일 YYYY-MM-DD
  memo?: string;
}

export interface RankGuarantee {
  id: string;
  clientId: string;        // Client 참조(임베드 아님)
  clientName: string;      // 표시 캐시(클라이언트명 변경 시 갱신)
  title: string;           // 상품/캠페인명 (예: "네이버 자동완성 보장")
  guaranteedCount: number; // 보장 목표 건수 (입력 가능, 기본 20)
  alertOffset: number;     // 목표 몇 건 전에 알림 (입력 가능, 기본 2)
  cycle: number;           // 현재 회차 (연장 시 +1)
  closed?: boolean;        // 종료(연장 안 함) — true 면 카운팅/알림 멈춤
  status: RankGuaranteeStatus; // 파생 결과 캐시 + 전이 감지용
  items: RankGuaranteeItem[];
  reachedAt?: string;      // 목표 도달일 YYYY-MM-DD (도달 시 기록)
  createdAt: number;
  updatedAt: number;
}

// ── 단가표 ────────────────────────────────────────────
// 외부 마케팅 쇼핑몰(shop.gpakorea.com)에서 수집한 패키지/단일 상품 가격표.
// 소스 상품 1개 = PriceProduct 1개. 그 안에 옵션 그룹(패키지/단일)과 옵션 가격이 담긴다.
// 다른 업무 데이터와 동일하게 localStorage 캐시 + Supabase(price_table) 로 영속화한다.
export interface PriceOption {
  name: string;   // 옵션명(예: "스토어 알림받기 100건")
  price: number;  // 가격(원)
  desc?: string;  // 옵션 설명(소스에서 클릭 시 펼쳐지는 상세 — summary, 줄바꿈 정리됨)
}
export interface PriceGroup {
  title: string;       // 옵션 그룹명(예: "리워드 트래픽", "[Best] 리뷰+순위부스팅 패키지")
  isPackage: boolean;  // 패키지 여부(그룹명에 "패키지" 포함)
  options: PriceOption[];
}
export interface PriceProduct {
  id: string;        // 소스 상품 id(item/view/{id})
  name: string;      // 상품명
  category: string;  // 대분류(소스 breadcrumb 첫 단계)
  url: string;       // 원본 상품 링크
  repPrice: number;  // 대표가 = 판매중 옵션 중 최저가(메인 화면 "○원~" 와 동일)
  groups: PriceGroup[];
  updatedAt: number; // 수집 시각(ms)
}

// ── 영업관리 (상담 로그) ───────────────────────────────
// 회사 공용 전화/문의폼 상담을 누가 응대했고 결과가 어땠는지 기록한다.
//  • 민감정보(고객 전화/이메일)라 권한(profiles.sales_access)이 있는 사람만 보고, Supabase RLS 로 서버 차단.
//  • 다른 데이터와 달리 localStorage 캐시는 두지 않는다(공용 PC 에 고객정보가 남지 않도록).
export type SalesChannel = 'phone' | 'inquiry' | 'referral' | 'etc';  // 전화 / 이메일 / 소개 / 기타
export type SalesSentiment = 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative';
export type SalesStatus = 'new' | 'absent' | 'prospect' | 'in_progress' | 'done' | 'hold'; // 신규(미처리)/부재/가망/진행중/완료/보류
// 상담 답글(후속 통화·메모) — 같은 고객사 상담을 수정에 들어가지 않고 그 밑에 이어서 기록
export interface SalesReply {
  id: string;
  content: string;          // 후속 상담 내용
  handlerId: string;        // 답글 작성자(응대자) profiles.id
  handlerName: string;
  consultedAt?: string;     // 후속 상담 일시 (없으면 createdAt 사용)
  createdAt: number;
}
export interface SalesEntry {
  id: string;
  consultedAt: string;     // 상담 일시 (ISO 또는 YYYY-MM-DD HH:mm)
  handlerId: string;       // 응대자(전화 받은 사람) profiles.id
  handlerName: string;
  channel: SalesChannel;
  phone?: string;          // 전화번호 (전화 상담)
  email?: string;          // 이메일 (문의폼/이메일 상담)
  customerName?: string;   // 고객/업체명
  content: string;         // 상담 내용
  sentiment: SalesSentiment;
  status: SalesStatus;
  followUpDate?: string;   // 후속 예정일 YYYY-MM-DD (있으면 대시보드 알림)
  nasLink?: string;        // 첨부/자료 NAS 링크(녹취·문의폼 캡처 등)
  result?: string;         // 결과/메모
  tags?: string[];         // 관심 제품/태그 (분석용)
  replies?: SalesReply[];  // 후속 상담 답글 스레드(오래된 순)
  createdAt: number;
  updatedAt: number;
}

// AI 어시스턴트가 제안하는 상담 기록(추가/수정/답글)
export interface AssistantProposalSales {
  op?: 'add' | 'update' | 'reply'; // reply = 기존 상담 스레드에 답글로 이어 달기
  id?: string;            // 수정/답글 시 대상(부모) 상담 id
  consultedAt?: string;   // "YYYY-MM-DD HH:mm" 또는 "YYYY-MM-DD"
  channel?: SalesChannel;
  phone?: string;
  email?: string;
  customerName?: string;
  content?: string;
  sentiment?: SalesSentiment;
  status?: SalesStatus;
  followUpDate?: string;
  nasLink?: string;
  result?: string;
}

// 클라이언트별 수동 지정 보고 기간 (자동 주기와 별개로 추가 가능)
export interface ReportPeriod {
  id: string;
  start: string;        // YYYY-MM-DD
  end: string;          // YYYY-MM-DD
  releaseDate: string;  // YYYY-MM-DD
}

// ── 인수인계 ──────────────────────────────────────────

export interface KeyContact {
  id: string;
  name: string;
  role: string;
  phone?: string;
  email?: string;
  notes?: string;
}

export interface ImportantLink {
  id: string;
  title: string;
  url: string;
  category: string;
  notes?: string;
}

export interface HandoverDoc {
  id: string;
  clientId: string;
  clientName: string;
  title?: string;      // 수동 제목(선택). 없으면 현재 클라이언트명을 사용
  authorId: string;
  authorName: string;
  updatedAt: string;
  overview: string;
  keyContacts: KeyContact[];
  importantLinks: ImportantLink[];
  guidelines: string;
  tone: string;
  dontDo: string;
  specialNotes: string;
  managerMemo: string;
}
