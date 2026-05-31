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
export interface AssistantProposalClient { name?: string; industry?: string; categories?: string[]; contactPerson?: string; phone?: string; email?: string }
export interface AssistantProposalHandover { clientName?: string; overview?: string }
export interface AssistantProposalVendor { name?: string; services?: string; contactPerson?: string; phone?: string; email?: string; pricing?: string; notes?: string }
// 아이디 목록/홈페이지 목록은 추가·수정·삭제를 op 로 구분
export interface AssistantAccountOp { op?: 'add' | 'update' | 'delete'; id?: string; name?: string; username?: string; password?: string; category?: string; ip?: string }
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
  screenshot?: string;
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
  title: string;
  date: string;
  period: string;
  type: 'monthly' | 'weekly' | 'custom';
  summary: string;
  highlights?: string[];
  fileSize?: string;
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
