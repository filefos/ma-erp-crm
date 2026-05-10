import { useEffect } from "react";
import { useGetMe, useLogin, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";

export function useAuth() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const token = localStorage.getItem("erp_token");

  const { data: user, isLoading, error } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      enabled: !!token,
      retry: false,
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    }
  });

  // If the stored token is rejected by the server, drop it immediately so the
  // app stops looping on the auth check and the user is sent to /login.
  useEffect(() => {
    if (!error) return;
    const status = (error as { status?: number; response?: { status?: number } })?.status
      ?? (error as { response?: { status?: number } })?.response?.status;
    if (status === 401 || status === 403) {
      localStorage.removeItem("erp_token");
      queryClient.clear();
      const p = window.location.pathname;
      if (p !== "/login" && p !== "/supplier-register" && !p.startsWith("/employee-register/")) setLocation("/login");
    }
  }, [error, queryClient, setLocation]);

  const loginMutation = useLogin({
    mutation: {
      onSuccess: (data, variables) => {
        localStorage.setItem("erp_token", data.token);
        // Prefer the workspace the user explicitly picked at the login screen;
        // fall back to their primary company. Drop any stale value from a
        // previous session so the new user never inherits the old workspace.
        const requested = (variables?.data as { companyId?: number | null } | undefined)?.companyId;
        const primary = (data.user as { companyId?: number | null })?.companyId;
        const chosen = requested ?? primary ?? null;
        if (chosen != null) {
          localStorage.setItem("erp_active_company_id", String(chosen));
        } else {
          localStorage.removeItem("erp_active_company_id");
        }
        queryClient.clear();
        setLocation("/dashboard");
      }
    }
  });

  const logoutMutation = useLogout({
    mutation: {
      onSuccess: () => {
        localStorage.removeItem("erp_token");
        localStorage.removeItem("erp_active_company_id");
        queryClient.clear();
        setLocation("/login");
      },
      onError: () => {
        // Fallback clear
        localStorage.removeItem("erp_token");
        localStorage.removeItem("erp_active_company_id");
        queryClient.clear();
        setLocation("/login");
      }
    }
  });

  useEffect(() => {
    const p = window.location.pathname;
    if (!token && p !== "/login" && p !== "/supplier-register" && !p.startsWith("/employee-register/")) {
      setLocation("/login");
    }
  }, [token, setLocation]);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login: loginMutation.mutate,
    isLoggingIn: loginMutation.isPending,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}
