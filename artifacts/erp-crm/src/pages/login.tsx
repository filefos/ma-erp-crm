import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect, useRef } from "react";
import { Shield, ArrowRight, Loader2, Check, MessageCircle, KeyRound, ChevronLeft } from "lucide-react";
import { useListAuthCompanies } from "@workspace/api-client-react";

type LoginMode = "password" | "otp";
type OtpStep = "email" | "code";

export function Login() {
  const { login, isLoggingIn } = useAuth();
  const { data: companies } = useListAuthCompanies();
  const [mode, setMode] = useState<LoginMode>("password");

  // password mode
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // otp mode
  const [otpStep, setOtpStep] = useState<OtpStep>("email");
  const [otpEmail, setOtpEmail] = useState("");
  const [otpCompanyId, setOtpCompanyId] = useState<number | null>(null);
  const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""]);
  const [maskedPhone, setMaskedPhone] = useState<string | null>(null);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const digitRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (companies && companies.length && companyId === null) {
      setCompanyId(companies[0].id);
      setOtpCompanyId(companies[0].id);
    }
  }, [companies, companyId]);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const t = setTimeout(() => setResendCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCountdown]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
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

  const handleRequestOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!otpEmail) return;
    setOtpError(null);
    setOtpSending(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/auth/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: otpEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOtpError(data.error ?? "Failed to send OTP. Try again.");
        return;
      }
      setMaskedPhone(data.maskedPhone ?? null);
      setOtpCode(["", "", "", "", "", ""]);
      setOtpStep("code");
      setOtpSent(true);
      setResendCountdown(60);
      setTimeout(() => digitRefs.current[0]?.focus(), 100);
    } catch {
      setOtpError("Network error. Please try again.");
    } finally {
      setOtpSending(false);
    }
  };

  const handleOtpDigit = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...otpCode];
    next[index] = digit;
    setOtpCode(next);
    setOtpError(null);
    if (digit && index < 5) {
      digitRefs.current[index + 1]?.focus();
    }
    if (next.every(d => d !== "") && digit) {
      handleVerifyOtp(next.join(""));
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpCode[index] && index > 0) {
      digitRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setOtpCode(pasted.split(""));
      setOtpError(null);
      handleVerifyOtp(pasted);
    }
  };

  const handleVerifyOtp = async (code?: string) => {
    const finalCode = code ?? otpCode.join("");
    if (finalCode.length < 6) return;
    setOtpError(null);
    setOtpVerifying(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: otpEmail, otp: finalCode, companyId: otpCompanyId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOtpError(data.error ?? "Invalid OTP. Please try again.");
        setOtpCode(["", "", "", "", "", ""]);
        setTimeout(() => digitRefs.current[0]?.focus(), 50);
        return;
      }
      // Reuse the auth hook's internals via login mutation result
      localStorage.setItem("erp_token", data.token);
      window.location.reload();
    } catch {
      setOtpError("Network error. Please try again.");
    } finally {
      setOtpVerifying(false);
    }
  };

  const switchMode = (m: LoginMode) => {
    setMode(m);
    setError(null);
    setOtpError(null);
    setOtpStep("email");
    setOtpCode(["", "", "", "", "", ""]);
    setOtpSent(false);
  };

  const CompanySelector = ({ value, onChange }: { value: number | null; onChange: (id: number) => void }) =>
    companies && companies.length > 0 ? (
      <div className="space-y-2" data-testid="company-selector">
        <Label className="text-xs font-medium">Company workspace</Label>
        <div className="grid grid-cols-2 gap-2">
          {companies.map((c) => {
            const selected = value === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onChange(c.id)}
                data-testid={`company-option-${c.id}`}
                data-selected={selected ? "true" : "false"}
                aria-pressed={selected}
                className={`relative text-left rounded-lg border p-3 transition-all ${
                  selected
                    ? "border-[#1e6ab0] bg-[#1e6ab0]/5 ring-2 ring-[#1e6ab0]/30"
                    : "border-border hover:border-[#1e6ab0]/50 hover:bg-muted/40"
                }`}
              >
                <div className="text-[10px] font-mono text-[#1e6ab0] tracking-widest uppercase">{c.prefix}</div>
                <div className="text-xs font-semibold mt-1 leading-tight truncate">{c.shortName ?? c.name}</div>
                {selected && <Check className="absolute top-2 right-2 w-3.5 h-3.5 text-[#1e6ab0]" />}
              </button>
            );
          })}
        </div>
      </div>
    ) : null;

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
            <div className="bg-white/15 rounded-2xl px-6 py-4 backdrop-blur ring-1 ring-white/20">
              <div className="text-3xl font-extrabold tracking-widest text-white leading-none">Prime</div>
            </div>
          </div>
          <div className="space-y-6 max-w-md">
            <h1 className="text-4xl font-bold leading-tight tracking-tight">
              Run two companies from one secure platform.
            </h1>
            <p className="text-white/70 text-sm leading-relaxed">
              Multi-company sales, accounts, procurement, inventory, projects and HR — powered by PRIME ERP SYSTEMS.
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
            <img src="/prime-max-logo.png" alt="PRIME ERP SYSTEMS" className="h-10 w-auto object-contain" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">Welcome back</h2>
            <p className="text-sm text-muted-foreground">Sign in to your ERP workspace.</p>
          </div>

          {/* Mode tabs */}
          <div className="flex rounded-lg border border-border overflow-hidden bg-muted/30">
            <button
              type="button"
              onClick={() => switchMode("password")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-all ${
                mode === "password"
                  ? "bg-[#0f2d5a] text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              Password
            </button>
            <button
              type="button"
              onClick={() => switchMode("otp")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-all ${
                mode === "otp"
                  ? "bg-[#0f2d5a] text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              OTP via SMS
            </button>
          </div>

          {/* ── PASSWORD LOGIN ── */}
          {mode === "password" && (
            <>
              <CompanySelector value={companyId} onChange={setCompanyId} />
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-medium">Email address</Label>
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
                  <Label htmlFor="password" className="text-xs font-medium">Password</Label>
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
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Signing in...</>
                  ) : (
                    <>Sign In<ArrowRight className="w-4 h-4 ml-2" /></>
                  )}
                </Button>
              </form>
            </>
          )}

          {/* ── OTP LOGIN ── */}
          {mode === "otp" && (
            <div className="space-y-5">
              {/* Step 1 — email */}
              {otpStep === "email" && (
                <>
                  <CompanySelector value={otpCompanyId} onChange={setOtpCompanyId} />
                  <form onSubmit={handleRequestOtp} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="otp-email" className="text-xs font-medium">Email address</Label>
                      <Input
                        id="otp-email"
                        type="email"
                        placeholder="name@primemax.ae"
                        value={otpEmail}
                        onChange={(e) => { setOtpEmail(e.target.value); setOtpError(null); }}
                        required
                        autoComplete="email"
                        className="h-10"
                      />
                    </div>
                    {otpError && (
                      <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                        {otpError}
                      </div>
                    )}
                    <Button
                      type="submit"
                      className="w-full h-10 bg-[#0f2d5a] hover:bg-[#1e6ab0] text-white font-medium"
                      disabled={otpSending || !otpEmail}
                    >
                      {otpSending ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending OTP...</>
                      ) : (
                        <><MessageCircle className="w-4 h-4 mr-2" />Send OTP via SMS</>  
                      )}
                    </Button>
                  </form>
                </>
              )}

              {/* Step 2 — enter code */}
              {otpStep === "code" && (
                <div className="space-y-5">
                  <button
                    type="button"
                    onClick={() => { setOtpStep("email"); setOtpError(null); setOtpCode(["","","","","",""]); }}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Back
                  </button>

                  <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm text-green-800 space-y-1">
                    <p className="font-semibold">OTP sent via SMS</p>
                    {maskedPhone && (
                      <p className="text-xs text-green-700">
                        A 6-digit code was sent to <span className="font-mono font-semibold">{maskedPhone}</span>
                      </p>
                    )}
                    <p className="text-xs text-green-600">Enter the code below. It expires in 5 minutes.</p>
                  </div>

                  {/* 6-digit OTP boxes */}
                  <div className="space-y-3">
                    <Label className="text-xs font-medium">Enter 6-digit OTP</Label>
                    <div
                      className="flex gap-2 justify-center"
                      onPaste={handleOtpPaste}
                    >
                      {otpCode.map((digit, i) => (
                        <input
                          key={i}
                          ref={el => { digitRefs.current[i] = el; }}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={e => handleOtpDigit(i, e.target.value)}
                          onKeyDown={e => handleOtpKeyDown(i, e)}
                          className={`w-11 h-14 text-center text-xl font-bold border-2 rounded-lg outline-none transition-all focus:ring-2 focus:ring-[#1e6ab0]/30 focus:border-[#1e6ab0] ${
                            digit ? "border-[#1e6ab0] bg-[#1e6ab0]/5 text-[#0f2d5a]" : "border-border bg-background text-foreground"
                          } ${otpVerifying ? "opacity-60 pointer-events-none" : ""}`}
                          disabled={otpVerifying}
                        />
                      ))}
                    </div>
                  </div>

                  {otpError && (
                    <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                      {otpError}
                    </div>
                  )}

                  <Button
                    type="button"
                    className="w-full h-10 bg-[#0f2d5a] hover:bg-[#1e6ab0] text-white font-medium"
                    onClick={() => handleVerifyOtp()}
                    disabled={otpVerifying || otpCode.some(d => !d)}
                  >
                    {otpVerifying ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying...</>
                    ) : (
                      <>Verify & Sign In<ArrowRight className="w-4 h-4 ml-2" /></>
                    )}
                  </Button>

                  <div className="text-center">
                    {resendCountdown > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Resend available in <span className="font-mono font-semibold">{resendCountdown}s</span>
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={handleRequestOtp}
                        disabled={otpSending}
                        className="text-xs text-[#1e6ab0] hover:underline font-medium disabled:opacity-50"
                      >
                        {otpSending ? "Sending..." : "Resend OTP"}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="rounded-md border border-border bg-muted/40 p-3 text-[11px] text-muted-foreground">
            <span className="font-semibold text-foreground/80">Secure access</span> — All actions are
            recorded in the audit trail. Contact your administrator if you cannot sign in.
          </div>

          <div className="text-center text-xs text-muted-foreground border-t pt-3">
            Are you a vendor?{" "}
            <a href="/supplier-register" className="text-[#1e6ab0] font-medium hover:underline">
              Become a supplier →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
