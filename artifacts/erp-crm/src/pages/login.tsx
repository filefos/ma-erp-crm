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

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [otpStep, setOtpStep] = useState<OtpStep>("email");
  const [otpEmail, setOtpEmail] = useState("");
  const [otpCompanyId, setOtpCompanyId] = useState<number | null>(null);
  const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""]);
  const [maskedPhone, setMaskedPhone] = useState<string | null>(null);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [sentVia, setSentVia] = useState<{ whatsapp: boolean; email: boolean }>({ whatsapp: false, email: false });
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
      setSentVia(data.sentVia ?? { whatsapp: false, email: false });
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

  /* ── Brand tokens — reactive to selected company ── */
  const activeCompanyForMode = mode === "password" ? companyId : otpCompanyId;
  const isEliteLogin = activeCompanyForMode === 2;

  const lBrand = isEliteLogin
    ? {
        panelBg:    "#0D0D0D",
        radialA:    "radial-gradient(circle at 20% 20%, #8B0000 0%, transparent 55%), radial-gradient(circle at 80% 80%, #5E0000 0%, transparent 50%)",
        primary:    "#8B0000",
        primaryHov: "#C00000",
        logoSrc:    "/elite-prefab-logo.png",
        logoAlt:    "Elite Pre-Fabricated Houses",
        tagline:    "Premium prefab ERP — built for Elite Pre-Fabricated Houses Trading Co. LLC.",
        poweredBy:  "ELITE ERP SYSTEMS",
        textCls:    "text-[#8B0000]",
        borderCls:  "border-[#8B0000]",
        bg5Cls:     "bg-[#8B0000]/5",
        ringCls:    "ring-[#8B0000]/30",
        focusCls:   "focus:ring-[#8B0000]/30 focus:border-[#8B0000]",
        filledCls:  "border-[#8B0000] bg-[#8B0000]/5 text-[#5E0000]",
        tabActiveCls: "text-white shadow-sm",
      }
    : {
        panelBg:    "#0f2d5a",
        radialA:    "radial-gradient(circle at 20% 20%, #1e6ab0 0%, transparent 50%), radial-gradient(circle at 80% 80%, #38bdf8 0%, transparent 45%)",
        primary:    "#0f2d5a",
        primaryHov: "#1e6ab0",
        logoSrc:    "/prime-max-logo.png",
        logoAlt:    "Prime Max Prefab Houses",
        tagline:    "Multi-company sales, accounts, procurement, inventory, projects and HR — powered by PRIME ERP SYSTEMS.",
        poweredBy:  "PRIME ERP SYSTEMS",
        textCls:    "text-[#1e6ab0]",
        borderCls:  "border-[#1e6ab0]",
        bg5Cls:     "bg-[#1e6ab0]/5",
        ringCls:    "ring-[#1e6ab0]/30",
        focusCls:   "focus:ring-[#1e6ab0]/30 focus:border-[#1e6ab0]",
        filledCls:  "border-[#1e6ab0] bg-[#1e6ab0]/5 text-[#0f2d5a]",
        tabActiveCls: "text-white shadow-sm",
      };

  const CompanySelector = ({ value, onChange }: { value: number | null; onChange: (id: number) => void }) =>
    companies && companies.length > 0 ? (
      <div className="space-y-2" data-testid="company-selector">
        <Label className="text-xs font-medium text-white/60">Company workspace</Label>
        <div className="grid grid-cols-2 gap-2">
          {companies.map((c) => {
            const selected = value === c.id;
            const isThisElite = c.id === 2;
            const selBorder  = isThisElite ? "border-[#8B0000]" : "border-[#1e6ab0]";
            const selBg5     = isThisElite ? "bg-[#8B0000]/5"   : "bg-[#1e6ab0]/5";
            const selRing    = isThisElite ? "ring-[#8B0000]/30" : "ring-[#1e6ab0]/30";
            const selText    = isThisElite ? "text-[#8B0000]"   : "text-[#1e6ab0]";
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
                    ? `${selBorder} ${selBg5} ring-2 ${selRing}`
                    : "border-white/10 hover:border-white/25 hover:bg-white/5"
                }`}
              >
                <div className={`text-[10px] font-mono tracking-widest uppercase ${selected ? selText : "text-white/40"}`}>{c.prefix}</div>
                <div className="text-xs font-semibold mt-1 leading-tight truncate text-white/80">{c.shortName ?? c.name}</div>
                {selected && <Check className={`absolute top-2 right-2 w-3.5 h-3.5 ${selText}`} />}
              </button>
            );
          })}
        </div>
      </div>
    ) : null;

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-background">

      {/* LEFT — branding panel */}
      <div
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden text-white transition-colors duration-500"
        style={{ background: lBrand.panelBg }}
      >
        <div
          className="absolute inset-0 opacity-30 transition-all duration-500"
          style={{ background: lBrand.radialA }}
        />
        {/* accent hairline at top for Elite */}
        {isEliteLogin && (
          <div className="absolute top-0 inset-x-0 h-0.5" style={{ background: "linear-gradient(90deg, #8B0000, #C00000, #5E0000)" }} />
        )}
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div className="flex items-center">
            {/* PRIME wordmark — left dark panel */}
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0"
                style={{ background: isEliteLogin ? "linear-gradient(135deg,#8B0000,#C00000)" : "linear-gradient(135deg,#1e6ab0,#38bdf8)" }}
              >
                <span className="text-white font-black text-lg tracking-tight select-none">P</span>
              </div>
              <div>
                <div className="font-black text-2xl tracking-[0.35em] uppercase text-white leading-none">PRIME</div>
                <div className="text-[8px] font-bold tracking-[0.22em] uppercase text-white/45 leading-none mt-1">ERP SYSTEMS</div>
              </div>
            </div>
          </div>
          <div className="space-y-6 max-w-md">
            <h1 className="text-4xl font-bold leading-tight tracking-tight">
              {isEliteLogin
                ? "Precision-built ERP for premium prefab construction."
                : "Run two companies from one secure platform."}
            </h1>
            <p className="text-white/70 text-sm leading-relaxed">{lBrand.tagline}</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/50">
            <Shield className="w-3.5 h-3.5" />
            Enterprise-grade audit logging · Role-based access control
          </div>
        </div>
      </div>

      {/* RIGHT — form panel */}
      <div
        className="flex-1 flex items-center justify-center p-6 lg:p-12 relative overflow-hidden"
        style={{ background: "linear-gradient(145deg,#0D0D0D 0%,#1C0000 45%,#0D0D0D 100%)" }}
      >
        {/* subtle radial glow */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at 70% 30%,rgba(139,0,0,0.18) 0%,transparent 60%)" }} />
        {/* top accent line */}
        <div className="absolute top-0 inset-x-0 h-px" style={{ background: "linear-gradient(90deg,transparent,#8B0000,#C00000,#8B0000,transparent)" }} />

        <div className="relative z-10 w-full max-w-sm space-y-6">
          {/* Mobile PRIME wordmark */}
          <div className="lg:hidden flex items-center gap-3 mb-4">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: isEliteLogin ? "linear-gradient(135deg,#8B0000,#C00000)" : "linear-gradient(135deg,#1e6ab0,#38bdf8)" }}
            >
              <span className="text-white font-black text-sm select-none">P</span>
            </div>
            <div>
              <div className="font-black text-xl tracking-[0.35em] uppercase text-white leading-none">PRIME</div>
              <div className="text-[7px] font-bold tracking-[0.2em] uppercase text-white/40 leading-none mt-0.5">ERP SYSTEMS</div>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-white">Welcome back</h2>
            <p className="text-sm text-white/50">Sign in to your ERP workspace.</p>
          </div>

          {/* Mode tabs */}
          <div className="flex rounded-lg border border-white/10 overflow-hidden bg-white/5">
            <button
              type="button"
              onClick={() => switchMode("password")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-all ${
                mode === "password"
                  ? lBrand.tabActiveCls
                  : "text-white/40 hover:text-white hover:bg-white/8"
              }`}
              style={mode === "password" ? { background: lBrand.primary } : {}}
            >
              <KeyRound className="w-3.5 h-3.5" />
              Password
            </button>
            <button
              type="button"
              onClick={() => switchMode("otp")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-all ${
                mode === "otp"
                  ? lBrand.tabActiveCls
                  : "text-white/40 hover:text-white hover:bg-white/8"
              }`}
              style={mode === "otp" ? { background: lBrand.primary } : {}}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              OTP Login
            </button>
          </div>

          {/* ── PASSWORD LOGIN ── */}
          {mode === "password" && (
            <>
              <CompanySelector value={companyId} onChange={setCompanyId} />
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-medium text-white/60">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@company.ae"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="h-10 bg-white/5 border-white/15 text-white placeholder:text-white/25 focus:border-white/40 focus:bg-white/8"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs font-medium text-white/60">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="h-10 bg-white/5 border-white/15 text-white placeholder:text-white/25 focus:border-white/40 focus:bg-white/8"
                  />
                </div>
                {error && (
                  <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                    {error}
                  </div>
                )}
                <Button
                  type="submit"
                  className="w-full h-10 mt-2 text-white font-medium transition-colors"
                  style={{ background: lBrand.primary }}
                  onMouseOver={e => (e.currentTarget.style.background = lBrand.primaryHov)}
                  onMouseOut={e => (e.currentTarget.style.background = lBrand.primary)}
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
                      <Label htmlFor="otp-email" className="text-xs font-medium text-white/60">Email address</Label>
                      <Input
                        id="otp-email"
                        type="email"
                        placeholder="name@company.ae"
                        value={otpEmail}
                        onChange={(e) => { setOtpEmail(e.target.value); setOtpError(null); }}
                        required
                        autoComplete="email"
                        className="h-10 bg-white/5 border-white/15 text-white placeholder:text-white/25 focus:border-white/40 focus:bg-white/8"
                      />
                    </div>
                    {otpError && (
                      <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                        {otpError}
                      </div>
                    )}
                    <Button
                      type="submit"
                      className="w-full h-10 text-white font-medium transition-colors"
                      style={{ background: lBrand.primary }}
                      onMouseOver={e => (e.currentTarget.style.background = lBrand.primaryHov)}
                      onMouseOut={e => (e.currentTarget.style.background = lBrand.primary)}
                      disabled={otpSending || !otpEmail}
                    >
                      {otpSending ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending OTP...</>
                      ) : (
                        <><MessageCircle className="w-4 h-4 mr-2" />Send OTP</>
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
                    className="flex items-center gap-1 text-xs text-white/40 hover:text-white transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Back
                  </button>

                  <div className="rounded-lg bg-green-900/30 border border-green-500/30 p-4 text-sm text-green-300 space-y-2">
                    <p className="font-semibold text-green-200">OTP code sent!</p>
                    <div className="space-y-1">
                      {sentVia.whatsapp && maskedPhone && (
                        <p className="text-xs text-green-300 flex items-center gap-1.5">
                          <span className="text-green-400">✓</span>
                          WhatsApp → <span className="font-mono font-semibold">{maskedPhone}</span>
                        </p>
                      )}
                      {sentVia.email && (
                        <p className="text-xs text-green-300 flex items-center gap-1.5">
                          <span className="text-green-400">✓</span>
                          Email → <span className="font-mono font-semibold">{otpEmail}</span>
                        </p>
                      )}
                      {!sentVia.whatsapp && !sentVia.email && (
                        <p className="text-xs text-amber-300">Check with your administrator — delivery not configured yet.</p>
                      )}
                    </div>
                    <p className="text-xs text-green-400/80">Enter the 6-digit code below. Expires in 5 minutes.</p>
                  </div>

                  {/* 6-digit OTP boxes */}
                  <div className="space-y-3">
                    <Label className="text-xs font-medium text-white/60">Enter 6-digit OTP</Label>
                    <div className="flex gap-2 justify-center" onPaste={handleOtpPaste}>
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
                          className={`w-11 h-14 text-center text-xl font-bold border-2 rounded-lg outline-none transition-all ${lBrand.focusCls} focus:ring-2 ${
                            digit ? lBrand.filledCls : "border-white/15 bg-white/5 text-white"
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
                    className="w-full h-10 text-white font-medium transition-colors"
                    style={{ background: lBrand.primary }}
                    onMouseOver={e => (e.currentTarget.style.background = lBrand.primaryHov)}
                    onMouseOut={e => (e.currentTarget.style.background = lBrand.primary)}
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
                      <p className="text-xs text-white/40">
                        Resend available in <span className="font-mono font-semibold text-white/60">{resendCountdown}s</span>
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={handleRequestOtp}
                        disabled={otpSending}
                        className={`text-xs font-medium hover:underline disabled:opacity-50 ${lBrand.textCls}`}
                      >
                        {otpSending ? "Sending..." : "Resend OTP"}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* unused otpSent ref suppressor */}
          {otpSent && null}

          <div className="rounded-md border border-white/10 bg-white/5 p-3 text-[11px] text-white/40">
            <span className="font-semibold text-white/60">Secure access</span> — All actions are
            recorded in the audit trail. Contact your administrator if you cannot sign in.
          </div>

          <div className="text-center text-xs text-white/30 border-t border-white/10 pt-3">
            Are you a vendor?{" "}
            <a href="/supplier-register" className="font-medium hover:underline text-white/60 hover:text-white transition-colors">
              Become a supplier →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
