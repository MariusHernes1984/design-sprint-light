import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext.js';
import { Landing } from './pages/shared/Landing.js';
import { Login } from './pages/facilitator/Login.js';
import { Dashboard } from './pages/facilitator/Dashboard.js';
import { Archive } from './pages/facilitator/Archive.js';
import { WorkshopManage } from './pages/facilitator/WorkshopManage.js';
import { Join } from './pages/participant/Join.js';
import { ParticipantView } from './pages/participant/ParticipantView.js';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading"><div className="spinner" /></div>;
  if (!user || user.role !== 'facilitator') return <Navigate to="/login" />;
  return <>{children}</>;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/join" element={<Join />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/archive" element={<ProtectedRoute><Archive /></ProtectedRoute>} />
        <Route path="/workshop/:id/manage" element={<ProtectedRoute><WorkshopManage /></ProtectedRoute>} />
        <Route path="/workshop/:id/participant" element={<ParticipantView />} />
      </Routes>
    </BrowserRouter>
  );
}
