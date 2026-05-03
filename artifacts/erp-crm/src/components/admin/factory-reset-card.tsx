import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const CONFIRM_PHRASE = "FACTORY RESET";

export function FactoryResetCard() {
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  async function runReset() {
    if (phrase.trim() !== CONFIRM_PHRASE) return;
    setBusy(true);
    try {
      const token = localStorage.getItem("erp_token");
      const r = await fetch("/api/admin/factory-reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ confirm: CONFIRM_PHRASE }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error((data as { error?: string }).error ?? `HTTP ${r.status}`);
      }
      toast({
        title: "Factory reset complete",
        description: "All data wiped and demo seed restored. Signing you out…",
      });
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
            <AlertTriangle className="w-4 h-4" />
            Danger Zone — Factory Reset
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Wipe <strong>ALL</strong> data — companies, users (except the admin), leads, deals,
            quotations, invoices, projects, inventory, HR records, audit logs — and restore the
            fresh demo dataset. This action <strong>cannot be undone</strong>.
          </p>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => { setPhrase(""); setOpen(true); }}
            data-testid="btn-factory-reset"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            Factory Reset
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(v) => { if (!busy) setOpen(v); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertTriangle className="w-5 h-5" />
              Confirm Factory Reset
            </DialogTitle>
            <DialogDescription>
              This will permanently delete every record in the database and restore the original
              demo data. You will be logged out and must sign back in with{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">admin@erp.com</code> /{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">Admin@2026</code>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="confirm-phrase" className="text-sm">
              Type <strong>{CONFIRM_PHRASE}</strong> to confirm:
            </Label>
            <Input
              id="confirm-phrase"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder={CONFIRM_PHRASE}
              autoComplete="off"
              disabled={busy}
              data-testid="input-confirm-reset"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={runReset}
              disabled={busy || phrase.trim() !== CONFIRM_PHRASE}
              data-testid="btn-confirm-reset"
            >
              {busy ? (
                <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Resetting…</>
              ) : (
                <>Reset everything</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
