export type Category = 'SNS' | '유튜브' | '네이버' | '영상제작' | '디자인제작' | '네이버 여론작업' | '기타';
export type ScheduleStatus = 'pending' | 'in-progress' | 'completed';
export type UserRole = 'admin' | 'manager' | 'client';

export interface AIMetrics {
  views?: number;        // 조회수
  likes?: number;        // 좋아요
  comments?: number;     // 댓글수
  shares?: number;       // 공유수
  saves?: number;        // 저장수
  impressions?: number;  // 노출수
  reach?: number;        // 도달수
  followers?: number;    // 팔로워수
  blogViews?: number;    // 블로그 조회수
  cafeViews?: number;    // 카페 조회수
  watchTime?: string;    // 시청 시간
  subscribers?: number;  // 구독자수
  clicks?: number;       // 클릭수
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

export interface ScheduleEntry {
  id: string;
  date: string;
  managerId: string;
  managerName: string;
  category: Category;
  // 일반 카테고리 필드
  keyword?: string;
  link?: string;
  rank?: number;
  // 네이버 여론작업 전용 필드
  opinionTitle?: string;   // 제목
  opinionContent?: string; // 내용
  opinionComments?: string; // 댓글
  // 공통
  screenshot?: string;
  metrics?: AIMetrics;     // AI 분석 결과 (인사이트 데이터)
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
