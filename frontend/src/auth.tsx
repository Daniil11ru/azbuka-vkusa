import { createContext, ReactNode, useContext, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { api, clearSession, getStoredUser, getToken, setSession } from "./api/client";
import { User } from "./api/types";

interface AuthState {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() =>
    getToken() ? getStoredUser<User>() : null,
  );

  const login = async (username: string, password: string) => {
    const data = await api<{ token: string; user: User }>("/api/auth/login", {
      method: "POST",
      body: { username, password },
    });
    setSession(data.token, data.user);
    setUser(data.user);
  };

  const logout = () => {
    clearSession();
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}
