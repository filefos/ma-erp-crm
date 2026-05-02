import { useAuth } from "@/hooks/useAuth";

const COMPANY_INFO: Record<number, { name: string; short: string; poweredBy: string }> = {
  1: { name: "Prime Max Prefab Houses Ind. LLC", short: "Prime Max", poweredBy: "Prime Max" },
  2: { name: "Elite Prefab Industries LLC", short: "Elite Prefab", poweredBy: "Elite Prefab" },
};

export function useActiveCompany() {
  const { user } = useAuth();
  const userCompanyId = (user as any)?.companyId as number | null | undefined;
  const stored = typeof window !== "undefined" ? localStorage.getItem("erp_active_company_id") : null;
  const activeCompanyId: number = userCompanyId ?? (stored ? parseInt(stored, 10) : 1);
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
    filterByCompany,
  };
}
