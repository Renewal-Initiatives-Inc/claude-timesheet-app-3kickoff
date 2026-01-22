import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import type { EmployeePublic, LoginRequest } from '@renewal/types';
import {
  login as loginApi,
  logout as logoutApi,
  getCurrentUser,
  isAuthenticated as checkAuth,
  ApiRequestError,
} from '../api/client.js';

interface AuthContextValue {
  user: EmployeePublic | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  isSupervisor: boolean;
  login: (data: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<EmployeePublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check for existing auth on mount
  useEffect(() => {
    const initAuth = async () => {
      if (!checkAuth()) {
        setLoading(false);
        return;
      }

      try {
        const response = await getCurrentUser();
        setUser(response.employee);
      } catch {
        // Token invalid, clear it
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = useCallback(async (data: LoginRequest) => {
    setLoading(true);
    setError(null);
    try {
      const response = await loginApi(data);
      setUser(response.employee);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Login failed');
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } finally {
      setUser(null);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: AuthContextValue = {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    isSupervisor: user?.isSupervisor ?? false,
    login,
    logout,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
