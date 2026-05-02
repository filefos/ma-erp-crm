import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

export function AdminGuard({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  const lvl = user?.permissionLevel ?? "";
  const isAdmin = lvl === "super_admin" || lvl === "company_admin";

  useEffect(() => {
    if (!isLoading && user && !isAdmin) {
      setLocation("/dashboard");
    }
  }, [isLoading, user, isAdmin, setLocation]);

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return <>{children}</>;
}
