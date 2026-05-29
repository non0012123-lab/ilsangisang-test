import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import DailySchedulePage from './pages/DailySchedulePage';
import FullSchedulePage from './pages/FullSchedulePage';
import CategoryPage from './pages/CategoryPage';
import ClientManagementPage from './pages/ClientManagementPage';
import ClientPortalPage from './pages/ClientPortalPage';
import TimetablePage from './pages/TimetablePage';
import AIPlanningPage from './pages/AIPlanningPage';
import HandoverPage from './pages/HandoverPage';

function ProtectedRoute({ children, allowClient = false }: { children: React.ReactNode; allowClient?: boolean }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!allowClient && user.role === 'client') return <Navigate to="/client-portal" replace />;
  if (allowClient && user.role !== 'client') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={user.role === 'client' ? '/client-portal' : '/dashboard'} replace /> : <LoginPage />} />

      {/* Employee routes */}
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/schedule/daily" element={<ProtectedRoute><DailySchedulePage /></ProtectedRoute>} />
      <Route path="/schedule/full" element={<ProtectedRoute><FullSchedulePage /></ProtectedRoute>} />
      <Route path="/category/:category" element={<ProtectedRoute><CategoryPage /></ProtectedRoute>} />
      <Route path="/clients" element={<ProtectedRoute><ClientManagementPage /></ProtectedRoute>} />
      <Route path="/timetable" element={<ProtectedRoute><TimetablePage /></ProtectedRoute>} />
      <Route path="/ai-planning" element={<ProtectedRoute><AIPlanningPage /></ProtectedRoute>} />
      <Route path="/handover" element={<ProtectedRoute><HandoverPage /></ProtectedRoute>} />

      {/* Client portal */}
      <Route path="/client-portal" element={<ProtectedRoute allowClient><ClientPortalPage /></ProtectedRoute>} />

      {/* Default redirect */}
      <Route path="/" element={<Navigate to={user ? (user.role === 'client' ? '/client-portal' : '/dashboard') : '/login'} replace />} />
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
