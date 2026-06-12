import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { api, setAccessToken, setOnSessionExpired } from '@/lib/api';
import type { AuthResponse, AuthUser, LoginCredentials, Role } from '@/types/auth';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Ao carregar a aplicação, tenta restaurar a sessão usando o refresh token
  // (cookie httpOnly) sem exigir um novo login.
  useEffect(() => {
    let active = true;

    setOnSessionExpired(() => {
      setAccessToken(null);
      if (active) setUser(null);
    });

    api
      .post<AuthResponse>('/auth/refresh')
      .then((response) => {
        if (!active) return;
        setAccessToken(response.data.accessToken);
        setUser(response.data.user);
      })
      .catch(() => {
        if (!active) return;
        setAccessToken(null);
        setUser(null);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
      setOnSessionExpired(null);
    };
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const response = await api.post<AuthResponse>('/auth/login', credentials);
    setAccessToken(response.data.accessToken);
    setUser(response.data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  const hasRole = useCallback((...roles: Role[]) => !!user && roles.includes(user.role), [user]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isLoading, login, logout, hasRole }),
    [user, isLoading, login, logout, hasRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  }
  return context;
}
