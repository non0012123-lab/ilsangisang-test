import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { ScheduleEntry, Client, HandoverDoc, TeamMember } from '../types';
import { SCHEDULE_ENTRIES, CLIENTS, HANDOVER_DOCS, USERS } from '../data/mockData';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

interface AppContextType {
  entries: ScheduleEntry[];
  setEntries: React.Dispatch<React.SetStateAction<ScheduleEntry[]>>;
  clients: Client[];
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  handoverDocs: HandoverDoc[];
  setHandoverDocs: React.Dispatch<React.SetStateAction<HandoverDoc[]>>;
  members: TeamMember[];
  reloadMembers: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

// Supabase 미설정 시 사용할 기본 담당자 목록 (mock)
const MOCK_MEMBERS: TeamMember[] = USERS
  .filter(u => u.role !== 'client')
  .map(u => ({ id: u.id, name: u.name, department: u.department }));

export function AppProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<ScheduleEntry[]>(SCHEDULE_ENTRIES);
  const [clients, setClients] = useState<Client[]>(CLIENTS);
  const [handoverDocs, setHandoverDocs] = useState<HandoverDoc[]>(HANDOVER_DOCS);
  const [members, setMembers] = useState<TeamMember[]>(MOCK_MEMBERS);

  // 승인된 담당자(manager)·관리자(admin)를 profiles 에서 읽어 드롭다운 목록을 구성
  const reloadMembers = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, department, role')
      .in('role', ['manager', 'admin'])
      .order('name', { ascending: true });
    if (error || !data) return;
    setMembers(data.map(r => ({
      id: r.id,
      name: (r.name as string | null) ?? '이름없음',
      department: (r.department as string | null) ?? undefined,
    })));
  }, []);

  // 로그인이 완료된 뒤(인증 세션 생성)에야 RLS가 profiles 조회를 허용하므로,
  // user 가 바뀔 때(로그인/로그아웃)마다 담당자 목록을 다시 불러온다.
  useEffect(() => { reloadMembers(); }, [user?.id, reloadMembers]);

  return (
    <AppContext.Provider value={{ entries, setEntries, clients, setClients, handoverDocs, setHandoverDocs, members, reloadMembers }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
