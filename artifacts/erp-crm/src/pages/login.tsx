import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { Shield, ArrowRight, Loader2, Check } from "lucide-react";
import { useListAuthCompanies } from "@workspace/api-client-react";

export function Login() {
  const { login, isLoggingIn } = useAuth();
  const { data: companies } = useListAuthCompanies();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (companies && companies.length && companyId === null) {
      setCompanyId(companies[0].id);
    }
  }, [companies, companyId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    login(
      { data: { email, password, companyId: companyId ?? undefined } },
      {
        onError: (err: unknown) => {
          const msg =
            (err as { error?: string; message?: string })?.error ??
            (err as { message?: string })?.message ??
            "Invalid credentials";
          setError(msg);
        },
      }
    );
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-background">
      {/* LEFT — branding panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-[#0f2d5a] text-white">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background:
              "radial-gradient(circle at 20% 20%, #1e6ab0 0%, transparent 50%), radial-gradient(circle at 80% 80%, #38bdf8 0%, transparent 45%)",
          }}
        />
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div className="flex items-center gap-3">
            <div className="bg-white/15 rounded-2xl p-4 backdrop-blur ring-1 ring-white/20">
              <img
                src="/prime-max-logo.png"
                alt="Prime Max & Elite Prefab"
                className="h-24 w-auto object-contain"
                style={{ filter: "brightness(0) invert(1) drop-shadow(0 1px 6px rgba(0,0,0,0.25))" }}
              />
            </div>
          </div>

          <div className="space-y-6 max-w-md">
            <h1 className="text-4xl font-bold leading-tight tracking-tight">
              Run two companies from one secure platform.
            </h1>
            <p className="text-white/70 text-sm leading-relaxed">
              Multi-company sales, accounts, procurement, inventory, projects and HR — built for
              Prime Max General Trading and Elite Prefab Industries.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-white/50">
            <Shield className="w-3.5 h-3.5" />
            Enterprise-grade audit logging · Role-based access control
          </div>
        </div>
      </div>

      {/* RIGHT — form panel */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm space-y-6">
          <div className="lg:hidden flex items-center gap-3 mb-4">
            <img
              src="/prime-max-logo.png"
              alt="Prime Max & Elite Prefab"
              className="h-10 w-auto object-contain"
            />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">Welcome back</h2>
            <p className="text-sm text-muted-foreground">Sign in to your ERP workspace.</p>
          </div>

          {/* Company selector */}
          {companies && companies.length > 0 && (
            <div className="space-y-2" data-testid="company-selector">
              <Label className="text-xs font-medium">Company workspace</Label>
              <div className="grid grid-cols-2 gap-2">
                {companies.map((c) => {
                  const selected = companyId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCompanyId(c.id)}
                      data-testid={`company-option-${c.id}`}
                      data-selected={selected ? "true" : "false"}
                      aria-pressed={selected}
                      className={`relative text-left rounded-lg border p-3 transition-all ${
                        selected
                          ? "border-[#1e6ab0] bg-[#1e6ab0]/5 ring-2 ring-[#1e6ab0]/30"
                          : "border-border hover:border-[#1e6ab0]/50 hover:bg-muted/40"
                      }`}
                    >
                      <div className="text-[10px] font-mono text-[#1e6ab0] tracking-widest uppercase">
                        {c.prefix}
                      </div>
                      <div className="text-xs font-semibold mt-1 leading-tight truncate">
                        {c.shortName ?? c.name}
                      </div>
                      {selected && (
                        <Check className="absolute top-2 right-2 w-3.5 h-3.5 text-[#1e6ab0]" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium">
                Email address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="name@primemax.ae"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-medium">
                  Password
                </Label>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="h-10"
              />
            </div>

            {error && (
              <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-10 mt-2 bg-[#0f2d5a] hover:bg-[#1e6ab0] text-white font-medium"
              disabled={isLoggingIn}
            >
              {isLoggingIn ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </form>

          <div className="rounded-md border border-border bg-muted/40 p-3 text-[11px] text-muted-foreground">
            <span className="font-semibold text-foreground/80">Secure access</span> — All actions are
            recorded in the audit trail. Contact your administrator if you cannot sign in.
          </div>
        </div>
      </div>
    </div>
  );
}
