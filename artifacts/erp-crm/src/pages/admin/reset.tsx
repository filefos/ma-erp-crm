import { useState } from "react";
import { useListUsers } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, Loader2, RotateCcw, KeyRound, UserCog, ShieldAlert,
  Lock, Unlock,
} from "lucide-react";

const FACTORY_PHRASE = "FACTORY RESET";

function authHeaders(): Record<string, string> {
  const t = localStorage.getItem("erp_token");
  return {
    "Content-Type": "application/json",
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  };
}

// ---------- FACTORY RESET ----------
function FactoryResetSection() {
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  async function run() {
    if (phrase.trim() !== FACTORY_PHRASE) return;
    setBusy(true);
    try {
      const r = await fetch("/api/admin/factory-reset", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ confirm: FACTORY_PHRASE }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${r.status}`);
      toast({ title: "Factory reset complete", description: "Signing you out…" });
      qc.clear();
      setTimeout(() => {
        localStorage.removeItem("erp_token");
        localStorage.removeItem("erp_active_company_id");
        window.location.href = "/login";
      }, 1500);
    } catch (e) {
      toast({
        title: "Factory reset failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
      setBusy(false);
    }
  }

  return (
    <>
      <Card className="border-red-300 bg-red-50/40 dark:bg-red-950/20 dark:border-red-900">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-red-700 dark:text-red-400">
            <AlertTriangle className="w-4 h-4" />Factory Reset
            <Badge variant="destructive" className="ml-auto text-[10px]">DESTRUCTIVE</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Wipe <strong>ALL</strong> data — companies, users, leads, deals, quotations, invoices,
            inventory, HR records, audit logs — and restore the demo dataset. Cannot be undone.
          </p>
          <Button
            variant="destructive" size="sm"
            onClick={() => { setPhrase(""); setOpen(true); }}
            data-testid="btn-factory-reset"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />Run Factory Reset
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(v) => { if (!busy) setOpen(v); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertTriangle className="w-5 h-5" />Confirm Factory Reset
            </DialogTitle>
            <DialogDescription>
              This will permanently delete every record and restore the demo data. You will be
              logged out — sign back in with{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">admin@erp.com</code> /{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">Admin@2026</code>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="confirm-phrase" className="text-sm">
              Type <strong>{FACTORY_PHRASE}</strong> to confirm:
            </Label>
            <Input
              id="confirm-phrase"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder={FACTORY_PHRASE}
              autoComplete="off"
              disabled={busy}
              data-testid="input-confirm-reset"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={run}
              disabled={busy || phrase.trim() !== FACTORY_PHRASE}
              data-testid="btn-confirm-reset"
            >
              {busy
                ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Resetting…</>
                : "Reset everything"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------- USER ACCOUNT RESET ----------
function UserResetSection() {
  const { data: users } = useListUsers();
  const { user: me } = useAuth();
  const [userId, setUserId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [tempPassword, setTempPassword] = useState("Reset@2026");
  const [resultPassword, setResultPassword] = useState<string | null>(null);
  const { toast } = useToast();

  const target = users?.find(u => String(u.id) === userId);

  async function run() {
    if (!userId) return;
    setBusy(true);
    setResultPassword(null);
    try {
      const r = await fetch(`/api/admin/users/${userId}/reset-account`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ tempPassword }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${r.status}`);
      setResultPassword((data as { tempPassword: string }).tempPassword);
      toast({
        title: "User account reset",
        description: `${target?.email} has been reset. Share the new password with them.`,
      });
    } catch (e) {
      toast({
        title: "Reset failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card className="border-orange-300 bg-orange-50/40 dark:bg-orange-950/20 dark:border-orange-900">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-orange-700 dark:text-orange-400">
            <UserCog className="w-4 h-4" />User Account Reset
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Reset a user's password to a temporary one, reactivate the account, and clear all of
            their notifications. Use this when a user is locked out or their account is misconfigured.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">User</Label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger data-testid="select-user-reset">
                  <SelectValue placeholder="Select user…" />
                </SelectTrigger>
                <SelectContent>
                  {(users ?? [])
                    .filter(u => u.id !== me?.id)
                    .map(u => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.name} — {u.email}
                        {u.permissionLevel === "super_admin" ? " (super admin)" : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Temporary password (min 8 chars)</Label>
              <Input
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                placeholder="Reset@2026"
                data-testid="input-temp-password"
              />
            </div>
          </div>
          <Button
            variant="default"
            size="sm"
            disabled={!userId || tempPassword.length < 8}
            onClick={() => setOpen(true)}
            data-testid="btn-open-user-reset"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />Reset User Account
          </Button>
          {resultPassword && (
            <div className="rounded-md border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 p-3 text-sm">
              <div className="font-medium text-emerald-800 dark:text-emerald-300">
                ✓ Reset complete. Share this password securely:
              </div>
              <code className="block mt-1 font-mono text-base bg-white dark:bg-black/30 px-2 py-1 rounded">
                {resultPassword}
              </code>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(v) => { if (!busy) setOpen(v); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
              <ShieldAlert className="w-5 h-5" />Confirm User Reset
            </DialogTitle>
            <DialogDescription>
              Reset <strong>{target?.name}</strong> ({target?.email})? Their password will be
              changed to <code className="text-xs bg-muted px-1 py-0.5 rounded">{tempPassword}</code>,
              their account reactivated, and their notifications cleared.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button
              onClick={async () => { await run(); setOpen(false); }}
              disabled={busy}
              data-testid="btn-confirm-user-reset"
            >
              {busy
                ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Resetting…</>
                : "Confirm reset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------- USER PASSWORD CHANGE ----------
function UserPasswordSection() {
  const { data: users } = useListUsers();
  const { user: me } = useAuth();
  const [userId, setUserId] = useState<string>("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const target = users?.find(u => String(u.id) === userId);
  const canSubmit = userId && pw.length >= 8 && pw === pw2;

  async function run() {
    if (!canSubmit) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/users/${userId}/change-password`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ newPassword: pw }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((data as { error?: string; message?: string }).message
        ?? (data as { error?: string }).error ?? `HTTP ${r.status}`);
      toast({
        title: "Password updated",
        description: `New password set for ${target?.email}.`,
      });
      setPw(""); setPw2("");
    } catch (e) {
      toast({
        title: "Password change failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <KeyRound className="w-4 h-4" />User Password Change
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Set a specific new password for any user (other than yourself or another super admin).
          Useful when a user wants to choose a new password and you're updating it for them.
        </p>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">User</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger data-testid="select-user-pw">
                <SelectValue placeholder="Select user…" />
              </SelectTrigger>
              <SelectContent>
                {(users ?? [])
                  .filter(u => u.id !== me?.id)
                  .map(u => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.name} — {u.email}
                      {u.permissionLevel === "super_admin" ? " (super admin)" : ""}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">New password (min 8)</Label>
            <Input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              data-testid="input-new-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Confirm new password</Label>
            <Input
              type="password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              data-testid="input-confirm-password"
            />
          </div>
        </div>
        {pw && pw2 && pw !== pw2 && (
          <p className="text-xs text-red-600">Passwords don't match.</p>
        )}
        <Button
          size="sm"
          onClick={run}
          disabled={!canSubmit || busy}
          data-testid="btn-change-password"
        >
          {busy
            ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Updating…</>
            : <><KeyRound className="w-3.5 h-3.5 mr-1.5" />Change Password</>}
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------- FREEZE / UNFREEZE ----------
function FreezeSection() {
  const { data: users, refetch } = useListUsers();
  const { user: me } = useAuth();
  const [userId, setUserId] = useState<string>("");
  const [busy, setBusy] = useState<"freeze" | "unfreeze" | null>(null);
  const { toast } = useToast();

  const target = users?.find(u => String(u.id) === userId);
  const isCurrentlyFrozen = target?.isActive === false || target?.status === "inactive";

  async function run(frozen: boolean) {
    if (!userId) return;
    setBusy(frozen ? "freeze" : "unfreeze");
    try {
      const r = await fetch(`/api/admin/users/${userId}/freeze`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ frozen }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${r.status}`);
      toast({
        title: frozen ? "User frozen" : "User unfrozen",
        description: `${target?.email} ${frozen ? "can no longer sign in" : "can sign in again"}.`,
      });
      await refetch();
    } catch (e) {
      toast({
        title: "Action failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="border-slate-300 bg-slate-50/40 dark:bg-slate-950/20 dark:border-slate-700">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Lock className="w-4 h-4" />Freeze / Unfreeze User
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Immediately block a user from signing in (freeze) or restore access (unfreeze).
          Their data and history are preserved — only login is disabled.
        </p>
        <div className="space-y-1.5">
          <Label className="text-xs">User</Label>
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger data-testid="select-user-freeze">
              <SelectValue placeholder="Select user…" />
            </SelectTrigger>
            <SelectContent>
              {(users ?? [])
                .filter(u => u.id !== me?.id)
                .map(u => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {u.name} — {u.email}
                    {u.permissionLevel === "super_admin" ? " (super admin)" : ""}
                    {(u.isActive === false || u.status === "inactive") ? " — FROZEN" : ""}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        {target && (
          <div className="text-xs text-muted-foreground">
            Status: <strong>{isCurrentlyFrozen ? "Frozen (cannot sign in)" : "Active"}</strong>
          </div>
        )}
        <div className="flex gap-2">
          <Button
            variant="destructive"
            size="sm"
            disabled={!userId || isCurrentlyFrozen || !!busy}
            onClick={() => run(true)}
            data-testid="btn-freeze-user"
          >
            {busy === "freeze"
              ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Freezing…</>
              : <><Lock className="w-3.5 h-3.5 mr-1.5" />Freeze User</>}
          </Button>
          <Button
            variant="default"
            size="sm"
            disabled={!userId || !isCurrentlyFrozen || !!busy}
            onClick={() => run(false)}
            data-testid="btn-unfreeze-user"
          >
            {busy === "unfreeze"
              ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Unfreezing…</>
              : <><Unlock className="w-3.5 h-3.5 mr-1.5" />Unfreeze User</>}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- PAGE ----------
export function AdminResetCenter() {
  const { user } = useAuth();
  if (user?.permissionLevel !== "super_admin") {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          The Reset Center is restricted to super administrators.
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reset Center</h1>
        <p className="text-muted-foreground text-sm">
          Factory reset, user account reset, and user password change — super admin tools.
        </p>
      </div>
      <UserPasswordSection />
      <FreezeSection />
      <UserResetSection />
      <FactoryResetSection />
    </div>
  );
}
