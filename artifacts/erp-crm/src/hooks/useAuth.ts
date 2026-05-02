import { useEffect } from "react";
import { useGetMe, useLogin, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";

export function useAuth() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const token = localStorage.getItem("erp_token");

  const { data: user, isLoading } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      enabled: !!token,
      retry: false,
    }
  });

  const loginMutation = useLogin({
    mutation: {
      onSuccess: (data) => {
        localStorage.setItem("erp_token", data.token);
        if ((data.user as { companyId?: number | null })?.companyId) {
          localStorage.setItem("erp_active_company_id", String((data.user as { companyId: number }).companyId));
        }
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        setLocation("/dashboard");
      }
    }
  });

  const logoutMutation = useLogout({
    mutation: {
      onSuccess: () => {
        localStorage.removeItem("erp_token");
        queryClient.clear();
        setLocation("/login");
      },
      onError: () => {
        // Fallback clear
        localStorage.removeItem("erp_token");
        queryClient.clear();
        setLocation("/login");
      }
    }
  });

  useEffect(() => {
    if (!token && window.location.pathname !== "/login") {
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
