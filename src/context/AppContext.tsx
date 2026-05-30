import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import type { ScheduleEntry, Client, HandoverDoc, TeamMember, AiPlanResult, AiPlanImage } from '../types';
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
  saveAiPlan: (plan: AiPlanResult) => void;
  removeAiPlan: (id: string) => void;
  // AI 기획 분석을 앱 전역에서 실행 → 페이지를 떠나도 계속 진행되고 결과가 보관됨
  aiPlanRunning: boolean;
  aiPlanError: string;
  startAiPlanJob: (input: AiPlanJobInput) => Promise<string | null>;
  // 현재 진행 중이거나 직전에 완료된 분석 결과의 id (페이지 리마운트와 무관하게 결과 화면 복원용)
  activeAiPlanId: string | null;
  clearActiveAiPlan: () => void;
  // 이미지 시안 생성도 앱 전역에서 실행 → 다른 메뉴로 이동해도 계속 생성되고 결과가 보관됨
  aiImageRunning: string | null; // 생성 중인 기획 결과 id (없으면 null)
  aiImageError: string;
  startAiImageJob: (planId: string, platforms: string[], cols: number) => Promise<void>;
  // 업무 데이터 영구 저장(레코드 단위) — 로컬 상태 갱신 + Supabase 반영
  saveEntry: (entry: ScheduleEntry) => void;
  saveEntries: (entries: ScheduleEntry[]) => void;
  patchEntry: (id: string, patch: Partial<ScheduleEntry>) => void;
  removeEntry: (id: string) => void;
  saveClient: (client: Client) => void;
  saveHandover: (doc: HandoverDoc) => void;
  removeHandover: (id: string) => void;
}

export interface AiPlanJobInput {
  clientId: string;
  clientName: string;
  industry?: string;
  period: { start: string; end: string };
  campaignType: string;
  goal: string;
  guideline: string;
  authorName?: string;
}

const nowMs = () => Date.now();

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
  const [aiPlanRunning, setAiPlanRunning] = useState(false);
  const [aiPlanError, setAiPlanError] = useState('');
  const [activeAiPlanId, setActiveAiPlanId] = useState<string | null>(null);
  const [aiImageRunning, setAiImageRunning] = useState<string | null>(null);
  const [aiImageError, setAiImageError] = useState('');
  const uid = user?.id;

  // 헬퍼에서 최신 배열을 참조하기 위한 ref (setState 업데이터 내 부수효과 회피)
  const entriesRef = useRef(entries);
  useEffect(() => { entriesRef.current = entries; }, [entries]);
  // 전역 이미지 작업이 완료 시 최신 기획 결과를 머지하기 위한 ref
  const aiHistoryRef = useRef(aiHistory);
  useEffect(() => { aiHistoryRef.current = aiHistory; }, [aiHistory]);

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
  const removeHandover = useCallback((id: string) => {
    setHandoverDocs(prev => prev.filter(d => d.id !== id));
    persistDelete('handover_docs', id);
  }, []);

  // ── AI 기획 결과 (이미지는 용량 때문에 DB 저장 제외; 로컬 세션에만 유지) ──
  const saveAiPlan = useCallback((plan: AiPlanResult) => {
    setAiHistory(prev => prev.some(p => p.id === plan.id) ? prev.map(p => p.id === plan.id ? plan : p) : [plan, ...prev]);
    // 이미지는 용량이 크므로, 사용자가 "저장"한 시안만 DB에 영속화한다(나머지는 세션 한정).
    const persisted: AiPlanResult = { ...plan, images: plan.images.filter(i => i.saved) };
    persistOne('ai_plans', persisted);
  }, []);
  const removeAiPlan = useCallback((id: string) => {
    setAiHistory(prev => prev.filter(p => p.id !== id));
    persistDelete('ai_plans', id);
  }, []);

  // AI 기획 분석을 전역에서 실행 (페이지 언마운트와 무관하게 끝까지 진행 → 결과 보관)
  const clearActiveAiPlan = useCallback(() => setActiveAiPlanId(null), []);
  const startAiPlanJob = useCallback(async (input: AiPlanJobInput): Promise<string | null> => {
    setAiPlanRunning(true);
    setAiPlanError('');
    setActiveAiPlanId(null);
    try {
      const res = await fetch('/api/ai-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: input.clientName,
          industry: input.industry,
          period: input.period,
          campaignType: input.campaignType,
          goal: input.goal,
          guideline: input.guideline,
        }),
      });
      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        throw new Error('AI 서버(/api/ai-plan)에 연결할 수 없습니다. Cloudflare Pages 배포 환경에서 동작합니다.');
      }
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.detail ? `${data.error} — ${data.detail}` : (data.error ?? `요청 실패 (${res.status})`));
      if (!data.report) throw new Error('리포트가 비어 있습니다.');

      const ts = nowMs();
      const result: AiPlanResult = {
        id: ts.toString(),
        createdAt: ts,
        clientId: input.clientId,
        clientName: input.clientName,
        campaignType: input.campaignType,
        period: { ...input.period },
        guideline: input.guideline,
        report: data.report as string,
        authorName: input.authorName,
        images: [],
      };
      saveAiPlan(result);
      setActiveAiPlanId(result.id);
      return result.id;
    } catch (e) {
      setAiPlanError(e instanceof Error ? e.message : 'AI 분석 중 오류가 발생했습니다.');
      return null;
    } finally {
      setAiPlanRunning(false);
    }
  }, [saveAiPlan]);

  // 이미지 시안 생성을 앱 전역에서 실행 → 다른 메뉴로 이동해도 끝까지 진행되고 결과가 보관됨
  const startAiImageJob = useCallback(async (planId: string, platforms: string[], cols: number) => {
    const plan = aiHistoryRef.current.find(p => p.id === planId);
    if (!plan || platforms.length === 0) return;
    setAiImageRunning(planId);
    setAiImageError('');
    try {
      const res = await fetch('/api/ai-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientName: plan.clientName, guideline: plan.guideline, platforms, cols }),
      });
      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        throw new Error('AI 서버(/api/ai-image)에 연결할 수 없습니다. Cloudflare Pages 배포 환경에서 동작합니다.');
      }
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? `요청 실패 (${res.status})`);
      const imgs: AiPlanImage[] = Array.isArray(data.images) ? data.images : [];
      // 최신 상태를 ref 로 다시 읽어, 이미 "저장"한 시안은 유지하고 새 작업본을 덧붙인다
      const latest = aiHistoryRef.current.find(p => p.id === planId) ?? plan;
      const kept = latest.images.filter(i => i.saved);
      saveAiPlan({ ...latest, images: [...kept, ...imgs] });
    } catch (e) {
      setAiImageError(e instanceof Error ? e.message : '이미지 생성 중 오류가 발생했습니다.');
    } finally {
      setAiImageRunning(null);
    }
  }, [saveAiPlan]);

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
      const plans = await load<AiPlanResult>('ai_plans');
      if (!active) return;
      if (c && c.length === 0) { await seed('clients', CLIENTS); c = CLIENTS; }
      if (e && e.length === 0) { await seed('schedule_entries', SCHEDULE_ENTRIES); e = SCHEDULE_ENTRIES; }
      if (h && h.length === 0) { await seed('handover_docs', HANDOVER_DOCS); h = HANDOVER_DOCS; }
      if (!active) return;
      if (c) setClients(c);
      if (e) setEntries(e);
      if (h) setHandoverDocs(h);
      if (plans) setAiHistory([...plans].sort((a, b) => b.createdAt - a.createdAt));
    })();
    return () => { active = false; };
  }, [uid]);

  return (
    <AppContext.Provider value={{
      entries, clients, handoverDocs, members, reloadMembers, aiHistory, saveAiPlan, removeAiPlan,
      aiPlanRunning, aiPlanError, startAiPlanJob, activeAiPlanId, clearActiveAiPlan,
      aiImageRunning, aiImageError, startAiImageJob,
      saveEntry, saveEntries, patchEntry, removeEntry, saveClient, saveHandover, removeHandover,
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
