import { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import { runSilentUpdate } from './utils/tauriUpdate';
import { startVersionWatch } from './utils/versionCheck';
import { getWindowLabel } from './utils/tauriWindow';
import type { AuthUser } from './types';

// 라우트 페이지는 지연 로딩(코드 스플리팅) — 초기 번들을 줄여 첫 로딩을 빠르게 한다.
//  방문한 화면의 청크만 그때 받으므로, 무거운 페이지(단가표·AI·PDF 등)가 초기 로딩을 막지 않는다.
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignupPage = lazy(() => import('./pages/SignupPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const DailySchedulePage = lazy(() => import('./pages/DailySchedulePage'));
const FullSchedulePage = lazy(() => import('./pages/FullSchedulePage'));
const ClientSchedulePage = lazy(() => import('./pages/ClientSchedulePage'));
const ClientManagementPage = lazy(() => import('./pages/ClientManagementPage'));
const VendorManagementPage = lazy(() => import('./pages/VendorManagementPage'));
const ClientPortalPage = lazy(() => import('./pages/ClientPortalPage'));
const TimetablePage = lazy(() => import('./pages/TimetablePage'));
const AIPlanningPage = lazy(() => import('./pages/AIPlanningPage'));
const AIResultsPage = lazy(() => import('./pages/AIResultsPage'));
const KeywordToolPage = lazy(() => import('./pages/KeywordToolPage'));
const AccountListPage = lazy(() => import('./pages/AccountListPage'));
const SiteListPage = lazy(() => import('./pages/SiteListPage'));
const RequestsPage = lazy(() => import('./pages/RequestsPage'));
const NoticesPage = lazy(() => import('./pages/NoticesPage'));
const RankGuaranteePage = lazy(() => import('./pages/RankGuaranteePage'));
const InternalSchedulePage = lazy(() => import('./pages/InternalSchedulePage'));
const PricingPage = lazy(() => import('./pages/PricingPage'));
const SalesPage = lazy(() => import('./pages/SalesPage'));
const AssistantWidgetPage = lazy(() => import('./pages/AssistantWidgetPage'));
const PendingApprovalPage = lazy(() => import('./pages/PendingApprovalPage'));
const SuspendedPage = lazy(() => import('./pages/SuspendedPage'));
const ApprovalsPage = lazy(() => import('./pages/ApprovalsPage'));

// 역할별 첫 화면
function homeFor(user: AuthUser): string {
  if (user.status === 'suspended') return '/suspended';
  if (user.role === 'pending') return '/pending';
  if (user.role === 'client') return '/client-portal';
  return '/dashboard';
}

// 데스크톱 트레이 어시스턴트 퀵바(라벨 'assistant' 창)를 항상 /widget 에 고정한다.
//  • 이 창의 URL 이 어떤 이유로든(절전 후 webview 리로드·경로 변형 등) /widget 을 벗어나면
//    기본 라우트가 /dashboard 로 튕겨 위젯 대신 대시보드가 떠버린다(닫기·최소화 버튼도 사라짐).
//    단축키는 show/hide 만 하므로 한 번 어긋나면 스스로 복구되지 않는다.
//  • 그래서 로그인된 직원이 이 창에서 /widget 을 벗어나면 즉시 되돌린다(자가복구).
//    인증 전(user 없음)·클라이언트는 위젯 대상이 아니므로 건드리지 않는다(리다이렉트 루프 방지).
function AssistantWindowGuard() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isAssistant, setIsAssistant] = useState(false);

  useEffect(() => {
    let active = true;
    void getWindowLabel().then(label => { if (active && label === 'assistant') setIsAssistant(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!isAssistant || loading || !user || user.role === 'client') return;
    if (location.pathname !== '/widget') navigate('/widget', { replace: true });
  }, [isAssistant, user, loading, location.pathname, navigate]);

  return null;
}

function FullScreenLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-400">불러오는 중...</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children, allowClient = false, adminOnly = false, requireSales = false }: { children: React.ReactNode; allowClient?: boolean; adminOnly?: boolean; requireSales?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  // 중지된 계정은 어떤 내부 화면에도 접근 불가
  if (user.status === 'suspended') return <Navigate to="/suspended" replace />;
  // 승인 전(pending)에는 어떤 내부 화면에도 접근 불가
  if (user.role === 'pending') return <Navigate to="/pending" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  // 영업관리: 관리자 또는 sales_access 권한자만
  if (requireSales && user.role !== 'admin' && !user.salesAccess) return <Navigate to="/dashboard" replace />;
  if (!allowClient && user.role === 'client') return <Navigate to="/client-portal" replace />;
  if (allowClient && user.role !== 'client') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <FullScreenLoader />;

  return (
    <Suspense fallback={<FullScreenLoader />}>
    <Routes>
      <Route path="/login" element={user ? <Navigate to={homeFor(user)} replace /> : <LoginPage />} />
      <Route path="/signup" element={user ? <Navigate to={homeFor(user)} replace /> : <SignupPage />} />

      {/* 승인 대기 화면 (로그인은 됐으나 미승인) */}
      <Route path="/pending" element={
        !user ? <Navigate to="/login" replace />
          : user.status === 'suspended' ? <Navigate to="/suspended" replace />
          : user.role === 'pending' ? <PendingApprovalPage />
          : <Navigate to={homeFor(user)} replace />
      } />

      {/* 계정 중지 안내 화면 */}
      <Route path="/suspended" element={
        !user ? <Navigate to="/login" replace />
          : user.status === 'suspended' ? <SuspendedPage />
          : <Navigate to={homeFor(user)} replace />
      } />

      {/* Employee routes */}
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/schedule/daily" element={<ProtectedRoute><DailySchedulePage /></ProtectedRoute>} />
      <Route path="/schedule/full" element={<ProtectedRoute><FullSchedulePage /></ProtectedRoute>} />
      {/* 파라미터 없는 진입(사이드바 '클라이언트별 스케줄') — 페이지가 첫 업체로 자동 이동 */}
      <Route path="/client" element={<ProtectedRoute><ClientSchedulePage /></ProtectedRoute>} />
      <Route path="/client/:clientId" element={<ProtectedRoute><ClientSchedulePage /></ProtectedRoute>} />
      <Route path="/clients" element={<ProtectedRoute><ClientManagementPage /></ProtectedRoute>} />
      <Route path="/vendors" element={<ProtectedRoute><VendorManagementPage /></ProtectedRoute>} />
      <Route path="/approvals" element={<ProtectedRoute adminOnly><ApprovalsPage /></ProtectedRoute>} />
      <Route path="/timetable" element={<ProtectedRoute><TimetablePage /></ProtectedRoute>} />
      <Route path="/ai-planning" element={<ProtectedRoute><AIPlanningPage /></ProtectedRoute>} />
      <Route path="/ai-results" element={<ProtectedRoute><AIResultsPage /></ProtectedRoute>} />
      <Route path="/keyword-tool" element={<ProtectedRoute><KeywordToolPage /></ProtectedRoute>} />
      <Route path="/accounts" element={<ProtectedRoute><AccountListPage /></ProtectedRoute>} />
      <Route path="/sites" element={<ProtectedRoute><SiteListPage /></ProtectedRoute>} />
      <Route path="/requests" element={<ProtectedRoute><RequestsPage /></ProtectedRoute>} />
      <Route path="/notices" element={<ProtectedRoute><NoticesPage /></ProtectedRoute>} />
      <Route path="/internal" element={<ProtectedRoute><InternalSchedulePage /></ProtectedRoute>} />
      <Route path="/rank-guarantee" element={<ProtectedRoute><RankGuaranteePage /></ProtectedRoute>} />
      <Route path="/pricing" element={<ProtectedRoute><PricingPage /></ProtectedRoute>} />
      <Route path="/sales" element={<ProtectedRoute requireSales><SalesPage /></ProtectedRoute>} />
      {/* 데스크톱 앱 트레이용 어시스턴트 퀵바(별도 webview 창) — 네비/헤더 없이 어시스턴트만 */}
      <Route path="/widget" element={<ProtectedRoute><AssistantWidgetPage /></ProtectedRoute>} />
      {/* 인수인계는 클라이언트 관리로 통합됨 — 기존 링크/북마크 호환용 리다이렉트 */}
      <Route path="/handover" element={<Navigate to="/clients" replace />} />

      {/* Client portal */}
      <Route path="/client-portal" element={<ProtectedRoute allowClient><ClientPortalPage /></ProtectedRoute>} />

      {/* Default redirect */}
      <Route path="/" element={<Navigate to={user ? homeFor(user) : '/login'} replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
}

export default function App() {
  // 데스크톱 셸이면 시작 시 자동 업데이트 확인(웹에서는 no-op).
  useEffect(() => { void runSilentUpdate(); }, []);
  // 새 배포 감지 자동 새로고침 — 포커스/가시성 전환·주기적 확인(오래 떠 있는 트레이 위젯 포함).
  useEffect(() => { startVersionWatch(); }, []);
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppProvider>
          <AssistantWindowGuard />
          <AppRoutes />
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
