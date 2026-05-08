import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { client } from "../services";
import type { AuthMessage, User } from "../types/contracts";

const TOKEN_STORAGE_KEY = "dressme.accessToken";

type RegisterInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
};

type AuthContextValue = {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<AuthMessage>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const updateUser = useCallback((updatedUser: User) => {
  setUser(updatedUser);
  }, []);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const restoreSession = useCallback(async () => {
    try {
      const storedToken = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
      if (!storedToken) {
        return;
      }

      const currentUser = await client.getMe(storedToken);
      setToken(storedToken);
      setUser(currentUser);
    } catch {
      await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  const login = useCallback(async (email: string, password: string) => {
    const session = await client.login(email.trim().toLowerCase(), password);

    await AsyncStorage.setItem(TOKEN_STORAGE_KEY, session.accessToken);
    setToken(session.accessToken);
    setUser(session.user);
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    return client.register({
      ...input,
      email: input.email.trim().toLowerCase(),
    });
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoading,
      isAuthenticated: Boolean(token && user),
      user,
      token,
      login,
      register,
      logout,
      updateUser,
    }),
    [isLoading, login, logout, register, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
