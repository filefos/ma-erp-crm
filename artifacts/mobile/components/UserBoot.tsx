import { useEffect } from "react";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useApp } from "@/contexts/AppContext";

/**
 * After a cold boot we have a token in SecureStore but no user object in
 * memory. This component refetches /api/auth/me whenever a token is present
 * and the user state is missing, then hydrates AppContext.
 */
export function UserBoot() {
  const { token, user, setUser, signOut, activeCompanyId, setActiveCompany } = useApp();
  const { data, error } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      enabled: !!token && !user,
      retry: false,
      staleTime: 60_000,
    },
  });

  useEffect(() => {
    if (data) {
      setUser(data);
      const primary = (data as { companyId?: number | null }).companyId ?? null;
      if (activeCompanyId == null && primary != null) {
        void setActiveCompany(primary);
      }
    }
  }, [data, activeCompanyId, setUser, setActiveCompany]);

  // Token rejected (expired/invalid) -> drop the session.
  useEffect(() => {
    if (!error) return;
    const status = (error as { status?: number }).status;
    if (status === 401 || status === 403) {
      void signOut();
    }
  }, [error, signOut]);

  return null;
}
