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
export interface AssistantMessage {
  role: 'user' | 'assistant';
  text: string;
  entries?: AssistantProposalEntry[];
  updates?: AssistantProposalUpdate[];
  clients?: AssistantProposalClient[];
  handovers?: AssistantProposalHandover[];
  applied?: number; // 적용한 건수(적용 후 표시)
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
