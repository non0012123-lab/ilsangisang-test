import { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import type { ScheduleEntry, ScheduleStatus, Client, HandoverDoc, TeamMember, AiPlanResult, AiPlanImage, Category, AssistantMessage, AssistantConversation, Vendor, AssistantUndo, AccountEntry, SiteEntry, Report, AppNotification, WorkRequest } from '../types';
import { USERS } from '../data/mockData';
import { supabase } from '../lib/supabase';
import { todayStr } from '../utils/today';
import { fireDesktop, requestNotifyPermission, isNotifySupported } from '../utils/notifications';
import { useAuth } from './AuthContext';

const ASSISTANT_CATEGORIES: Category[] = ['SNS', '유튜브', '네이버', '영상제작', '디자인제작', '네이버 여론작업', '기타'];

interface AppContextType {
  entries: ScheduleEntry[];
  clients: Client[];
  handoverDocs: HandoverDoc[];
  // 첫 로딩(캐시 없음)에서 Supabase 일정 응답이 오기 전까지 true → 빈 화면 대신 스켈레톤 표시용
  dataLoading: boolean;
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
  assistantMessages: AssistantMessage[];   // 활성 대화의 메시지
  assistantLoading: boolean;
  runAssistant: (text: string) => Promise<void>;
  applyAssistantProposal: (index: number) => void;
  undoAssistantProposal: (index: number) => void;
  // 대화 기록 관리 (대화목록 + 새 채팅 + 삭제)
  conversations: AssistantConversation[];
  activeConversationId: string | null;
  newConversation: () => void;
  selectConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  deleteAssistantMessage: (index: number) => void;
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
  // 업무 요청(요청함) — 다른 담당자에게 보낸/받은 요청. realtime 으로 상대 화면에 반영됨.
  requests: WorkRequest[];
  sendRequest: (toId: string, title: string, body?: string) => void;
  confirmRequest: (id: string) => void;
  completeRequest: (id: string) => void;
  removeRequest: (id: string) => void;
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
// 캐시 중요도(클수록 보존). 일정·업체는 대시보드 핵심이라 가장 높게, AI기획·보고서는 낮게.
const lsImportance = (key: string): number => {
  if (key.includes('schedule')) return 100;
  if (key.includes('clients')) return 90;
  if (key.includes('request')) return 85; // 다른 담당자와 주고받는 업무 요청 — 핵심에 가깝게 보존
  if (key.includes('vendors')) return 80;
  if (key.includes('accounts')) return 70;
  if (key.includes('site')) return 60;
  if (key.includes('handover')) return 50;
  if (key.includes('notif')) return 40;
  if (key.includes('reports')) return 20;
  if (key.includes('aiplans')) return 10;
  return 30;
};
// 저장 실패(용량 초과 추정) 시, 나보다 덜 중요한 ilsangisang.* 캐시를 큰 영향 순서로 비우고 재시도한다.
// → 일정·업체 같은 핵심 캐시는 큰 데이터(AI기획 텍스트 등)에 밀려 저장 실패하는 일이 없도록 보장.
const lsSave = (key: string, list: unknown) => {
  const data = JSON.stringify(list);
  try { localStorage.setItem(key, data); return; } catch { /* 아래에서 공간 정리 후 재시도 */ }
  const mine = lsImportance(key);
  const victims = Object.keys(localStorage)
    .filter(k => k.startsWith('ilsangisang.') && k !== key && lsImportance(k) < mine)
    .sort((a, b) => lsImportance(a) - lsImportance(b)); // 가장 덜 중요한 것부터
  for (const v of victims) {
    try { localStorage.removeItem(v); } catch { /* 무시 */ }
    try { localStorage.setItem(key, data); return; } catch { /* 계속 정리 */ }
  }
  // 그래도 안 들어가면 포기(메모리 상태로는 정상 동작)
};
const VENDORS_LS_KEY = 'ilsangisang.vendors.v1';
const ACCOUNTS_LS_KEY = 'ilsangisang.accounts.v1';
const SITES_LS_KEY = 'ilsangisang.sites.v1';
const REPORTS_LS_KEY = 'ilsangisang.reports.v1';
const AI_PLANS_LS_KEY = 'ilsangisang.aiplans.v1';
const REQUESTS_LS_KEY = 'ilsangisang.requests.v1';
const NOTIFS_LS_KEY = 'ilsangisang.notifications.v1';
const DESKTOP_NOTIFY_LS_KEY = 'ilsangisang.notify.desktop.v1';
const NOTIFS_MAX = 50; // 알림은 최근 50개까지만 보관
// AI 결과 화면 계열 경로 — 이 페이지에 머무는 동안엔 AI 완료 알림을 만들지 않는다(이미 보고 있으므로)
const AI_RESULT_PATHS = ['/ai-planning', '/ai-results'];
const loadLocalVendors = (): Vendor[] => lsLoad<Vendor>(VENDORS_LS_KEY);
const saveLocalVendors = (list: Vendor[]) => lsSave(VENDORS_LS_KEY, list);
// clients/schedule/handover: 로컬 캐시(마지막 실데이터)로 첫 화면을 그리고 Supabase 응답으로 갱신한다.
// 예전엔 캐시가 비면 목업으로 폴백해 첫 화면에 예시(스타벅스·현대차)가 잠깐 떴다가 실데이터로 교체돼
// 깜빡였다 → 목업 폴백을 제거해, 캐시 있으면 즉시 실데이터, 없으면 빈 화면(예시 안 보임) 후 Supabase 반영.
// v2: 과거 목업 폴백 시절 캐시에 예시(스타벅스·현대차)가 저장돼 있을 수 있어 키를 올려 낡은 캐시를 버린다.
const CLIENTS_LS_KEY = 'ilsangisang.clients.v2';
const SCHEDULE_LS_KEY = 'ilsangisang.schedule.v2';
const HANDOVER_LS_KEY = 'ilsangisang.handover.v2';

const AppContext = createContext<AppContextType | null>(null);

// Supabase 미설정 시 사용할 기본 담당자 목록 (mock)
const MOCK_MEMBERS: TeamMember[] = USERS
  .filter(u => u.role !== 'client')
  .map(u => ({ id: u.id, name: u.name, department: u.department }));

export function AppProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<ScheduleEntry[]>(() => lsLoad<ScheduleEntry>(SCHEDULE_LS_KEY));
  const [clients, setClients] = useState<Client[]>(() => lsLoad<Client>(CLIENTS_LS_KEY));
  const [handoverDocs, setHandoverDocs] = useState<HandoverDoc[]>(() => lsLoad<HandoverDoc>(HANDOVER_LS_KEY));
  // 캐시에 일정이 있으면 즉시 그려지므로 로딩 아님. 캐시가 비었을 때만 첫 Supabase 응답 전까지 로딩.
  const [dataLoading, setDataLoading] = useState<boolean>(() => lsLoad<ScheduleEntry>(SCHEDULE_LS_KEY).length === 0);
  const [vendors, setVendors] = useState<Vendor[]>(loadLocalVendors);
  const [accounts, setAccounts] = useState<AccountEntry[]>(() => lsLoad<AccountEntry>(ACCOUNTS_LS_KEY));
  const [siteEntries, setSiteEntries] = useState<SiteEntry[]>(() => lsLoad<SiteEntry>(SITES_LS_KEY));
  const [reports, setReports] = useState<Report[]>(() => lsLoad<Report>(REPORTS_LS_KEY));
  const [members, setMembers] = useState<TeamMember[]>(MOCK_MEMBERS);
  const [aiHistory, setAiHistory] = useState<AiPlanResult[]>(() => lsLoad<AiPlanResult>(AI_PLANS_LS_KEY));
  const [aiPlanRunning, setAiPlanRunning] = useState(false);
  const [aiPlanError, setAiPlanError] = useState('');
  const [activeAiPlanId, setActiveAiPlanId] = useState<string | null>(null);
  const [aiImageRunning, setAiImageRunning] = useState<string | null>(null);
  const [aiImageError, setAiImageError] = useState('');
  const [conversations, setConversations] = useState<AssistantConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [assistantLoading, setAssistantLoading] = useState(false);
  // 활성 대화의 메시지 (UI·apply/undo 가 이 배열을 인덱스로 참조)
  const assistantMessages = useMemo(
    () => conversations.find(c => c.id === activeConversationId)?.messages ?? [],
    [conversations, activeConversationId],
  );
  const [requests, setRequests] = useState<WorkRequest[]>(() => lsLoad<WorkRequest>(REQUESTS_LS_KEY));
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
  // 캐시엔 이미지(screenshot·images)를 빼고 가벼운 본만 저장한다. 일정에 base64 이미지가 박혀 있으면
  // 몇 건만으로 수 MB가 돼 localStorage 용량을 넘겨 캐시 저장이 조용히 실패했다(→ 매번 스켈레톤).
  // 대시보드는 이미지가 불필요하고, 원본 이미지는 Supabase 가 소스이므로 캐시에서 빼도 무방.
  useEffect(() => {
    lsSave(SCHEDULE_LS_KEY, entries.map(e => ({ ...e, screenshot: undefined, images: undefined })));
  }, [entries]);
  // 어시스턴트 적용으로 막 생성한 일정 id — realtime 에코 때 (요약 알림과) 중복 알림을 막기 위해 추적
  const assistantEntryIdsRef = useRef<Set<string>>(new Set());
  // 전역 이미지 작업이 완료 시 최신 기획 결과를 머지하기 위한 ref
  const aiHistoryRef = useRef(aiHistory);
  useEffect(() => { aiHistoryRef.current = aiHistory; }, [aiHistory]);
  // AI 기획 결과도 로컬 캐시 → 새로고침/일시적 네트워크 문제에도 유지(다른 데이터와 동일 정책).
  // 이미지(base64)는 용량이 커 로컬엔 제외하고 텍스트 결과만 캐시한다(이미지 원본은 Supabase).
  useEffect(() => { lsSave(AI_PLANS_LS_KEY, aiHistory.map(p => ({ ...p, images: [] }))); }, [aiHistory]);
  // 어시스턴트가 전역(언마운트 무관)으로 최신 데이터를 참조하기 위한 ref 들
  const membersRef = useRef(members);
  useEffect(() => { membersRef.current = members; }, [members]);
  const clientsRef = useRef(clients);
  useEffect(() => { clientsRef.current = clients; }, [clients]);
  useEffect(() => { lsSave(CLIENTS_LS_KEY, clients); }, [clients]);
  const handoverDocsRef = useRef(handoverDocs);
  useEffect(() => { handoverDocsRef.current = handoverDocs; }, [handoverDocs]);
  useEffect(() => { lsSave(HANDOVER_LS_KEY, handoverDocs); }, [handoverDocs]);
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
  // 업무 요청: 공유 데이터라 Supabase 가 소스지만, 로컬 캐시로 새로고침·일시 네트워크 문제에도 즉시 표시
  const requestsRef = useRef(requests);
  useEffect(() => { requestsRef.current = requests; }, [requests]);
  useEffect(() => { lsSave(REQUESTS_LS_KEY, requests); }, [requests]);
  // 알림은 기기별 — localStorage 에만 저장(Supabase 동기화 안 함)
  useEffect(() => { lsSave(NOTIFS_LS_KEY, notifications); }, [notifications]);
  const conversationsRef = useRef(conversations);
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);
  const activeConversationIdRef = useRef(activeConversationId);
  useEffect(() => { activeConversationIdRef.current = activeConversationId; }, [activeConversationId]);
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

  // 권한 상태만 동기화한다. 권한 요청(requestPermission)은 절대 자동으로 하지 않는다 —
  // 페이지 로드 시 자동 요청은 사용자 제스처가 아니라서 Firefox/Safari 는 무조건 차단되고,
  // Chrome 도 무시하거나 "조용한 알림" 페널티를 줘서 결과적으로 권한이 'default' 에 묶여 한 개도 안 뜬다.
  // 정식 경로는 알림함의 "PC 알림 켜기" 버튼(사용자 클릭=제스처)뿐이다.
  useEffect(() => {
    if (!uid || !isNotifySupported()) return;
    if (Notification.permission === 'granted') setDesktopNotifyEnabled(true);
  }, [uid]);

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

  // ── 업무 요청(요청함) ──
  // 다른 담당자에게 요청을 보낸다(일정과 무관하게 "이거 해줘/확인해줘"). 상대 화면엔 realtime 으로 뜬다.
  const sendRequest = useCallback((toId: string, title: string, body?: string) => {
    const u = userRef.current;
    const text = title.trim();
    if (!u || !toId || !text) return;
    const to = membersRef.current.find(m => m.id === toId);
    const req: WorkRequest = {
      id: `rq-${nowMs()}-${Math.random().toString(36).slice(2, 6)}`,
      fromUid: u.id, fromName: u.name,
      toUid: toId, toName: to?.name ?? '',
      title: text, body: body?.trim() || undefined,
      status: 'pending', createdAt: nowMs(),
    };
    setRequests(prev => [req, ...prev]);
    persistOne('requests', req);
  }, []);
  // 담당자가 "확인" — 대기중 요청만 확인됨으로. realtime UPDATE 로 요청자에게 알림이 간다.
  const confirmRequest = useCallback((id: string) => {
    const cur = requestsRef.current.find(r => r.id === id);
    if (!cur || cur.status !== 'pending') return;
    const updated: WorkRequest = { ...cur, status: 'confirmed', confirmedAt: nowMs() };
    setRequests(prev => prev.map(r => r.id === id ? updated : r));
    persistOne('requests', updated);
  }, []);
  // 담당자가 "완료" — 확인/대기 상태에서 완료로. realtime UPDATE 로 요청자에게 알림이 간다.
  const completeRequest = useCallback((id: string) => {
    const cur = requestsRef.current.find(r => r.id === id);
    if (!cur || cur.status === 'done') return;
    const updated: WorkRequest = { ...cur, status: 'done', doneAt: nowMs(), confirmedAt: cur.confirmedAt ?? nowMs() };
    setRequests(prev => prev.map(r => r.id === id ? updated : r));
    persistOne('requests', updated);
  }, []);
  const removeRequest = useCallback((id: string) => {
    setRequests(prev => prev.filter(r => r.id !== id));
    persistDelete('requests', id);
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

  // ── 대화(채팅) 관리 ───────────────────────────────────
  const deriveTitle = (messages: AssistantMessage[]) =>
    messages.find(m => m.role === 'user')?.text.trim().slice(0, 30) || '새 대화';

  // 활성(또는 지정) 대화의 메시지를 갱신하고, 제목·updatedAt 을 맞춘다. (Supabase 저장은 별도 effect 가 담당)
  const mutateMessages = useCallback((convId: string, updater: (prev: AssistantMessage[]) => AssistantMessage[]) => {
    setConversations(prev => prev.map(c => {
      if (c.id !== convId) return c;
      const messages = updater(c.messages);
      return { ...c, messages, title: deriveTitle(messages), updatedAt: nowMs() };
    }));
  }, []);

  // 새 대화 생성 → id 반환 (refs 도 즉시 갱신해 같은 tick 의 후속 호출이 바로 이 대화를 가리키게 함)
  const createConversation = useCallback((): string => {
    const id = `conv-${nowMs()}-${Math.random().toString(36).slice(2, 7)}`;
    const conv: AssistantConversation = { id, title: '새 대화', messages: [], createdAt: nowMs(), updatedAt: nowMs() };
    conversationsRef.current = [conv, ...conversationsRef.current];
    activeConversationIdRef.current = id;
    setConversations(prev => [conv, ...prev]);
    setActiveConversationId(id);
    return id;
  }, []);

  // UI: "새 채팅" — 이미 비어 있는 새 대화에 있으면 그대로 두고, 아니면 새로 만든다.
  const newConversation = useCallback(() => {
    const active = conversationsRef.current.find(c => c.id === activeConversationIdRef.current);
    if (active && active.messages.length === 0) return;
    createConversation();
  }, [createConversation]);

  const selectConversation = useCallback((id: string) => setActiveConversationId(id), []);

  const deleteConversation = useCallback((id: string) => {
    setConversations(prev => {
      const next = prev.filter(c => c.id !== id);
      if (activeConversationIdRef.current === id) {
        const nextId = next[0]?.id ?? null;
        activeConversationIdRef.current = nextId;
        setActiveConversationId(nextId);
      }
      conversationsRef.current = next;
      return next;
    });
    persistDelete('assistant_conversations', id);
  }, []);

  // 개별 메시지 삭제 (어시스턴트의 장황한 답변 등 정리용)
  const deleteAssistantMessage = useCallback((index: number) => {
    const convId = activeConversationIdRef.current;
    if (!convId) return;
    mutateMessages(convId, prev => prev.filter((_, i) => i !== index));
  }, [mutateMessages]);

  // 활성 대화가 바뀔 때마다(메시지 추가/수정/삭제 포함) Supabase 에 저장. 빈 대화는 저장하지 않음.
  useEffect(() => {
    if (!supabase) return;
    const c = conversations.find(x => x.id === activeConversationId);
    if (c && c.messages.length > 0) persistOne('assistant_conversations', c);
  }, [conversations, activeConversationId]);

  // ── 대시보드 AI 어시스턴트 (전역 실행 → 다른 메뉴로 이동해도 대화·진행 유지) ──
  const runAssistant = useCallback(async (text: string) => {
    const message = text.trim();
    if (!message || assistantLoadingRef.current) return;
    // 활성 대화 확보(없으면 새로 생성). 이후 모든 메시지 갱신은 이 대화를 대상으로 한다.
    let convId = activeConversationIdRef.current;
    if (!convId || !conversationsRef.current.some(c => c.id === convId)) convId = createConversation();
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
    const history = (conversationsRef.current.find(c => c.id === convId)?.messages ?? []).map(m => ({ role: m.role, text: m.text }));
    mutateMessages(convId, prev => [...prev, { role: 'user', text: message }]);
    setAssistantLoading(true);
    try {
      const res = await fetch('/api/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message, history, today: todayStr(),
          currentUser: u?.name ?? '', // 로그인한 본인 — 담당자 미지정 시 기본 담당자, "나/내가" 표현 매핑용
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
            link: e.link ?? null, rank: e.rank ?? null,
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
      mutateMessages(convId, prev => [...prev, {
        role: 'assistant',
        text: data.reply || '(응답이 비어 있습니다)',
        entries: Array.isArray(data.entries) ? data.entries : [],
        updates: Array.isArray(data.updates) ? data.updates : [],
        clients: Array.isArray(data.clients) ? data.clients : [],
        handovers: Array.isArray(data.handovers) ? data.handovers : [],
        vendors: Array.isArray(data.vendors) ? data.vendors : [],
        accounts: Array.isArray(data.accounts) ? data.accounts : [],
        sites: Array.isArray(data.sites) ? data.sites : [],
        requests: Array.isArray(data.requests) ? data.requests : [],
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
          mutateMessages(convId, prev => prev.map((m, i) => i === prev.length - 1 && m.role === 'assistant' ? { ...m, keywordStats: stats } : m));
        } catch (ke) {
          mutateMessages(convId, prev => prev.map((m, i) => i === prev.length - 1 && m.role === 'assistant'
            ? { ...m, text: `${m.text}\n\n⚠️ 키워드 조회 실패: ${ke instanceof Error ? ke.message : '오류'}`, keywordStats: [] } : m));
        }
      }
    } catch (e) {
      mutateMessages(convId, prev => [...prev, { role: 'assistant', text: `⚠️ ${e instanceof Error ? e.message : '오류가 발생했습니다.'}` }]);
    } finally {
      setAssistantLoading(false);
    }
  }, [createConversation, mutateMessages]);

  // 어시스턴트 제안을 실제 시스템에 반영 (업체 신규등록 → 인수인계 → 일정 생성/변경 순)
  const applyAssistantProposal = useCallback((index: number) => {
    const convId = activeConversationIdRef.current;
    const activeMsgs = conversationsRef.current.find(c => c.id === convId)?.messages ?? [];
    const msg = activeMsgs[index];
    if (!convId || !msg || msg.applied != null) return;
    const u = userRef.current;
    const mem = membersRef.current;
    const selfId = u?.id && mem.some(m => m.id === u.id) ? u.id : '';
    let count = 0;
    // 되돌리기용 스냅샷(생성 id + 삭제/수정 전 원본)
    const undo: AssistantUndo = {
      entryIds: [], clientIds: [], vendorIds: [], handoverIds: [], deletedEntries: [], updatedPrev: [],
      accountIds: [], siteIds: [], requestIds: [], deletedAccounts: [], deletedSites: [], updatedAccountsPrev: [], updatedSitesPrev: [],
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
        link: e.link || undefined,
        rank: Number(e.rank) > 0 ? Number(e.rank) : undefined, // "키워드 N위로 등록" → 순위 N
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
      // 스케줄 링크: 문자열이면 추가/수정, 빈 문자열("")이면 삭제, null/생략이면 변경 안 함
      if (up.link !== undefined && up.link !== null && up.link !== 'null') patch.link = up.link ? up.link : undefined;
      // 순위: 양수면 변경, null/생략이면 변경 안 함 ("신사피부과 5위로 바꿔줘")
      if (Number(up.rank) > 0) patch.rank = Number(up.rank);
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

    // 8) 다른 담당자에게 업무 요청 보내기 ("방두환한테 디자인 제작 요청해줘")
    (msg.requests ?? []).forEach(r => {
      const toId = matchManager(r.toName);
      const title = (r.title ?? '').trim();
      if (!toId || !title) return;
      const reqId = `rq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const to = mem.find(m => m.id === toId);
      const wr: WorkRequest = {
        id: reqId, fromUid: u?.id ?? '', fromName: u?.name ?? '',
        toUid: toId, toName: to?.name ?? '', title, body: r.body?.trim() || undefined,
        status: 'pending', createdAt: nowMs(),
      };
      setRequests(prev => [wr, ...prev]);
      persistOne('requests', wr);
      undo.requestIds!.push(reqId);
      count += 1;
    });

    mutateMessages(convId, prev => prev.map((m, i) => i === index ? { ...m, applied: count, undo } : m));
    // AI 어시스턴트로 반영된 변경도 알림(일정·업체·계정 등 종류 무관). 대시보드에서 작업해도 떠야 하므로 직접 푸시.
    if (count > 0) {
      // 대표 1건(업체명 + 키워드/카테고리) + 외 N건 으로 핵심 내용을 보여준다.
      const head = newEntries[0];
      const label = head ? `${head.clientName} ${head.keyword || head.category}`.trim() : '';
      const rest = count - 1;
      const body = label
        ? `${label} 일정${rest > 0 ? ` 외 ${rest}건` : ''}이 반영됐어요`
        : `${count}건이 반영됐어요`;
      pushNotification({
        type: 'assistant',
        title: 'AI 어시스턴트 적용 완료',
        body,
        link: '/schedule/daily',
      });
    }
  }, [saveClient, removeClient, saveHandover, saveEntries, patchEntry, saveVendor, removeEntry, saveAccount, removeAccount, saveSite, removeSite, pushNotification, mutateMessages]);

  // 직전 적용을 되돌린다(생성한 레코드 제거 + 삭제/수정한 일정 복원)
  const undoAssistantProposal = useCallback((index: number) => {
    const convId = activeConversationIdRef.current;
    const activeMsgs = conversationsRef.current.find(c => c.id === convId)?.messages ?? [];
    const msg = activeMsgs[index];
    if (!convId || !msg || msg.applied == null || msg.undone || !msg.undo) return;
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
    (u.requestIds ?? []).forEach(id => removeRequest(id)); // 보낸 업무 요청 취소
    mutateMessages(convId, prev => prev.map((m, i) => i === index ? { ...m, undone: true } : m));
  }, [removeEntry, removeVendor, removeHandover, removeClient, saveEntry, saveClient, saveHandover, removeAccount, removeSite, saveAccount, saveSite, removeRequest, mutateMessages]);

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

  // 로그인 시 업무 데이터를 Supabase 에서 로드한다(빈 테이블이어도 목업 시드는 하지 않음).
  useEffect(() => {
    if (!supabase) { setDataLoading(false); return; }  // Supabase 미설정이면 기다릴 게 없음
    if (!uid) return;
    const sb = supabase;
    let active = true;
    const load = async <T,>(table: string): Promise<T[] | null> => {
      const { data, error } = await sb.from(table).select('id, data');
      if (error) { console.error(`[${table}] 로드 실패:`, error.message); return null; }
      return (data ?? []).map(r => r.data as T);
    };
    // 도착한 데이터만 반영(언마운트/유저변경 시 무시). 각 쿼리가 끝나는 즉시 화면을 그린다.
    const guard = <T,>(fn: (v: T) => void) => (v: T) => { if (active) fn(v); };
    // vendors/accounts/site_entries/reports: 로컬 캐시 + Supabase 동기화.
    //  • 로드 null = 테이블 없음(마이그레이션 미실행) → 로컬 캐시 유지, 업로드 안 함.
    //  • 원격 있음 = 공유본 사용. 원격 비었고 로컬에 데이터 있음 = 늦게 만든 테이블 → 캐시 1회 backfill.
    const syncLocalFirst = <T extends { id: string }>(
      table: string, remote: T[] | null, local: T[], setLocal: (v: T[]) => void,
    ) => {
      if (remote && remote.length) { setLocal(remote); return; }
      if (remote && remote.length === 0 && local.length) persistMany(table, local);
    };
    // 9개 테이블을 병렬로 조회하되, await Promise.all 로 한꺼번에 기다리지 않는다.
    // 각자 도착하는 즉시 state 를 채워, 대시보드 임계 경로(schedule_entries)가 무거운
    // reports/ai_plans 등을 기다리지 않고 곧바로 그려지게 한다(첫 실데이터 표시 지연 최소화).
    load<ScheduleEntry>('schedule_entries').then(guard(e0 => { if (e0) setEntries(e0); setDataLoading(false); }));
    load<Client>('clients').then(guard(c0 => { if (c0) setClients(c0); }));
    load<HandoverDoc>('handover_docs').then(guard(h0 => { if (h0) setHandoverDocs(h0); }));
    load<Vendor>('vendors').then(guard(v => syncLocalFirst('vendors', v, vendorsRef.current, setVendors)));
    load<AccountEntry>('accounts').then(guard(acc => syncLocalFirst('accounts', acc, accountsRef.current, setAccounts)));
    load<SiteEntry>('site_entries').then(guard(sites => syncLocalFirst('site_entries', sites, siteEntriesRef.current, setSiteEntries)));
    load<Report>('reports').then(guard(rep => syncLocalFirst('reports', rep, reportsRef.current, setReports)));
    load<WorkRequest>('requests').then(guard(reqs => syncLocalFirst('requests', reqs, requestsRef.current, setRequests)));
    // ai_plans: 원격에 있으면 우선(공유본), 비었고 로컬에만 있으면 backfill.
    load<AiPlanResult>('ai_plans').then(guard(plans => {
      if (plans && plans.length) setAiHistory([...plans].sort((a, b) => b.createdAt - a.createdAt));
      else if (plans && plans.length === 0 && aiHistoryRef.current.length) persistMany('ai_plans', aiHistoryRef.current);
    }));
    // 어시스턴트 대화: 최신순 정렬 후 가장 최근 대화 활성화(RLS 로 본인 것만 조회됨).
    load<AssistantConversation>('assistant_conversations').then(guard(convs => {
      if (!convs) return;
      const sorted = [...convs].sort((a, b) => b.updatedAt - a.updatedAt);
      setConversations(sorted);
      setActiveConversationId(sorted[0]?.id ?? null);
    }));
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

  // 업무 요청 실시간 구독: 다른 담당자가 보낸/확인/완료한 요청을 새로고침 없이 반영 + 알림.
  //  • 0012_requests.sql 로 requests 가 realtime publication 에 추가돼 있어야 한다.
  //  • 받은 요청(INSERT, toUid=나): 스티커메모 + 종/PC 알림.
  //  • 내가 보낸 요청의 상태변화(UPDATE, fromUid=나): "확인했어요 / 완료했어요" 알림.
  //  • 본인이 일으킨 변경은 이미 로컬에 반영돼 있어(prev 의 상태가 같음) 중복 알림이 안 뜬다.
  useEffect(() => {
    if (!supabase || !uid) return;
    const sb = supabase;
    const channel = sb
      .channel(`rt-requests-${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, payload => {
        if (payload.eventType === 'DELETE') {
          const oldId = (payload.old as { id?: string })?.id;
          if (oldId) setRequests(prev => prev.filter(r => r.id !== oldId));
          return;
        }
        const r = (payload.new as { data?: WorkRequest })?.data;
        if (!r || !r.id) return;
        const prev = requestsRef.current.find(x => x.id === r.id);
        setRequests(list => list.some(x => x.id === r.id) ? list.map(x => x.id === r.id ? r : x) : [r, ...list]);
        // 나에게 새로 들어온 요청 — 스티커메모는 화면에서 자동으로 뜨고, 여기선 종/PC 알림.
        if (r.toUid === uid && !prev) {
          pushNotification({ type: 'request', title: `${r.fromName || '동료'}님이 업무 요청을 보냈어요`, body: r.title, link: '/requests' });
          return;
        }
        // 내가 보낸 요청의 상태가 바뀜(담당자가 확인/완료) — 요청자에게 알림.
        if (r.fromUid === uid && prev && prev.status !== r.status) {
          if (r.status === 'confirmed') pushNotification({ type: 'request', title: `${r.toName || '담당자'}님이 요청을 확인했어요`, body: r.title, link: '/requests' });
          else if (r.status === 'done') pushNotification({ type: 'request', title: `${r.toName || '담당자'}님이 요청을 완료했어요`, body: r.title, link: '/requests' });
        }
      })
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, [uid, pushNotification]);

  return (
    <AppContext.Provider value={{
      entries, clients, handoverDocs, dataLoading, vendors, accounts, siteEntries, reports, members: orderedMembers, reloadMembers, aiHistory, saveAiPlan, removeAiPlan,
      aiPlanRunning, aiPlanError, startAiPlanJob, activeAiPlanId, clearActiveAiPlan,
      aiImageRunning, aiImageError, startAiImageJob,
      assistantMessages, assistantLoading, runAssistant, applyAssistantProposal, undoAssistantProposal,
      conversations, activeConversationId, newConversation, selectConversation, deleteConversation, deleteAssistantMessage,
      saveEntry, saveEntries, patchEntry, removeEntry, saveClient, removeClient, saveHandover, removeHandover,
      saveVendor, removeVendor, saveAccount, removeAccount, saveSite, removeSite, saveReport, removeReport,
      requests, sendRequest, confirmRequest, completeRequest, removeRequest,
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
