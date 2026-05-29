export type Category = 'SNS' | '유튜브' | '네이버' | '영상제작' | '디자인제작' | '기타';
export type ScheduleStatus = 'pending' | 'in-progress' | 'completed';
export type UserRole = 'admin' | 'manager' | 'client';

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
  keyword: string;
  link: string;
  rank?: number;
  screenshot?: string;
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
