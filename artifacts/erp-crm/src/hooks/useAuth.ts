import { useState, useEffect } from "react";
import { useGetMe, useLogin, useLogout } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";

export function useAuth() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const token = localStorage.getItem("erp_token");

  const { data: user, isLoading, error } = useGetMe({
    query: {
      enabled: !!token,
      retry: false,
    }
  });

  const loginMutation = useLogin({
    mutation: {
      onSuccess: (data) => {
        localStorage.setItem("erp_token", data.token);
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
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
