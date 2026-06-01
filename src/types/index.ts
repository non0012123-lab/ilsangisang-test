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
  department?: string;
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
export interface AssistantProposalEntry { date?: string; endDate?: string | null; managerName?: string; clientName?: string; category?: string; keyword?: string; status?: string }
export interface AssistantProposalUpdate { id?: string; date?: string | null; endDate?: string | null; managerName?: string | null; status?: string | null }
// 클라이언트는 추가/수정/삭제를 op 로 구분 (수정·삭제는 id 사용). reportAnchorDate = 월간 보고 기준 시작일.
export interface AssistantProposalClient { op?: 'add' | 'update' | 'delete'; id?: string; name?: string; industry?: string; categories?: string[]; contactPerson?: string; phone?: string; email?: string; status?: 'active' | 'inactive' | 'pending'; reportAnchorDate?: string }
export interface AssistantProposalHandover { clientName?: string; overview?: string }
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
  clientId?: string;
  status?: AccountStatus;   // 'suspended' 면 내부 접근 차단
}

// 첨부 이미지 종류: 'design'=시안/결과물(그리드로 작게), 'insight'=인사이트 캡처(글씨·숫자·그래프 → 크게·잘림없이)
export type ImageKind = 'design' | 'insight';
export interface EntryImage {
  url: string;       // base64 data URL
  kind: ImageKind;
}

export interface ScheduleEntry {
  id: string;
  date: string;        // 시작일 (하루 작업이면 종료일과 동일)
  endDate?: string;    // 마감일 (기간 작업일 때만; 없으면 date 하루)
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
  type: 'schedule' | 'ai-plan' | 'ai-image' | 'assistant';
  title: string;
  body?: string;
  link?: string;        // 클릭 시 이동할 라우트 (예: '/ai-results', '/schedule/daily')
  createdAt: number;
  read: boolean;
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
