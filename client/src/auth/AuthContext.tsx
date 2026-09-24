import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiRequest, getTokens, setTokens } from '../api/client';
import type { Single, User } from '../api/types';

interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (organizationName: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const tokens = getTokens();
    if (!tokens) {
      setLoading(false);
      return;
    }
    apiRequest<Single<User>>('/api/auth/me')
      .then((res) => setUser(res.data))
      .catch(() => setTokens(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const res = await apiRequest<Single<AuthResponse>>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    setTokens({ accessToken: res.data.accessToken, refreshToken: res.data.refreshToken });
    setUser(res.data.user);
  }

  async function signup(organizationName: string, email: string, password: string) {
    const res = await apiRequest<Single<AuthResponse>>('/api/auth/signup', {
      method: 'POST',
      body: { organizationName, email, password },
    });
    setTokens({ accessToken: res.data.accessToken, refreshToken: res.data.refreshToken });
    setUser(res.data.user);
  }

  function logout() {
    const tokens = getTokens();
    if (tokens) {
      apiRequest('/api/auth/logout', { method: 'POST', body: { refreshToken: tokens.refreshToken } }).catch(
        () => {},
      );
    }
    setTokens(null);
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, signup, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
