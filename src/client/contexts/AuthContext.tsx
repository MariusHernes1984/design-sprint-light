import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api, setToken, clearToken } from '../lib/api.js';

interface User {
  id: string;
  name: string;
  email?: string;
  role: 'facilitator' | 'participant';
  userRole?: 'ADMIN' | 'USER';
  assignedWorkshopId?: string | null;
  assignedWorkshop?: { id: string; title: string; currentStep: string } | null;
  workshop?: { id: string; title: string; currentStep: string };
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  joinWorkshop: (joinCode: string, name: string) => Promise<{ workshopId: string }>;
  logout: () => void;
  isAdmin: boolean;
  isUser: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.get<User>('/auth/me')
        .then(setUser)
        .catch(() => { clearToken(); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.post<{ token: string; user: User }>('/auth/login', { email, password });
    setToken(result.token);
    setUser(result.user);
  }, []);

  const joinWorkshop = useCallback(async (joinCode: string, name: string) => {
    const result = await api.post<{ token: string; user: User; workshop: { id: string } }>('/auth/join', { joinCode, name });
    setToken(result.token);
    setUser({ ...result.user, workshop: result.workshop as User['workshop'] });
    return { workshopId: result.workshop.id };
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  const isAdmin = user?.role === 'facilitator' && user?.userRole === 'ADMIN';
  const isUser = user?.role === 'facilitator' && user?.userRole === 'USER';

  return (
    <AuthContext.Provider value={{ user, loading, login, joinWorkshop, logout, isAdmin, isUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
