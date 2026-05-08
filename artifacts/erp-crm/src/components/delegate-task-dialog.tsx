import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ClipboardList, Search, X, Link2 } from "lucide-react";
import { useListUsers, useListCompanies, useListLeads } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const TASK_TYPES = [
  { value: "quotation",        label: "Quotation" },
  { value: "proforma_invoice", label: "Proforma Invoice" },
  { value: "tax_invoice",      label: "Tax Invoice" },
  { value: "delivery_note",    label: "Delivery Note" },
  { value: "lpo",              label: "Local Purchase Order" },
  { value: "custom",           label: "Custom Task" },
];

const DURATIONS = [
  { value: "5",  label: "5 minutes" },
  { value: "10", label: "10 minutes" },
  { value: "15", label: "15 minutes" },
  { value: "30", label: "30 minutes" },
  { value: "60", label: "1 hour" },
];

interface DelegateTaskDialogProps {
  open: boolean;
  onClose: () => void;
  defaultLeadId?: number;
  defaultLeadName?: string;
  defaultUserId?: number;
}

const BASE = import.meta.env.BASE_URL ?? "/";

export function DelegateTaskDialog({ open, onClose, defaultLeadId, defaultLeadName, defaultUserId }: DelegateTaskDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: users = [] } = useListUsers();
  const { data: companies = [] } = useListCompanies();
  const { data: allLeads = [] } = useListLeads();

  const [grantedToUserId, setGrantedToUserId] = useState(defaultUserId ? String(defaultUserId) : "");
  const [taskType, setTaskType] = useState("quotation");
  const [taskLabel, setTaskLabel] = useState(defaultLeadName ? `Create ${TASK_TYPES[0].label} for ${defaultLeadName}` : "");
  const [durationMinutes, setDurationMinutes] = useState("15");
  const [companyId, setCompanyId] = useState(String((user as any)?.companyId ?? companies[0]?.id ?? ""));
  const [submitting, setSubmitting] = useState(false);

  // Lead picker state
  const [leadSearch, setLeadSearch] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(defaultLeadId ?? null);
  const [selectedLeadName, setSelectedLeadName] = useState(defaultLeadName ?? "");
  const [leadPickerOpen, setLeadPickerOpen] = useState(false);

  const otherUsers = (users as any[]).filter((u: any) => u.id !== (user as any)?.id && u.isActive !== false);

  const filteredLeads = useMemo(() => {
    const q = leadSearch.toLowerCase().trim();
    if (!q) return (allLeads as any[]).slice(0, 30);
    return (allLeads as any[]).filter((l: any) =>
      l.leadName?.toLowerCase().includes(q) ||
      l.companyName?.toLowerCase().includes(q) ||
      l.requirementType?.toLowerCase().includes(q) ||
      l.leadNumber?.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [allLeads, leadSearch]);

  function selectLead(lead: any) {
    setSelectedLeadId(lead.id);
    setSelectedLeadName(lead.leadName);
    setLeadPickerOpen(false);
    setLeadSearch("");
    // Auto-fill label using the lead name (not company name — to preserve privacy)
    const typLabel = TASK_TYPES.find(t => t.value === taskType)?.label ?? taskType;
    setTaskLabel(`Create ${typLabel} for ${lead.leadName}${lead.requirementType ? ` (${lead.requirementType})` : ""}`);
  }

  function clearLead() {
    setSelectedLeadId(null);
    setSelectedLeadName("");
    setLeadSearch("");
    setLeadPickerOpen(false);
  }

  async function handleSubmit() {
    if (!grantedToUserId || !taskType || !taskLabel || !durationMinutes || !companyId) {
      toast({ title: "All fields required", variant: "destructive" }); return;
    }
    setSubmitting(true);
    try {
      const token = localStorage.getItem("erp_token");
      const res = await fetch(`${BASE}api/delegated-tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          companyId: parseInt(companyId, 10),
          grantedToUserId: parseInt(grantedToUserId, 10),
          taskType,
          taskLabel,
          leadId: selectedLeadId ?? null,
          durationMinutes: parseInt(durationMinutes, 10),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to create task");
      }
      const recipientName = otherUsers.find((u: any) => String(u.id) === grantedToUserId)?.name ?? "user";
      toast({ title: `Task delegated to ${recipientName}`, description: `${taskLabel} — ${durationMinutes} min window` });
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-orange-500" />
            Delegate Task
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Company */}
          {companies.length > 1 && (
            <div className="flex flex-col gap-1.5">
              <Label>Company</Label>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
                <SelectContent>
                  {(companies as any[]).map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Assign to */}
          <div className="flex flex-col gap-1.5">
            <Label>Assign to</Label>
            <Select value={grantedToUserId} onValueChange={setGrantedToUserId}>
              <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
              <SelectContent>
                {otherUsers.map((u: any) => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {u.name} <span className="text-muted-foreground">· {u.role}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Lead link */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
                Link Lead <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              {selectedLeadId && (
                <button onClick={clearLead} className="text-[11px] text-muted-foreground hover:text-destructive flex items-center gap-1">
                  <X className="w-3 h-3" /> Remove
                </button>
              )}
            </div>

            {selectedLeadId ? (
              /* Selected lead chip */
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer hover:bg-muted/50"
                style={{ borderColor: "#0078d4", background: "#f0f6ff" }}
                onClick={() => setLeadPickerOpen(true)}
              >
                <Link2 className="w-3.5 h-3.5 shrink-0" style={{ color: "#0078d4" }} />
                <span className="font-medium" style={{ color: "#0078d4" }}>{selectedLeadName}</span>
                <span className="text-muted-foreground text-xs ml-auto">#{selectedLeadId}</span>
              </div>
            ) : (
              /* Search trigger */
              <button
                type="button"
                className="flex items-center gap-2 w-full px-3 py-2 rounded-lg border text-sm text-muted-foreground hover:bg-muted/40 transition-colors text-left"
                onClick={() => setLeadPickerOpen(v => !v)}
              >
                <Search className="w-3.5 h-3.5 shrink-0" />
                Search lead to attach…
              </button>
            )}

            {/* Lead search dropdown */}
            {leadPickerOpen && (
              <div className="rounded-lg border shadow-lg overflow-hidden" style={{ background: "#fff" }}>
                <div className="flex items-center gap-2 px-3 py-2 border-b">
                  <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <input
                    autoFocus
                    className="flex-1 text-sm outline-none bg-transparent"
                    placeholder="Type lead name, company, or requirement…"
                    value={leadSearch}
                    onChange={e => setLeadSearch(e.target.value)}
                  />
                  {leadSearch && (
                    <button onClick={() => setLeadSearch("")} className="text-muted-foreground hover:text-foreground">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {filteredLeads.length === 0 ? (
                    <div className="px-3 py-3 text-sm text-muted-foreground text-center">No leads found</div>
                  ) : filteredLeads.map((lead: any) => (
                    <button
                      key={lead.id}
                      type="button"
                      className="w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors border-b last:border-0"
                      onClick={() => selectLead(lead)}
                    >
                      <div className="text-sm font-medium leading-tight">{lead.leadName}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                        {lead.requirementType && <span>{lead.requirementType}</span>}
                        {lead.location && <span>· {lead.location}</span>}
                        {lead.budget && <span>· AED {Number(lead.budget).toLocaleString()}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedLeadId && (
              <p className="text-[11px] text-muted-foreground">
                The salesperson will see project details for this lead but <strong>not</strong> the contact name, phone, email, or company name.
              </p>
            )}
          </div>

          {/* Task type */}
          <div className="flex flex-col gap-1.5">
            <Label>Task type</Label>
            <Select value={taskType} onValueChange={v => {
              setTaskType(v);
              const typLabel = TASK_TYPES.find(t => t.value === v)?.label ?? v;
              const lbl = selectedLeadName || defaultLeadName;
              setTaskLabel(lbl ? `Create ${typLabel} for ${lbl}` : `Create ${typLabel}`);
            }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TASK_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Task label */}
          <div className="flex flex-col gap-1.5">
            <Label>Task description</Label>
            <Input
              value={taskLabel}
              onChange={e => setTaskLabel(e.target.value)}
              placeholder="e.g. Create quotation for Al Hamra project"
            />
          </div>

          {/* Duration */}
          <div className="flex flex-col gap-1.5">
            <Label>Time limit</Label>
            <Select value={durationMinutes} onValueChange={setDurationMinutes}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DURATIONS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting} className="bg-orange-600 hover:bg-orange-700">
            {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Delegating…</> : "Delegate Task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
