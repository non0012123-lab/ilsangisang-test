import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
import DailySchedulePage from './pages/DailySchedulePage';
import FullSchedulePage from './pages/FullSchedulePage';
import CategoryPage from './pages/CategoryPage';
import ClientSchedulePage from './pages/ClientSchedulePage';
import ClientManagementPage from './pages/ClientManagementPage';
import ClientPortalPage from './pages/ClientPortalPage';
import TimetablePage from './pages/TimetablePage';
import AIPlanningPage from './pages/AIPlanningPage';
import HandoverPage from './pages/HandoverPage';
import PendingApprovalPage from './pages/PendingApprovalPage';
import ApprovalsPage from './pages/ApprovalsPage';
import type { AuthUser } from './types';

// 역할별 첫 화면
function homeFor(user: AuthUser): string {
  if (user.role === 'pending') return '/pending';
  if (user.role === 'client') return '/client-portal';
  return '/dashboard';
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

function ProtectedRoute({ children, allowClient = false, adminOnly = false }: { children: React.ReactNode; allowClient?: boolean; adminOnly?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  // 승인 전(pending)에는 어떤 내부 화면에도 접근 불가
  if (user.role === 'pending') return <Navigate to="/pending" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  if (!allowClient && user.role === 'client') return <Navigate to="/client-portal" replace />;
  if (allowClient && user.role !== 'client') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <FullScreenLoader />;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={homeFor(user)} replace /> : <LoginPage />} />
      <Route path="/signup" element={user ? <Navigate to={homeFor(user)} replace /> : <SignupPage />} />

      {/* 승인 대기 화면 (로그인은 됐으나 미승인) */}
      <Route path="/pending" element={
        !user ? <Navigate to="/login" replace />
          : user.role === 'pending' ? <PendingApprovalPage />
          : <Navigate to={homeFor(user)} replace />
      } />

      {/* Employee routes */}
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/schedule/daily" element={<ProtectedRoute><DailySchedulePage /></ProtectedRoute>} />
      <Route path="/schedule/full" element={<ProtectedRoute><FullSchedulePage /></ProtectedRoute>} />
      <Route path="/category/:category" element={<ProtectedRoute><CategoryPage /></ProtectedRoute>} />
      <Route path="/client/:clientId" element={<ProtectedRoute><ClientSchedulePage /></ProtectedRoute>} />
      <Route path="/clients" element={<ProtectedRoute><ClientManagementPage /></ProtectedRoute>} />
      <Route path="/approvals" element={<ProtectedRoute adminOnly><ApprovalsPage /></ProtectedRoute>} />
      <Route path="/timetable" element={<ProtectedRoute><TimetablePage /></ProtectedRoute>} />
      <Route path="/ai-planning" element={<ProtectedRoute><AIPlanningPage /></ProtectedRoute>} />
      <Route path="/handover" element={<ProtectedRoute><HandoverPage /></ProtectedRoute>} />

      {/* Client portal */}
      <Route path="/client-portal" element={<ProtectedRoute allowClient><ClientPortalPage /></ProtectedRoute>} />

      {/* Default redirect */}
      <Route path="/" element={<Navigate to={user ? homeFor(user) : '/login'} replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppProvider>
          <AppRoutes />
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
