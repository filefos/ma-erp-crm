import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";

export type LeadPreview = {
  id: number;
  leadName: string;
  requirementType?: string | null;
  location?: string | null;
  officeAddress?: string | null;
  budget?: number | null;
  quantity?: number | null;
  notes?: string | null;
  source?: string | null;
  status?: string | null;
  leadScore?: string | null;
  companyType?: string | null;
  website?: string | null;
  licenseNumber?: string | null;
  companyId?: number | null;
};

export type DelegatedTask = {
  id: number;
  companyId: number;
  grantedByUserId: number;
  grantedToUserId: number;
  taskType: string;
  taskLabel: string;
  leadId?: number | null;
  durationMinutes: number;
  expiresAt: string;
  status: string;
  completedAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
  grantedByName?: string;
  grantedToName?: string;
  leadName?: string | null;
  leadPreview?: LeadPreview | null;
};

type DelegatedTaskContextValue = {
  activeTask: DelegatedTask | null;
  completeTask: () => Promise<void>;
  dismissTask: () => void;
};

const DelegatedTaskContext = createContext<DelegatedTaskContextValue>({
  activeTask: null,
  completeTask: async () => {},
  dismissTask: () => {},
});

export function useDelegatedTask() {
  return useContext(DelegatedTaskContext);
}

const BASE = import.meta.env.BASE_URL ?? "/";

export function DelegatedTaskProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [activeTask, setActiveTask] = useState<DelegatedTask | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMine = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const token = localStorage.getItem("erp_token");
      const res = await fetch(`${BASE}api/delegated-tasks/mine`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return;
      const tasks: DelegatedTask[] = await res.json();
      const live = tasks.find(t => t.status === "pending" && new Date(t.expiresAt) > new Date());
      setActiveTask(live ?? null);
    } catch { /* non-critical */ }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchMine();
    intervalRef.current = setInterval(fetchMine, 15000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchMine]);

  const completeTask = useCallback(async () => {
    if (!activeTask) return;
    try {
      const token = localStorage.getItem("erp_token");
      await fetch(`${BASE}api/delegated-tasks/${activeTask.id}/complete`, {
        method: "PATCH",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setActiveTask(null);
    } catch { /* non-critical */ }
  }, [activeTask]);

  const dismissTask = useCallback(() => {
    setActiveTask(null);
  }, []);

  return (
    <DelegatedTaskContext.Provider value={{ activeTask, completeTask, dismissTask }}>
      {children}
    </DelegatedTaskContext.Provider>
  );
}
