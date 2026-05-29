import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import type { ScheduleEntry, Client, HandoverDoc, TeamMember, AiPlanResult } from '../types';
import { SCHEDULE_ENTRIES, CLIENTS, HANDOVER_DOCS, USERS } from '../data/mockData';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

interface AppContextType {
  entries: ScheduleEntry[];
  clients: Client[];
  handoverDocs: HandoverDoc[];
  members: TeamMember[];
  reloadMembers: () => Promise<void>;
  aiHistory: AiPlanResult[];
  setAiHistory: React.Dispatch<React.SetStateAction<AiPlanResult[]>>;
  // 업무 데이터 영구 저장(레코드 단위) — 로컬 상태 갱신 + Supabase 반영
  saveEntry: (entry: ScheduleEntry) => void;
  saveEntries: (entries: ScheduleEntry[]) => void;
  patchEntry: (id: string, patch: Partial<ScheduleEntry>) => void;
  removeEntry: (id: string) => void;
  saveClient: (client: Client) => void;
  saveHandover: (doc: HandoverDoc) => void;
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
  const [aiHistory, setAiHistory] = useState<AiPlanResult[]>([]);
  const uid = user?.id;

  // 헬퍼에서 최신 배열을 참조하기 위한 ref (setState 업데이터 내 부수효과 회피)
  const entriesRef = useRef(entries);
  useEffect(() => { entriesRef.current = entries; }, [entries]);

  // ── Supabase 영속화 헬퍼 (있으면 비동기로 반영, 실패는 콘솔에만) ──
  const persistOne = (table: string, row: { id: string }) => {
    if (!supabase) return;
    supabase.from(table).upsert({ id: row.id, data: row }).then(({ error }) => {
      if (error) console.error(`[${table}] 저장 실패:`, error.message);
    });
  };
  const persistMany = (table: string, rows: { id: string }[]) => {
    if (!supabase || rows.length === 0) return;
    supabase.from(table).upsert(rows.map(r => ({ id: r.id, data: r }))).then(({ error }) => {
      if (error) console.error(`[${table}] 저장 실패:`, error.message);
    });
  };
  const persistDelete = (table: string, id: string) => {
    if (!supabase) return;
    supabase.from(table).delete().eq('id', id).then(({ error }) => {
      if (error) console.error(`[${table}] 삭제 실패:`, error.message);
    });
  };

  // ── 스케줄 ──
  const saveEntry = useCallback((entry: ScheduleEntry) => {
    setEntries(prev => prev.some(e => e.id === entry.id) ? prev.map(e => e.id === entry.id ? entry : e) : [entry, ...prev]);
    persistOne('schedule_entries', entry);
  }, []);
  const saveEntries = useCallback((list: ScheduleEntry[]) => {
    setEntries(prev => {
      const ids = new Set(list.map(e => e.id));
      return [...list, ...prev.filter(e => !ids.has(e.id))];
    });
    persistMany('schedule_entries', list);
  }, []);
  const patchEntry = useCallback((id: string, patch: Partial<ScheduleEntry>) => {
    const cur = entriesRef.current.find(e => e.id === id);
    if (!cur) return;
    const updated = { ...cur, ...patch };
    setEntries(prev => prev.map(e => e.id === id ? updated : e));
    persistOne('schedule_entries', updated);
  }, []);
  const removeEntry = useCallback((id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
    persistDelete('schedule_entries', id);
  }, []);

  // ── 클라이언트 ──
  const saveClient = useCallback((client: Client) => {
    setClients(prev => prev.some(c => c.id === client.id) ? prev.map(c => c.id === client.id ? client : c) : [...prev, client]);
    persistOne('clients', client);
  }, []);

  // ── 인계문서 ──
  const saveHandover = useCallback((doc: HandoverDoc) => {
    setHandoverDocs(prev => prev.some(d => d.id === doc.id) ? prev.map(d => d.id === doc.id ? doc : d) : [...prev, doc]);
    persistOne('handover_docs', doc);
  }, []);

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

  // 로그인 시 업무 데이터를 Supabase 에서 로드. 테이블이 비어 있으면 목업으로 1회 시드.
  useEffect(() => {
    if (!supabase || !uid) return;
    const sb = supabase;
    let active = true;
    (async () => {
      const load = async <T,>(table: string): Promise<T[] | null> => {
        const { data, error } = await sb.from(table).select('id, data');
        if (error) { console.error(`[${table}] 로드 실패:`, error.message); return null; }
        return (data ?? []).map(r => r.data as T);
      };
      const seed = async <T extends { id: string }>(table: string, rows: T[]) => {
        await sb.from(table).upsert(rows.map(r => ({ id: r.id, data: r })));
      };
      let c = await load<Client>('clients');
      let e = await load<ScheduleEntry>('schedule_entries');
      let h = await load<HandoverDoc>('handover_docs');
      if (!active) return;
      if (c && c.length === 0) { await seed('clients', CLIENTS); c = CLIENTS; }
      if (e && e.length === 0) { await seed('schedule_entries', SCHEDULE_ENTRIES); e = SCHEDULE_ENTRIES; }
      if (h && h.length === 0) { await seed('handover_docs', HANDOVER_DOCS); h = HANDOVER_DOCS; }
      if (!active) return;
      if (c) setClients(c);
      if (e) setEntries(e);
      if (h) setHandoverDocs(h);
    })();
    return () => { active = false; };
  }, [uid]);

  return (
    <AppContext.Provider value={{
      entries, clients, handoverDocs, members, reloadMembers, aiHistory, setAiHistory,
      saveEntry, saveEntries, patchEntry, removeEntry, saveClient, saveHandover,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
