import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  setAuthTokenGetter,
  setActiveCompanyGetter,
  setBaseUrl,
  type User,
} from "@workspace/api-client-react";
import { authStorage } from "@/lib/storage";

export interface CompanyInfo {
  id: number;
  name: string;
  short: string;
}

const COMPANY_INFO: Record<number, CompanyInfo> = {
  1: { id: 1, name: "Prime Max Prefab Houses Ind. LLC", short: "Prime Max" },
  2: { id: 2, name: "Elite Prefab Industries LLC", short: "Elite Prefab" },
};

interface AppContextValue {
  ready: boolean;
  token: string | null;
  user: User | null;
  setSession: (token: string, user: User, companyId: number | null) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (user: User | null) => void;
  activeCompanyId: number | null;
  activeCompany: CompanyInfo | null;
  setActiveCompany: (id: number) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

const domain = process.env.EXPO_PUBLIC_DOMAIN;
if (domain) {
  setBaseUrl(`https://${domain}`);
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUserState] = useState<User | null>(null);
  const [activeCompanyId, setActiveCompanyId] = useState<number | null>(null);

  // Boot: pull token + active company from secure storage.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [t, c] = await Promise.all([
        authStorage.getToken(),
        authStorage.getCompanyId(),
      ]);
      if (cancelled) return;
      setToken(t);
      setActiveCompanyId(c);
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  // Wire the api-client header providers — getters fire on every fetch so they
  // always reflect current state without prop drilling.
  useEffect(() => {
    setAuthTokenGetter(() => token);
    setActiveCompanyGetter(() => activeCompanyId);
  }, [token, activeCompanyId]);

  const setSession = useCallback(async (newToken: string, newUser: User, companyId: number | null) => {
    await authStorage.setToken(newToken);
    if (companyId != null) {
      await authStorage.setCompanyId(companyId);
    } else {
      await authStorage.clearCompanyId();
    }
    setToken(newToken);
    setUserState(newUser);
    setActiveCompanyId(companyId);
    queryClient.clear();
  }, [queryClient]);

  const signOut = useCallback(async () => {
    await Promise.all([authStorage.clearToken(), authStorage.clearCompanyId()]);
    setToken(null);
    setUserState(null);
    setActiveCompanyId(null);
    queryClient.clear();
  }, [queryClient]);

  const setActiveCompany = useCallback(async (id: number) => {
    await authStorage.setCompanyId(id);
    setActiveCompanyId(id);
    queryClient.clear();
  }, [queryClient]);

  const activeCompany = activeCompanyId != null ? (COMPANY_INFO[activeCompanyId] ?? null) : null;

  const value = useMemo<AppContextValue>(() => ({
    ready,
    token,
    user,
    setSession,
    signOut,
    setUser: setUserState,
    activeCompanyId,
    activeCompany,
    setActiveCompany,
  }), [ready, token, user, activeCompanyId, activeCompany, setSession, signOut, setActiveCompany]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}

export function useCompanyInfo(id: number | null | undefined): CompanyInfo | null {
  if (id == null) return null;
  return COMPANY_INFO[id] ?? null;
}
