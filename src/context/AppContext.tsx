import { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import type { ScheduleEntry, ScheduleStatus, Client, HandoverDoc, TeamMember, AiPlanResult, AiPlanImage, Category, AssistantMessage, Vendor, AssistantUndo, AccountEntry, SiteEntry, Report, AppNotification } from '../types';
import { SCHEDULE_ENTRIES, CLIENTS, HANDOVER_DOCS, USERS } from '../data/mockData';
import { supabase } from '../lib/supabase';
import { todayStr } from '../utils/today';
import { fireDesktop, requestNotifyPermission, isNotifySupported } from '../utils/notifications';
import { useAuth } from './AuthContext';

const ASSISTANT_CATEGORIES: Category[] = ['SNS', '유튜브', '네이버', '영상제작', '디자인제작', '네이버 여론작업', '기타'];

interface AppContextType {
  entries: ScheduleEntry[];
  clients: Client[];
  handoverDocs: HandoverDoc[];
  vendors: Vendor[];
  accounts: AccountEntry[];
  siteEntries: SiteEntry[];
  reports: Report[];
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
  // 대시보드 AI 어시스턴트 (전역 → 다른 메뉴로 이동해도 대화·진행이 유지됨)
  assistantMessages: AssistantMessage[];
  assistantLoading: boolean;
  runAssistant: (text: string) => Promise<void>;
  applyAssistantProposal: (index: number) => void;
  undoAssistantProposal: (index: number) => void;
  // 업무 데이터 영구 저장(레코드 단위) — 로컬 상태 갱신 + Supabase 반영
  saveEntry: (entry: ScheduleEntry) => void;
  saveEntries: (entries: ScheduleEntry[]) => void;
  patchEntry: (id: string, patch: Partial<ScheduleEntry>) => void;
  removeEntry: (id: string) => void;
  saveClient: (client: Client) => void;
  removeClient: (id: string) => void;
  saveHandover: (doc: HandoverDoc) => void;
  removeHandover: (id: string) => void;
  saveVendor: (vendor: Vendor) => void;
  removeVendor: (id: string) => void;
  saveAccount: (account: AccountEntry) => void;
  removeAccount: (id: string) => void;
  saveSite: (site: SiteEntry) => void;
  removeSite: (id: string) => void;
  saveReport: (report: Report) => void;
  removeReport: (id: string) => void;
  // 알림(종 아이콘) — 내 스케줄 등록·AI 완료를 모아 보여주고, 다른 탭일 땐 데스크톱 알림도 띄움
  notifications: AppNotification[];
  unreadCount: number;
  markAllNotificationsRead: () => void;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;
  desktopNotifyEnabled: boolean;
  enableDesktopNotify: () => Promise<void>;
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

// 로컬 캐시 헬퍼: Supabase 에 해당 테이블이 아직 없거나 일시적으로 닿지 않아도
// 브라우저에 데이터가 남도록 한다(테이블이 생기면 Supabase 가 우선·공유 소스가 됨).
const lsLoad = <T,>(key: string): T[] => {
  try { const s = localStorage.getItem(key); return s ? (JSON.parse(s) as T[]) : []; }
  catch { return []; }
};
const lsSave = (key: string, list: unknown) => {
  try { localStorage.setItem(key, JSON.stringify(list)); } catch { /* 용량 초과 등은 무시 */ }
};
const VENDORS_LS_KEY = 'ilsangisang.vendors.v1';
const ACCOUNTS_LS_KEY = 'ilsangisang.accounts.v1';
const SITES_LS_KEY = 'ilsangisang.sites.v1';
const REPORTS_LS_KEY = 'ilsangisang.reports.v1';
const NOTIFS_LS_KEY = 'ilsangisang.notifications.v1';
const DESKTOP_NOTIFY_LS_KEY = 'ilsangisang.notify.desktop.v1';
const NOTIFS_MAX = 50; // 알림은 최근 50개까지만 보관
// AI 결과 화면 계열 경로 — 이 페이지에 머무는 동안엔 AI 완료 알림을 만들지 않는다(이미 보고 있으므로)
const AI_RESULT_PATHS = ['/ai-planning', '/ai-results'];
const loadLocalVendors = (): Vendor[] => lsLoad<Vendor>(VENDORS_LS_KEY);
const saveLocalVendors = (list: Vendor[]) => lsSave(VENDORS_LS_KEY, list);

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
  const [vendors, setVendors] = useState<Vendor[]>(loadLocalVendors);
  const [accounts, setAccounts] = useState<AccountEntry[]>(() => lsLoad<AccountEntry>(ACCOUNTS_LS_KEY));
  const [siteEntries, setSiteEntries] = useState<SiteEntry[]>(() => lsLoad<SiteEntry>(SITES_LS_KEY));
  const [reports, setReports] = useState<Report[]>(() => lsLoad<Report>(REPORTS_LS_KEY));
  const [members, setMembers] = useState<TeamMember[]>(MOCK_MEMBERS);
  const [aiHistory, setAiHistory] = useState<AiPlanResult[]>([]);
  const [aiPlanRunning, setAiPlanRunning] = useState(false);
  const [aiPlanError, setAiPlanError] = useState('');
  const [activeAiPlanId, setActiveAiPlanId] = useState<string | null>(null);
  const [aiImageRunning, setAiImageRunning] = useState<string | null>(null);
  const [aiImageError, setAiImageError] = useState('');
  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([]);
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>(() => lsLoad<AppNotification>(NOTIFS_LS_KEY));
  // 기본 켜짐 — 사용자가 명시적으로 끈('0') 경우에만 꺼진 상태로 시작
  const [desktopNotifyEnabled, setDesktopNotifyEnabled] = useState<boolean>(() => {
    try { return localStorage.getItem(DESKTOP_NOTIFY_LS_KEY) !== '0'; } catch { return true; }
  });
  const uid = user?.id;

  // 현재 라우트 경로 — AI 완료 알림 시 "그 페이지를 떠났는지" 판정용 (AppProvider 는 Router 내부라 사용 가능)
  const { pathname } = useLocation();
  const currentPathRef = useRef(pathname);
  useEffect(() => { currentPathRef.current = pathname; }, [pathname]);

  // 담당자 드롭다운(스케줄 필터·등록 모달·AI 일정 모달)에서 로그인한 본인이 맨 앞에 오도록 정렬.
  // 등록 모달은 members[0] 을 기본 담당자로 쓰므로 기본 선택도 본인이 된다. (조회용 find 는 순서 무관)
  const orderedMembers = useMemo(() => {
    const idx = uid ? members.findIndex(m => m.id === uid) : -1;
    if (idx <= 0) return members;
    return [members[idx], ...members.slice(0, idx), ...members.slice(idx + 1)];
  }, [members, uid]);

  // 헬퍼에서 최신 배열을 참조하기 위한 ref (setState 업데이터 내 부수효과 회피)
  const entriesRef = useRef(entries);
  useEffect(() => { entriesRef.current = entries; }, [entries]);
  // 어시스턴트 적용으로 막 생성한 일정 id — realtime 에코 때 (요약 알림과) 중복 알림을 막기 위해 추적
  const assistantEntryIdsRef = useRef<Set<string>>(new Set());
  // 전역 이미지 작업이 완료 시 최신 기획 결과를 머지하기 위한 ref
  const aiHistoryRef = useRef(aiHistory);
  useEffect(() => { aiHistoryRef.current = aiHistory; }, [aiHistory]);
  // 어시스턴트가 전역(언마운트 무관)으로 최신 데이터를 참조하기 위한 ref 들
  const membersRef = useRef(members);
  useEffect(() => { membersRef.current = members; }, [members]);
  const clientsRef = useRef(clients);
  useEffect(() => { clientsRef.current = clients; }, [clients]);
  const handoverDocsRef = useRef(handoverDocs);
  useEffect(() => { handoverDocsRef.current = handoverDocs; }, [handoverDocs]);
  const vendorsRef = useRef(vendors);
  useEffect(() => { vendorsRef.current = vendors; }, [vendors]);
  // 외주사가 바뀔 때마다 로컬 캐시에 보관 → 새로고침·재배포에도 유지
  useEffect(() => { saveLocalVendors(vendors); }, [vendors]);
  const accountsRef = useRef(accounts);
  useEffect(() => { accountsRef.current = accounts; }, [accounts]);
  useEffect(() => { lsSave(ACCOUNTS_LS_KEY, accounts); }, [accounts]);
  const siteEntriesRef = useRef(siteEntries);
  useEffect(() => { siteEntriesRef.current = siteEntries; }, [siteEntries]);
  useEffect(() => { lsSave(SITES_LS_KEY, siteEntries); }, [siteEntries]);
  const reportsRef = useRef(reports);
  useEffect(() => { reportsRef.current = reports; }, [reports]);
  useEffect(() => { lsSave(REPORTS_LS_KEY, reports); }, [reports]);
  // 알림은 기기별 — localStorage 에만 저장(Supabase 동기화 안 함)
  useEffect(() => { lsSave(NOTIFS_LS_KEY, notifications); }, [notifications]);
  const assistantMessagesRef = useRef(assistantMessages);
  useEffect(() => { assistantMessagesRef.current = assistantMessages; }, [assistantMessages]);
  const assistantLoadingRef = useRef(assistantLoading);
  useEffect(() => { assistantLoadingRef.current = assistantLoading; }, [assistantLoading]);
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  // ── 알림 ──────────────────────────────────────────────
  // 인앱 알림을 추가하고, 탭이 숨겨져 있으면(다른 탭/창) 데스크톱 알림도 띄운다(fireDesktop 내부에서 판정).
  const pushNotification = useCallback((n: Omit<AppNotification, 'id' | 'createdAt' | 'read'>): boolean => {
    const notif: AppNotification = { ...n, id: `ntf-${nowMs()}-${Math.random().toString(36).slice(2, 7)}`, createdAt: nowMs(), read: false };
    setNotifications(prev => [notif, ...prev].slice(0, NOTIFS_MAX));
    return fireDesktop(notif.title, notif.body, notif.type); // 데스크톱 알림이 실제로 떴는지
  }, []);
  const markAllNotificationsRead = useCallback(() => setNotifications(prev => prev.map(n => n.read ? n : { ...n, read: true })), []);
  const markNotificationRead = useCallback((id: string) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n)), []);
  const clearNotifications = useCallback(() => setNotifications([]), []);
  const enableDesktopNotify = useCallback(async () => {
    const perm = await requestNotifyPermission();
    const granted = perm === 'granted';
    setDesktopNotifyEnabled(granted);
    try { localStorage.setItem(DESKTOP_NOTIFY_LS_KEY, granted ? '1' : '0'); } catch { /* 무시 */ }
    // 허용 직후 바로 한 번 띄워 동작을 확인시켜 준다("허용했는데 안 뜬다" 방지)
    if (granted) fireDesktop('PC 알림이 켜졌어요', '이제 새 스케줄·AI 완료 알림을 데스크톱에서 받아요.');
  }, []);
  const unreadCount = useMemo(() => notifications.reduce((a, n) => a + (n.read ? 0 : 1), 0), [notifications]);

  // PC 알림은 기본 켜짐 — 로그인하면 권한을 자동 요청한다(브라우저 권한 팝업은 사용자가 한 번 "허용"해야 함).
  // 일부 브라우저(Firefox/Safari)는 사용자 제스처 없이는 요청이 막힐 수 있어, 그 경우 알림함의 "PC 알림 켜기"가 대체 수단이 된다.
  useEffect(() => {
    if (!uid || !isNotifySupported()) return;
    if (Notification.permission === 'granted') { setDesktopNotifyEnabled(true); return; }
    if (Notification.permission === 'default' && desktopNotifyEnabled) {
      requestNotifyPermission().then(perm => {
        const granted = perm === 'granted';
        setDesktopNotifyEnabled(granted);
        try { localStorage.setItem(DESKTOP_NOTIFY_LS_KEY, granted ? '1' : '0'); } catch { /* 무시 */ }
        if (granted) fireDesktop('PC 알림이 켜졌어요', '이제 새 스케줄·AI 완료 알림을 데스크톱에서 받아요.');
      });
    }
  }, [uid, desktopNotifyEnabled]);

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
  // 클라이언트 삭제(관리자 전용). 연결된 인수인계 문서도 함께 삭제하고, 스케줄(작업 이력)은 보존한다.
  const removeClient = useCallback((id: string) => {
    setClients(prev => prev.filter(c => c.id !== id));
    persistDelete('clients', id);
    const docs = handoverDocsRef.current.filter(d => d.clientId === id);
    if (docs.length) {
      setHandoverDocs(prev => prev.filter(d => d.clientId !== id));
      docs.forEach(d => persistDelete('handover_docs', d.id));
    }
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

  // ── 외주사 ──
  const saveVendor = useCallback((vendor: Vendor) => {
    setVendors(prev => prev.some(v => v.id === vendor.id) ? prev.map(v => v.id === vendor.id ? vendor : v) : [...prev, vendor]);
    persistOne('vendors', vendor);
  }, []);
  const removeVendor = useCallback((id: string) => {
    setVendors(prev => prev.filter(v => v.id !== id));
    persistDelete('vendors', id);
  }, []);

  // ── 아이디 목록 ──
  const saveAccount = useCallback((account: AccountEntry) => {
    setAccounts(prev => prev.some(a => a.id === account.id) ? prev.map(a => a.id === account.id ? account : a) : [...prev, account]);
    persistOne('accounts', account);
  }, []);
  const removeAccount = useCallback((id: string) => {
    setAccounts(prev => prev.filter(a => a.id !== id));
    persistDelete('accounts', id);
  }, []);

  // ── 홈페이지 목록 ──
  const saveSite = useCallback((site: SiteEntry) => {
    setSiteEntries(prev => prev.some(s => s.id === site.id) ? prev.map(s => s.id === site.id ? site : s) : [...prev, site]);
    persistOne('site_entries', site);
  }, []);
  const removeSite = useCallback((id: string) => {
    setSiteEntries(prev => prev.filter(s => s.id !== id));
    persistDelete('site_entries', id);
  }, []);

  // ── 월간 보고서 (전송일이 지나면 포털에서 자동 생성·캐시) ──
  const saveReport = useCallback((report: Report) => {
    setReports(prev => prev.some(r => r.id === report.id) ? prev.map(r => r.id === report.id ? report : r) : [...prev, report]);
    persistOne('reports', report);
  }, []);
  const removeReport = useCallback((id: string) => {
    setReports(prev => prev.filter(r => r.id !== id));
    persistDelete('reports', id);
  }, []);

  // ── AI 기획 결과 (이미지는 용량 때문에 DB 저장 제외; 로컬 세션에만 유지) ──
  const saveAiPlan = useCallback((plan: AiPlanResult) => {
    setAiHistory(prev => prev.some(p => p.id === plan.id) ? prev.map(p => p.id === plan.id ? plan : p) : [plan, ...prev]);
    // 생성된 이미지 시안도 함께 영속화 → 새로고침/다른 기기에서도 유지(삭제는 X 버튼으로).
    persistOne('ai_plans', plan);
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
      // AI 결과 화면을 떠나 있을 때만 알림(보고 있으면 화면에 바로 뜨므로 불필요)
      if (!AI_RESULT_PATHS.includes(currentPathRef.current)) {
        pushNotification({ type: 'ai-plan', title: 'AI 기획 완료', body: `${result.clientName} 기획 리포트가 준비됐어요`, link: '/ai-results' });
      }
      return result.id;
    } catch (e) {
      setAiPlanError(e instanceof Error ? e.message : 'AI 분석 중 오류가 발생했습니다.');
      return null;
    } finally {
      setAiPlanRunning(false);
    }
  }, [saveAiPlan, pushNotification]);

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
      // 최신 상태를 ref 로 다시 읽어, 기존 시안에 새로 생성한 시안을 덧붙인다(모두 영속화, 삭제는 X 버튼).
      const latest = aiHistoryRef.current.find(p => p.id === planId) ?? plan;
      saveAiPlan({ ...latest, images: [...latest.images, ...imgs] });
      // AI 결과 화면을 떠나 있을 때만 알림
      if (!AI_RESULT_PATHS.includes(currentPathRef.current)) {
        pushNotification({ type: 'ai-image', title: 'AI 이미지 생성 완료', body: `${plan.clientName} 이미지 시안 ${imgs.length}장이 준비됐어요`, link: '/ai-results' });
      }
    } catch (e) {
      setAiImageError(e instanceof Error ? e.message : '이미지 생성 중 오류가 발생했습니다.');
    } finally {
      setAiImageRunning(null);
    }
  }, [saveAiPlan, pushNotification]);

  // ── 대시보드 AI 어시스턴트 (전역 실행 → 다른 메뉴로 이동해도 대화·진행 유지) ──
  const runAssistant = useCallback(async (text: string) => {
    const message = text.trim();
    if (!message || assistantLoadingRef.current) return;
    const u = userRef.current;
    const isAdmin = u?.role === 'admin';
    const allEntries = entriesRef.current;
    const scoped = isAdmin ? allEntries : allEntries.filter(e => e.managerId === u?.id);
    const activeClients = clientsRef.current.filter(c => c.status !== 'inactive');
    // 가이드라인 질문에 답하기 위해 인수인계 문서·AI 기획 결과를 함께 전달
    const clientNameOf = (id: string, fallback: string) => clientsRef.current.find(c => c.id === id)?.name ?? fallback;
    const handoverContext = handoverDocsRef.current.map(d => ({
      clientName: clientNameOf(d.clientId, d.clientName),
      overview: d.overview,
      guidelines: d.guidelines,
      tone: d.tone,
      dontDo: d.dontDo,
      specialNotes: d.specialNotes,
      managerMemo: d.managerMemo,
      keyContacts: (d.keyContacts ?? []).map(k => ({ name: k.name, role: k.role, phone: k.phone, email: k.email, notes: k.notes })),
    }));
    const aiPlanContext = aiHistoryRef.current.slice(0, 20).map(p => ({
      clientName: clientNameOf(p.clientId, p.clientName),
      campaignType: p.campaignType,
      period: p.period,
      report: p.report,
    }));
    // 외주사 정보: "○○ 작업 어디에 맡겨?" 류 질문에 답하기 위해 전달
    const vendorContext = vendorsRef.current.filter(v => v.status !== 'inactive').map(v => ({
      name: v.name, services: v.services, contactPerson: v.contactPerson,
      phone: v.phone, email: v.email, pricing: v.pricing, notes: v.notes,
    }));
    // 아이디 목록 / 홈페이지 목록 (조회·수정·삭제 시 id 사용)
    // 비밀번호는 AI(OpenAI)로 보내지 않는다 — 조회는 id로 식별 후 프론트가 실제 값을 복사 카드로 보여준다.
    const accountContext = accountsRef.current.map(a => ({
      id: a.id, name: a.name, platform: a.platform, grade: a.grade, ownership: a.ownership, username: a.username, category: a.category, ip: a.ip,
    }));
    const siteContext = siteEntriesRef.current.map(s => ({
      id: s.id, name: s.name, url: s.url, username: s.username, description: s.description,
    }));
    const history = assistantMessagesRef.current.map(m => ({ role: m.role, text: m.text }));
    setAssistantMessages(prev => [...prev, { role: 'user', text: message }]);
    setAssistantLoading(true);
    try {
      const res = await fetch('/api/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message, history, today: todayStr(),
          managers: membersRef.current.map(m => m.name),
          clients: activeClients.map(c => ({
            id: c.id, name: c.name, industry: c.industry, categories: c.categories,
            reportAnchorDate: c.reportAnchorDate, status: c.status,
            // 연락처·계약·예산도 전달 — 어시스턴트가 "○○ 연락처/예산/계약 알려줘"에 답할 수 있도록
            contactPerson: c.contactPerson, email: c.email, phone: c.phone,
            startDate: c.startDate, contractEnd: c.contractEnd, description: c.description,
            monthlyBudget: c.monthlyBudget,
            budgetItems: (c.budgetItems ?? []).map(b => ({ product: b.product, amount: b.amount, notes: b.notes })),
          })),
          categories: ASSISTANT_CATEGORIES,
          handoverDocs: handoverContext,
          aiPlans: aiPlanContext,
          vendors: vendorContext,
          accounts: accountContext,
          sites: siteContext,
          entries: scoped.map(e => ({
            id: e.id, date: e.date, endDate: e.endDate ?? null,
            managerName: e.managerName, clientName: e.clientName,
            category: e.category, keyword: e.keyword, status: e.status,
          })),
        }),
      });
      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        throw new Error('AI 서버(/api/ai-assistant)에 연결할 수 없습니다. Cloudflare Pages 배포 환경에서 동작합니다.');
      }
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? `요청 실패 (${res.status})`);
      const keywords: string[] = Array.isArray(data.keywords) ? data.keywords.filter((k: unknown) => typeof k === 'string' && k.trim()) : [];
      setAssistantMessages(prev => [...prev, {
        role: 'assistant',
        text: data.reply || '(응답이 비어 있습니다)',
        entries: Array.isArray(data.entries) ? data.entries : [],
        updates: Array.isArray(data.updates) ? data.updates : [],
        clients: Array.isArray(data.clients) ? data.clients : [],
        handovers: Array.isArray(data.handovers) ? data.handovers : [],
        vendors: Array.isArray(data.vendors) ? data.vendors : [],
        accounts: Array.isArray(data.accounts) ? data.accounts : [],
        sites: Array.isArray(data.sites) ? data.sites : [],
        accountLookups: Array.isArray(data.accountLookups) ? data.accountLookups.filter((x: unknown) => typeof x === 'string') : [],
        siteLookups: Array.isArray(data.siteLookups) ? data.siteLookups.filter((x: unknown) => typeof x === 'string') : [],
        deletes: Array.isArray(data.deletes) ? data.deletes.filter((d: unknown) => typeof d === 'string') : [],
        keywords,
      }]);
      // 키워드 조회수 질문이면 네이버 키워드도구로 조회해 마지막 어시스턴트 메시지에 결과(모바일/PC/총)를 붙인다
      if (keywords.length) {
        try {
          const kres = await fetch('/api/naver-keywords', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keywords: keywords.slice(0, 20) }),
          });
          const ktype = kres.headers.get('content-type') ?? '';
          if (!ktype.includes('application/json')) throw new Error('키워드 서버에 연결할 수 없습니다.');
          const kdata = await kres.json();
          if (!kres.ok || kdata.error) throw new Error(kdata.error ?? `조회 실패 (${kres.status})`);
          const stats = (Array.isArray(kdata.keywords) ? kdata.keywords : []).map((r: { keyword: string; mobile: number | string; pc: number | string; total: number; found: boolean }) => ({
            keyword: r.keyword, mobile: r.mobile, pc: r.pc, total: r.total, found: r.found,
          }));
          setAssistantMessages(prev => prev.map((m, i) => i === prev.length - 1 && m.role === 'assistant' ? { ...m, keywordStats: stats } : m));
        } catch (ke) {
          setAssistantMessages(prev => prev.map((m, i) => i === prev.length - 1 && m.role === 'assistant'
            ? { ...m, text: `${m.text}\n\n⚠️ 키워드 조회 실패: ${ke instanceof Error ? ke.message : '오류'}`, keywordStats: [] } : m));
        }
      }
    } catch (e) {
      setAssistantMessages(prev => [...prev, { role: 'assistant', text: `⚠️ ${e instanceof Error ? e.message : '오류가 발생했습니다.'}` }]);
    } finally {
      setAssistantLoading(false);
    }
  }, []);

  // 어시스턴트 제안을 실제 시스템에 반영 (업체 신규등록 → 인수인계 → 일정 생성/변경 순)
  const applyAssistantProposal = useCallback((index: number) => {
    const msg = assistantMessagesRef.current[index];
    if (!msg || msg.applied != null) return;
    const u = userRef.current;
    const mem = membersRef.current;
    const selfId = u?.id && mem.some(m => m.id === u.id) ? u.id : '';
    let count = 0;
    // 되돌리기용 스냅샷(생성 id + 삭제/수정 전 원본)
    const undo: AssistantUndo = {
      entryIds: [], clientIds: [], vendorIds: [], handoverIds: [], deletedEntries: [], updatedPrev: [],
      accountIds: [], siteIds: [], deletedAccounts: [], deletedSites: [], updatedAccountsPrev: [], updatedSitesPrev: [],
      deletedClients: [], updatedClientsPrev: [], deletedHandovers: [],
    };

    const matchManager = (name?: string) => {
      if (!name) return '';
      const ex = mem.find(m => m.name === name);
      if (ex) return ex.id;
      return mem.find(m => name.includes(m.name) || m.name.includes(name))?.id ?? '';
    };

    // 1) 클라이언트 추가/수정/삭제
    const created: { name: string; id: string }[] = [];
    const findClient = (c: { id?: string; name?: string }) =>
      clientsRef.current.find(x => x.id === c.id) ?? (c.name ? clientsRef.current.find(x => x.name === c.name) : undefined);
    const filterCats = (arr?: string[]) => (Array.isArray(arr) ? arr.filter(x => (ASSISTANT_CATEGORIES as string[]).includes(x)) as Category[] : undefined);
    (msg.clients ?? []).forEach((c, i) => {
      const op = c.op ?? (c.id ? 'update' : 'add');
      if (op === 'delete') {
        const cur = findClient(c);
        if (!cur) return;
        undo.deletedClients!.push({ ...cur });
        handoverDocsRef.current.filter(d => d.clientId === cur.id).forEach(d => undo.deletedHandovers!.push({ ...d }));
        removeClient(cur.id); // 연결 인수인계도 함께 제거
        count += 1;
        return;
      }
      if (op === 'update') {
        const cur = findClient(c);
        if (!cur) return;
        const cats = filterCats(c.categories);
        undo.updatedClientsPrev!.push({ ...cur });
        saveClient({ ...cur,
          name: c.name ?? cur.name, industry: c.industry ?? cur.industry,
          contactPerson: c.contactPerson ?? cur.contactPerson, email: c.email ?? cur.email, phone: c.phone ?? cur.phone,
          categories: cats ?? cur.categories, status: c.status ?? cur.status, reportAnchorDate: c.reportAnchorDate ?? cur.reportAnchorDate,
        });
        created.push({ name: cur.name, id: cur.id });
        count += 1;
        return;
      }
      // add (기본)
      if (!c.name) return;
      const ex = clientsRef.current.find(x => x.name === c.name);
      if (ex) { created.push({ name: c.name, id: ex.id }); return; }
      const id = `cl-${Date.now()}-${i}`;
      saveClient({ id, name: c.name, industry: c.industry || '', contactPerson: c.contactPerson || '', email: c.email || '', phone: c.phone || '', startDate: todayStr(), categories: filterCats(c.categories) ?? [], status: c.status ?? 'active', description: '', reportAnchorDate: c.reportAnchorDate });
      created.push({ name: c.name, id });
      undo.clientIds.push(id);
      count += 1;
    });
    const resolveClient = (name?: string): string => {
      if (!name) return '';
      const cr = created.find(x => x.name === name || name.includes(x.name) || x.name.includes(name));
      if (cr) return cr.id;
      const exact = clientsRef.current.find(x => x.name === name);
      if (exact) return exact.id;
      return clientsRef.current.find(x => name.includes(x.name) || x.name.includes(name))?.id ?? '';
    };
    const clientNameOf = (id: string) => clientsRef.current.find(c => c.id === id)?.name ?? created.find(c => c.id === id)?.name ?? '';

    // 1.5) 신규 외주사 등록
    (msg.vendors ?? []).forEach((v, i) => {
      if (!v.name) return;
      if (vendorsRef.current.some(x => x.name === v.name)) return;
      const vid = `vd-${Date.now()}-${i}`;
      saveVendor({
        id: vid, name: v.name, services: v.services || '',
        contactPerson: v.contactPerson || '', phone: v.phone || '', email: v.email || '',
        pricing: v.pricing || '', notes: v.notes || '', status: 'active',
      });
      undo.vendorIds.push(vid);
      count += 1;
    });

    // 2) 인수인계 문서 신규 등록
    (msg.handovers ?? []).forEach((h, i) => {
      if (!h.clientName) return;
      const cid = resolveClient(h.clientName);
      if (!cid || handoverDocsRef.current.find(d => d.clientId === cid)) return;
      const hid = `ho-${Date.now()}-${i}`;
      saveHandover({
        id: hid, clientId: cid, clientName: clientNameOf(cid) || h.clientName,
        authorId: u?.id ?? '', authorName: u?.name ?? '', updatedAt: todayStr(),
        overview: h.overview || '', keyContacts: [], importantLinks: [],
        guidelines: '', tone: '', dontDo: '', specialNotes: '', managerMemo: '',
      });
      undo.handoverIds.push(hid);
      count += 1;
    });

    // 3) 신규 일정 생성
    const newEntries: ScheduleEntry[] = [];
    (msg.entries ?? []).forEach((e, i) => {
      const managerId = matchManager(e.managerName) || selfId;
      const clientId = resolveClient(e.clientName);
      if (!e.date || !managerId || !clientId) return;
      const category = ((ASSISTANT_CATEGORIES as string[]).includes(e.category ?? '') ? e.category : (ASSISTANT_CATEGORIES.find(c => e.category?.includes(c)) ?? '기타')) as Category;
      const endDate = e.endDate && e.endDate !== 'null' && e.endDate > e.date ? e.endDate : undefined;
      newEntries.push({
        id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        date: e.date, endDate, managerId, managerName: mem.find(m => m.id === managerId)?.name ?? '',
        category, keyword: e.keyword || undefined, clientId, clientName: clientNameOf(clientId),
        status: (['pending', 'in-progress', 'completed'].includes(e.status ?? '') ? e.status : 'pending') as ScheduleStatus,
      });
    });
    if (newEntries.length) {
      saveEntries(newEntries); count += newEntries.length; undo.entryIds.push(...newEntries.map(e => e.id));
      newEntries.forEach(e => assistantEntryIdsRef.current.add(e.id)); // realtime 중복 알림 방지용
    }

    // 4) 기존 일정 변경 (배분/재배치)
    (msg.updates ?? []).forEach(up => {
      if (!up.id) return;
      const cur = entriesRef.current.find(en => en.id === up.id);
      if (!cur) return;
      const patch: Partial<ScheduleEntry> = {};
      if (up.date && up.date !== 'null') patch.date = up.date;
      if (up.endDate && up.endDate !== 'null') patch.endDate = up.endDate;
      if (up.managerName && up.managerName !== 'null') {
        const mid = matchManager(up.managerName);
        if (mid) { patch.managerId = mid; patch.managerName = mem.find(m => m.id === mid)?.name ?? cur.managerName; }
      }
      if (up.status && ['pending', 'in-progress', 'completed'].includes(up.status)) patch.status = up.status as ScheduleStatus;
      if (Object.keys(patch).length) { undo.updatedPrev.push({ ...cur }); patchEntry(up.id, patch); count += 1; }
    });

    // 5) 일정 삭제/취소
    (msg.deletes ?? []).forEach(id => {
      const cur = entriesRef.current.find(en => en.id === id);
      if (!cur) return;
      undo.deletedEntries.push({ ...cur });
      removeEntry(id);
      count += 1;
    });

    // 6) 아이디 목록 (추가/수정/삭제)
    (msg.accounts ?? []).forEach((a, i) => {
      const op = a.op ?? (a.id ? 'update' : 'add');
      if (op === 'delete') {
        const cur = accountsRef.current.find(x => x.id === a.id);
        if (!cur) return;
        undo.deletedAccounts.push({ ...cur });
        removeAccount(cur.id);
        count += 1;
      } else if (op === 'update' && a.id) {
        const cur = accountsRef.current.find(x => x.id === a.id);
        if (!cur) return;
        undo.updatedAccountsPrev.push({ ...cur });
        saveAccount({ ...cur, name: a.name ?? cur.name, platform: a.platform ?? cur.platform, grade: a.grade ?? cur.grade, ownership: a.ownership ?? cur.ownership, username: a.username ?? cur.username, password: a.password ?? cur.password, category: a.category ?? cur.category, ip: a.ip ?? cur.ip });
        count += 1;
      } else if (a.name || a.username) {
        const id = `ac-${Date.now()}-${i}`;
        saveAccount({ id, name: a.name || '', platform: a.platform || '', grade: a.grade || '', ownership: a.ownership, username: a.username || '', password: a.password || '', category: a.category || '', ip: a.ip || '' });
        undo.accountIds.push(id);
        count += 1;
      }
    });

    // 7) 홈페이지 목록 (추가/수정/삭제)
    (msg.sites ?? []).forEach((s, i) => {
      const op = s.op ?? (s.id ? 'update' : 'add');
      if (op === 'delete') {
        const cur = siteEntriesRef.current.find(x => x.id === s.id);
        if (!cur) return;
        undo.deletedSites.push({ ...cur });
        removeSite(cur.id);
        count += 1;
      } else if (op === 'update' && s.id) {
        const cur = siteEntriesRef.current.find(x => x.id === s.id);
        if (!cur) return;
        undo.updatedSitesPrev.push({ ...cur });
        saveSite({ ...cur, name: s.name ?? cur.name, url: s.url ?? cur.url, username: s.username ?? cur.username, password: s.password ?? cur.password, description: s.description ?? cur.description });
        count += 1;
      } else if (s.name) {
        const id = `st-${Date.now()}-${i}`;
        saveSite({ id, name: s.name || '', url: s.url || '', username: s.username || '', password: s.password || '', description: s.description || '' });
        undo.siteIds.push(id);
        count += 1;
      }
    });

    setAssistantMessages(prev => prev.map((m, i) => i === index ? { ...m, applied: count, undo } : m));
    // AI 어시스턴트로 반영된 변경도 알림(일정·업체·계정 등 종류 무관). 대시보드에서 작업해도 떠야 하므로 직접 푸시.
    if (count > 0) {
      const bits: string[] = [];
      if (newEntries.length) bits.push(`일정 ${newEntries.length}건`);
      const others = count - newEntries.length;
      if (others > 0) bits.push(`그 외 ${others}건`);
      pushNotification({
        type: 'assistant',
        title: 'AI 어시스턴트 적용 완료',
        body: `${bits.join(' · ') || `${count}건`}이 반영됐어요`,
        link: '/schedule/daily',
      });
    }
  }, [saveClient, removeClient, saveHandover, saveEntries, patchEntry, saveVendor, removeEntry, saveAccount, removeAccount, saveSite, removeSite, pushNotification]);

  // 직전 적용을 되돌린다(생성한 레코드 제거 + 삭제/수정한 일정 복원)
  const undoAssistantProposal = useCallback((index: number) => {
    const msg = assistantMessagesRef.current[index];
    if (!msg || msg.applied == null || msg.undone || !msg.undo) return;
    const u = msg.undo;
    u.entryIds.forEach(id => removeEntry(id));
    u.vendorIds.forEach(id => removeVendor(id));
    u.handoverIds.forEach(id => removeHandover(id));
    u.clientIds.forEach(id => removeClient(id)); // 연결 인수인계도 함께 제거됨
    u.deletedEntries.forEach(e => saveEntry(e)); // 삭제했던 일정 복원
    u.updatedPrev.forEach(e => saveEntry(e));    // 수정 전 원본 복원
    // 클라이언트 수정/삭제 되돌리기 (이전 버전 메시지엔 필드가 없을 수 있어 ?? [])
    (u.updatedClientsPrev ?? []).forEach(c => saveClient(c));
    (u.deletedClients ?? []).forEach(c => saveClient(c));
    (u.deletedHandovers ?? []).forEach(h => saveHandover(h));
    // 아이디 목록 / 홈페이지 목록 되돌리기 (이전 버전 메시지엔 필드가 없을 수 있어 ?? [])
    (u.accountIds ?? []).forEach(id => removeAccount(id));
    (u.siteIds ?? []).forEach(id => removeSite(id));
    (u.deletedAccounts ?? []).forEach(a => saveAccount(a));
    (u.deletedSites ?? []).forEach(s => saveSite(s));
    (u.updatedAccountsPrev ?? []).forEach(a => saveAccount(a));
    (u.updatedSitesPrev ?? []).forEach(s => saveSite(s));
    setAssistantMessages(prev => prev.map((m, i) => i === index ? { ...m, undone: true } : m));
  }, [removeEntry, removeVendor, removeHandover, removeClient, saveEntry, saveClient, saveHandover, removeAccount, removeSite, saveAccount, saveSite]);

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
      const v = await load<Vendor>('vendors');
      const acc = await load<AccountEntry>('accounts');
      const sites = await load<SiteEntry>('site_entries');
      const rep = await load<Report>('reports');
      const plans = await load<AiPlanResult>('ai_plans');
      if (!active) return;
      if (c && c.length === 0) { await seed('clients', CLIENTS); c = CLIENTS; }
      if (e && e.length === 0) { await seed('schedule_entries', SCHEDULE_ENTRIES); e = SCHEDULE_ENTRIES; }
      if (h && h.length === 0) { await seed('handover_docs', HANDOVER_DOCS); h = HANDOVER_DOCS; }
      if (!active) return;
      if (c) setClients(c);
      if (e) setEntries(e);
      if (h) setHandoverDocs(h);
      // vendors/accounts/site_entries: 로컬 캐시 + Supabase 동기화.
      //  • 로드 null  = 테이블 없음(마이그레이션 미실행) → 로컬 캐시 유지, 업로드 시도 안 함.
      //  • 원격 데이터 있음 = 공유본 사용.
      //  • 원격 비어 있음 + 로컬에 데이터 있음 = 테이블을 뒤늦게 만든 경우.
      //    로컬 캐시를 한 번 올려서(backfill) 다른 기기(모바일 등)와도 공유되게 한다.
      const syncLocalFirst = <T extends { id: string }>(
        table: string, remote: T[] | null, local: T[], setLocal: (v: T[]) => void,
      ) => {
        if (remote && remote.length) { setLocal(remote); return; }
        if (remote && remote.length === 0 && local.length) persistMany(table, local);
        // remote === null(테이블 없음) 또는 원격·로컬 모두 비어 있으면 그대로 둔다.
      };
      syncLocalFirst('vendors', v, vendorsRef.current, setVendors);
      syncLocalFirst('accounts', acc, accountsRef.current, setAccounts);
      syncLocalFirst('site_entries', sites, siteEntriesRef.current, setSiteEntries);
      syncLocalFirst('reports', rep, reportsRef.current, setReports);
      if (plans) setAiHistory([...plans].sort((a, b) => b.createdAt - a.createdAt));
    })();
    return () => { active = false; };
  }, [uid]);

  // 스케줄 실시간 구독: 내 담당 스케줄이 등록되면 새로고침 없이 알림 + 목록 반영.
  //  • 0010_realtime_schedule.sql 로 schedule_entries 가 realtime publication 에 추가돼 있어야 한다.
  //  • 본인이 등록한 것도 본인 담당이면 알림한다(요청사항). 목록 중복만 dedup.
  useEffect(() => {
    if (!supabase || !uid) return;
    const sb = supabase;
    const channel = sb
      .channel(`rt-schedule-${uid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'schedule_entries' }, payload => {
        const e = (payload.new as { data?: ScheduleEntry })?.data;
        if (!e || e.managerId !== uid) return;            // 내 담당 스케줄만(본인 등록분 포함)
        setEntries(prev => prev.some(x => x.id === e.id) ? prev : [e, ...prev]); // 목록 중복만 방지
        // 어시스턴트로 막 만든 일정은 이미 "적용 완료" 요약 알림이 떴으므로 여기선 건너뜀
        if (assistantEntryIdsRef.current.has(e.id)) { assistantEntryIdsRef.current.delete(e.id); return; }
        pushNotification({
          type: 'schedule',
          title: '새 스케줄이 등록됐어요',
          body: `${e.date} · ${e.category}${e.keyword ? ` · ${e.keyword}` : ''}`,
          link: '/schedule/daily',
        });
      })
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, [uid, pushNotification]);

  return (
    <AppContext.Provider value={{
      entries, clients, handoverDocs, vendors, accounts, siteEntries, reports, members: orderedMembers, reloadMembers, aiHistory, saveAiPlan, removeAiPlan,
      aiPlanRunning, aiPlanError, startAiPlanJob, activeAiPlanId, clearActiveAiPlan,
      aiImageRunning, aiImageError, startAiImageJob,
      assistantMessages, assistantLoading, runAssistant, applyAssistantProposal, undoAssistantProposal,
      saveEntry, saveEntries, patchEntry, removeEntry, saveClient, removeClient, saveHandover, removeHandover,
      saveVendor, removeVendor, saveAccount, removeAccount, saveSite, removeSite, saveReport, removeReport,
      notifications, unreadCount, markAllNotificationsRead, markNotificationRead, clearNotifications,
      desktopNotifyEnabled, enableDesktopNotify,
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
