import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

const STORAGE_KEY = "erp_active_company_id";
const CHANGE_EVENT = "erp:active-company-changed";

const COMPANY_INFO: Record<number, { name: string; short: string; poweredBy: string }> = {
  1: { name: "Prime Max Prefab Houses Ind. LLC", short: "Prime Max", poweredBy: "Prime Max" },
  2: { name: "Elite Prefab Industries LLC", short: "Elite Prefab", poweredBy: "Elite Prefab" },
};

function readStored(): number | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(STORAGE_KEY);
  if (!v) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

export function useActiveCompany() {
  const { user } = useAuth();
  const userCompanyId = (user as any)?.companyId as number | null | undefined;

  // localStorage is the source of truth for the user-selected workspace; the
  // user's primary companyId is only a fallback when nothing has been picked.
  const [activeCompanyId, setActiveCompanyId] = useState<number>(() => {
    return readStored() ?? userCompanyId ?? 1;
  });

  // Sync to login/logout — when the user object first loads with a companyId
  // and nothing has been picked yet, seed localStorage so the API header is
  // attached on the very next request.
  useEffect(() => {
    if (readStored() == null && userCompanyId) {
      localStorage.setItem(STORAGE_KEY, String(userCompanyId));
      setActiveCompanyId(userCompanyId);
    }
  }, [userCompanyId]);

  // React to switches initiated elsewhere in the app (other tabs, the
  // company switcher dropdown, etc.).
  useEffect(() => {
    const onChange = () => {
      const next = readStored();
      if (next != null) setActiveCompanyId(next);
    };
    window.addEventListener("storage", onChange);
    window.addEventListener(CHANGE_EVENT, onChange as EventListener);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener(CHANGE_EVENT, onChange as EventListener);
    };
  }, []);

  const queryClient = useQueryClient();

  const setActiveCompany = useCallback((id: number) => {
    localStorage.setItem(STORAGE_KEY, String(id));
    setActiveCompanyId(id);
    window.dispatchEvent(new Event(CHANGE_EVENT));
    // Server-side scoping changes — drop all cached queries so every screen
    // re-fetches against the new workspace.
    queryClient.clear();
  }, [queryClient]);

  const info = COMPANY_INFO[activeCompanyId] ?? COMPANY_INFO[1];

  function filterByCompany<T extends object>(items: T[]): T[] {
    return items.filter(item => {
      const itemCompany = (item as any).companyId as number | undefined | null;
      if (itemCompany == null) return true;
      return itemCompany === activeCompanyId;
    });
  }

  return {
    activeCompanyId,
    companyName: info.name,
    companyShort: info.short,
    poweredBy: info.poweredBy,
    setActiveCompany,
    filterByCompany,
  };
}
