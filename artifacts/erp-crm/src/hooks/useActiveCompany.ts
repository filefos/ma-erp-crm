import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

const STORAGE_KEY = "erp_active_company_id";
const CHANGE_EVENT = "erp:active-company-changed";
const ELITE_SCHEME_KEY = "elite_color_scheme";
const ELITE_SCHEME_EVENT = "erp:elite-scheme-changed";

const COMPANY_INFO: Record<number, { name: string; short: string; poweredBy: string; logoSrc: string }> = {
  1: { name: "Prime Max Prefab Houses Ind. LLC", short: "Prime Max", poweredBy: "Prime Solution", logoSrc: "/prime-max-logo.png" },
  2: { name: "Elite Pre-Fabricated Houses Trading Co. LLC", short: "Elite Prefab", poweredBy: "Prime Solution", logoSrc: "/elite-prefab-logo.png" },
};

export type EliteScheme = "A" | "B";

function readStored(): number | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(STORAGE_KEY);
  if (!v) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function readEliteScheme(): EliteScheme {
  if (typeof window === "undefined") return "A";
  return (localStorage.getItem(ELITE_SCHEME_KEY) as EliteScheme) ?? "A";
}

export function useActiveCompany() {
  const { user } = useAuth();
  const userCompanyId = (user as any)?.companyId as number | null | undefined;

  const [activeCompanyId, setActiveCompanyId] = useState<number>(() => {
    return readStored() ?? userCompanyId ?? 1;
  });

  const [eliteScheme, setEliteSchemeState] = useState<EliteScheme>(readEliteScheme);

  useEffect(() => {
    if (readStored() == null && userCompanyId) {
      localStorage.setItem(STORAGE_KEY, String(userCompanyId));
      setActiveCompanyId(userCompanyId);
    }
  }, [userCompanyId]);

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

  useEffect(() => {
    const onSchemeChange = () => setEliteSchemeState(readEliteScheme());
    window.addEventListener(ELITE_SCHEME_EVENT, onSchemeChange);
    return () => window.removeEventListener(ELITE_SCHEME_EVENT, onSchemeChange);
  }, []);

  const queryClient = useQueryClient();

  const setActiveCompany = useCallback((id: number) => {
    localStorage.setItem(STORAGE_KEY, String(id));
    setActiveCompanyId(id);
    window.dispatchEvent(new Event(CHANGE_EVENT));
    queryClient.clear();
  }, [queryClient]);

  const toggleEliteScheme = useCallback(() => {
    const next: EliteScheme = readEliteScheme() === "A" ? "B" : "A";
    localStorage.setItem(ELITE_SCHEME_KEY, next);
    setEliteSchemeState(next);
    window.dispatchEvent(new Event(ELITE_SCHEME_EVENT));
  }, []);

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
    logoSrc: info.logoSrc,
    setActiveCompany,
    filterByCompany,
    eliteScheme,
    toggleEliteScheme,
  };
}
