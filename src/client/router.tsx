import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext.js';
import { Landing } from './pages/shared/Landing.js';
import { Login } from './pages/facilitator/Login.js';
import { Dashboard } from './pages/facilitator/Dashboard.js';
import { Archive } from './pages/facilitator/Archive.js';
import { Users } from './pages/facilitator/Users.js';
import { UserWorkshopView } from './pages/facilitator/UserWorkshopView.js';
import { WorkshopManage } from './pages/facilitator/WorkshopManage.js';
import { Join } from './pages/participant/Join.js';
import { ParticipantView } from './pages/participant/ParticipantView.js';

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <div className="loading"><div className="spinner" /></div>;
  if (!user || user.role !== 'facilitator') return <Navigate to="/login" />;
  if (!isAdmin) return <Navigate to="/my-workshop" />;
  return <>{children}</>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading"><div className="spinner" /></div>;
  if (!user || user.role !== 'facilitator') return <Navigate to="/login" />;
  return <>{children}</>;
}

function SmartRedirect() {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <div className="loading"><div className="spinner" /></div>;
  if (!user || user.role !== 'facilitator') return <Navigate to="/login" />;
  if (isAdmin) return <Navigate to="/dashboard" />;
  return <Navigate to="/my-workshop" />;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/join" element={<Join />} />
        <Route path="/home" element={<SmartRedirect />} />
        <Route path="/dashboard" element={<AdminRoute><Dashboard /></AdminRoute>} />
        <Route path="/archive" element={<AdminRoute><Archive /></AdminRoute>} />
        <Route path="/users" element={<AdminRoute><Users /></AdminRoute>} />
        <Route path="/workshop/:id/manage" element={<AdminRoute><WorkshopManage /></AdminRoute>} />
        <Route path="/my-workshop" element={<AuthRoute><UserWorkshopView /></AuthRoute>} />
        <Route path="/workshop/:id/participant" element={<ParticipantView />} />
      </Routes>
    </BrowserRouter>
  );
}
