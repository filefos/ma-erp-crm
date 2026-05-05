import { useState, useRef, useEffect } from "react";
import { useListPaymentsMade, useCreatePaymentMade, useUpdatePaymentMade, useDeletePaymentMade, useListBankAccounts, useListSuppliers } from "@workspace/api-client-react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CompanyField } from "@/components/CompanyField";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Pencil, Trash2, ArrowUpCircle, BookOpen, Loader2, CheckCircle2, XCircle, ChevronDown, Building2 } from "lucide-react";
import { authHeaders } from "@/lib/ai-client";
import { ExportMenu } from "@/components/ExportMenu";
import { useQueryClient } from "@tanstack/react-query";
import { AccountsPageHeader, AccountsStat, AccountsStatStrip } from "@/components/accounts-page-header";

const BASE = import.meta.env.BASE_URL;
const PAYMENT_METHODS = ["cash", "bank_transfer", "cheque", "card", "online"];
const methodLabels: Record<string, string> = {
  cash: "Cash", bank_transfer: "Bank Transfer", cheque: "Cheque", card: "Card", online: "Online",
};

type LookupState = "idle" | "loading" | "found" | "not_found";

type FormData = {
  companyId: string; payeeName: string; expenseRef: string; paymentDate: string;
  amount: string; paymentMethod: string; bankAccountId: string;
  referenceNumber: string; notes: string; status: string;
  projectRef: string; projectId: string; expenseId: string;
};

const EMPTY: FormData = {
  companyId: "", payeeName: "", expenseRef: "",
  paymentDate: new Date().toISOString().split("T")[0],
  amount: "", paymentMethod: "bank_transfer", bankAccountId: "",
  referenceNumber: "", notes: "", status: "completed",
  projectRef: "", projectId: "", expenseId: "",
};

export function PaymentsMadeList() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY);
  const [pendingJournalId, setPendingJournalId] = useState<number | null>(null);

  // Expense ref lookup state
  const [lookupState, setLookupState] = useState<LookupState>("idle");
  const [lookupData, setLookupData] = useState<any>(null);
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Supplier typeahead state
  const [supplierQuery, setSupplierQuery] = useState("");
  const [supplierDropOpen, setSupplierDropOpen] = useState(false);
  const supplierRef = useRef<HTMLDivElement>(null);

  const handleJournal = async (paymentId: number) => {
    if (pendingJournalId) return;
    setPendingJournalId(paymentId);
    try {
      const res = await fetch(`${BASE}api/journal-entries/auto-from-source`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sourceType: "payment_made", sourceId: paymentId }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) toast({ title: "Draft journal created", description: `${(j as any).journalNumber} — review in Journal Entries.` });
      else toast({ title: (j as any).message ?? "Failed to create journal", variant: "destructive" });
    } catch { toast({ title: "Network error", variant: "destructive" }); }
    finally { setPendingJournalId(null); }
  };

  const { data: payments = [], isLoading } = useListPaymentsMade();
  const { data: bankAccounts = [] } = useListBankAccounts();
  const { data: allSuppliers = [] } = useListSuppliers({});
  const { filterByCompany } = useActiveCompany();

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/payments-made"] });
  const createMutation = useCreatePaymentMade({ mutation: { onSuccess: () => { invalidate(); setOpen(false); toast({ title: "Payment recorded." }); }, onError: (e: any) => toast({ title: e?.message ?? "Failed", variant: "destructive" }) } });
  const updateMutation = useUpdatePaymentMade({ mutation: { onSuccess: () => { invalidate(); setOpen(false); toast({ title: "Payment updated." }); }, onError: (e: any) => toast({ title: e?.message ?? "Failed", variant: "destructive" }) } });
  const deleteMutation = useDeletePaymentMade({ mutation: { onSuccess: () => { invalidate(); toast({ title: "Deleted." }); } } });

  const filtered = filterByCompany(payments).filter(p =>
    !search || p.payeeName.toLowerCase().includes(search.toLowerCase()) ||
    p.paymentNumber.toLowerCase().includes(search.toLowerCase()) ||
    (p.expenseRef ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const totalMade = filtered.reduce((s, p) => s + (p.amount ?? 0), 0);

  // Supplier dropdown filtered list
  const filteredSuppliers = allSuppliers.filter(s => {
    if (!supplierQuery) return true;
    const q = supplierQuery.toLowerCase();
    return s.name.toLowerCase().includes(q) || (s.code ?? "").toLowerCase().includes(q) || (s.email ?? "").toLowerCase().includes(q);
  }).slice(0, 8);

  const openCreate = () => {
    setEditId(null); setForm(EMPTY); setLookupState("idle"); setLookupData(null);
    setSupplierQuery(""); setOpen(true);
  };
  const openEdit = (p: any) => {
    setEditId(p.id);
    setForm({
      companyId: String(p.companyId), payeeName: p.payeeName,
      expenseRef: p.expenseRef ?? "", paymentDate: p.paymentDate,
      amount: String(p.amount), paymentMethod: p.paymentMethod,
      bankAccountId: String(p.bankAccountId ?? ""), referenceNumber: p.referenceNumber ?? "",
      notes: p.notes ?? "", status: p.status,
      projectRef: (p as any).projectRef ?? "", projectId: String((p as any).projectId ?? ""),
      expenseId: String((p as any).expenseId ?? ""),
    });
    setSupplierQuery(p.payeeName ?? "");
    setLookupState("idle"); setLookupData(null); setOpen(true);
  };

  const handleSave = () => {
    const payload = {
      ...form,
      companyId: parseInt(form.companyId, 10),
      amount: parseFloat(form.amount) || 0,
      bankAccountId: form.bankAccountId ? parseInt(form.bankAccountId, 10) : undefined,
      projectId: form.projectId ? parseInt(form.projectId, 10) : undefined,
      expenseId: form.expenseId ? parseInt(form.expenseId, 10) : undefined,
      projectRef: form.projectRef || undefined,
    };
    if (editId) updateMutation.mutate({ id: editId, data: payload as any });
    else createMutation.mutate({ data: payload as any });
  };

  const f = (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  // Expense ref auto-lookup
  const handleExpenseLookup = (val: string) => {
    setForm(p => ({ ...p, expenseRef: val }));
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    if (!val.trim()) { setLookupState("idle"); setLookupData(null); return; }
    setLookupState("loading");
    lookupTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`${BASE}api/expense-lookup?expenseNumber=${encodeURIComponent(val.trim())}`, {
          headers: authHeaders(), credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setLookupData(data);
          setLookupState("found");
          const payee = data.supplierName || form.payeeName;
          setSupplierQuery(payee);
          setForm(p => ({
            ...p,
            expenseRef: data.expenseNumber,
            payeeName: payee,
            companyId: data.companyId ? String(data.companyId) : p.companyId,
            amount: data.total != null ? String(data.total) : String(data.amount ?? p.amount),
            paymentMethod: data.paymentMethod || p.paymentMethod,
            projectRef: data.projectRef || p.projectRef,
            projectId: data.projectId ? String(data.projectId) : p.projectId,
            expenseId: String(data.id),
          }));
        } else {
          setLookupState("not_found"); setLookupData(null);
        }
      } catch { setLookupState("not_found"); setLookupData(null); }
    }, 600);
  };

  // Supplier typeahead select
  const selectSupplier = (s: any) => {
    setForm(p => ({
      ...p,
      payeeName: s.name,
      companyId: s.companyId ? String(s.companyId) : p.companyId,
    }));
    setSupplierQuery(s.name);
    setSupplierDropOpen(false);
  };

  // Close supplier dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (supplierRef.current && !supplierRef.current.contains(e.target as Node)) {
        setSupplierDropOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => () => { if (lookupTimer.current) clearTimeout(lookupTimer.current); }, []);

  return (
    <div className="space-y-4">
      <AccountsPageHeader
        title="Payable"
        subtitle="Track all outgoing payments to suppliers and vendors."
        right={
          <>
            <ExportMenu
              data={filtered}
              columns={[
                { header: "Payment No.", key: "paymentNumber" },
                { header: "Payee", key: "payeeName" },
                { header: "Expense Ref", key: "expenseRef" },
                { header: "Project Code", key: "projectRef" },
                { header: "Date", key: "paymentDate" },
                { header: "Amount (AED)", key: "amount", format: v => Number(v ?? 0).toFixed(2) },
                { header: "Method", key: "paymentMethod" },
                { header: "Reference", key: "referenceNumber" },
              ]}
              filename="payments-made"
              title="Payable"
              size="sm"
            />
            <Button className="bg-[#0f2d5a] hover:bg-[#1e6ab0]" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-2" />Record Payment
            </Button>
          </>
        }
      />

      <AccountsStatStrip>
        <AccountsStat label="Total Paid Out (Filtered)" tone="bad" value={`AED ${totalMade.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
        <AccountsStat label="Records" value={filtered.length} />
      </AccountsStatStrip>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by payee, expense ref, payment no..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project Code</TableHead>
              <TableHead>Payment No.</TableHead>
              <TableHead>Payee</TableHead>
              <TableHead>Expense Ref</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="text-right">Amount (AED)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-12">
                  <ArrowUpCircle className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-muted-foreground">No payments recorded yet.</p>
                </TableCell>
              </TableRow>
            ) : filtered.map(p => (
              <TableRow key={p.id} className="hover:bg-muted/40">
                <TableCell>
                  {(p as any).projectRef ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-[#0f2d5a] text-white tracking-wide whitespace-nowrap">
                      {(p as any).projectRef}
                    </span>
                  ) : <span className="text-muted-foreground text-xs">—</span>}
                </TableCell>
                <TableCell className="font-mono text-sm font-medium text-primary">{p.paymentNumber}</TableCell>
                <TableCell className="font-medium">{p.payeeName}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{p.expenseRef || "-"}</TableCell>
                <TableCell>{p.paymentDate}</TableCell>
                <TableCell className="text-sm">{methodLabels[p.paymentMethod] ?? p.paymentMethod}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{(p as any).referenceNumber || "-"}</TableCell>
                <TableCell className="text-right font-semibold text-red-700">AED {(p.amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="bg-red-100 text-red-800">{p.status}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 justify-end">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-[#0f2d5a] hover:text-[#1e6ab0]" title="Suggest Journal Entry" disabled={pendingJournalId === p.id} onClick={() => handleJournal(p.id)}><BookOpen className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => { if (confirm("Delete?")) deleteMutation.mutate({ id: p.id }); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Edit Payable" : "Record Payable"}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-1">

            {/* Expense / Bill Ref with auto-lookup */}
            <div className="space-y-1">
              <Label>Expense / Bill Ref <span className="text-muted-foreground font-normal text-xs">(type to auto-fill fields)</span></Label>
              <div className="relative">
                <Input
                  value={form.expenseRef}
                  onChange={e => handleExpenseLookup(e.target.value)}
                  placeholder="EXP-2026-00001"
                  className={lookupState === "found" ? "border-green-500 pr-8" : lookupState === "not_found" ? "border-red-400 pr-8" : "pr-8"}
                />
                <div className="absolute right-2.5 top-2.5">
                  {lookupState === "loading" && <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />}
                  {lookupState === "found" && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                  {lookupState === "not_found" && <XCircle className="w-4 h-4 text-red-400" />}
                </div>
              </div>
              {lookupState === "found" && lookupData && (
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {lookupData.supplierName && (
                    <span className="inline-flex items-center gap-1 text-xs bg-green-50 border border-green-200 text-green-800 rounded px-2 py-0.5">
                      <CheckCircle2 className="w-3 h-3" /> {lookupData.supplierName}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 text-xs bg-blue-50 border border-blue-200 text-blue-800 rounded px-2 py-0.5">
                    AED {Number(lookupData.total ?? lookupData.amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                  {lookupData.projectRef && (
                    <span className="inline-flex items-center gap-1 text-xs bg-[#0f2d5a]/8 border border-[#0f2d5a]/20 text-[#0f2d5a] rounded font-mono px-2 py-0.5">
                      {lookupData.projectRef}
                    </span>
                  )}
                  {lookupData.category && (
                    <span className="inline-flex items-center gap-1 text-xs bg-gray-50 border border-gray-200 text-gray-600 rounded px-2 py-0.5">
                      {lookupData.category}
                    </span>
                  )}
                </div>
              )}
              {lookupState === "not_found" && (
                <p className="text-xs text-red-500 mt-1">Expense not found — you can still fill in the fields manually.</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Company */}
              <div className="space-y-1 col-span-2">
                <Label>Company *</Label>
                <CompanyField value={form.companyId} onChange={v => setForm(p => ({ ...p, companyId: v }))} />
              </div>

              {/* Supplier / Payee — typeahead combobox */}
              <div className="space-y-1 col-span-2" ref={supplierRef}>
                <Label>Payee / Supplier *</Label>
                <div className="relative">
                  <Building2 className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    value={supplierQuery}
                    onChange={e => {
                      setSupplierQuery(e.target.value);
                      setForm(p => ({ ...p, payeeName: e.target.value }));
                      setSupplierDropOpen(true);
                    }}
                    onFocus={() => setSupplierDropOpen(true)}
                    placeholder="Type supplier name or select from list…"
                    className="pl-8 pr-7"
                  />
                  <ChevronDown className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />

                  {/* Dropdown */}
                  {supplierDropOpen && filteredSuppliers.length > 0 && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                      {filteredSuppliers.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-blue-50 text-left transition-colors border-b border-gray-50 last:border-0"
                          onMouseDown={e => { e.preventDefault(); selectSupplier(s); }}
                        >
                          <div className="w-7 h-7 rounded-full bg-[#0f2d5a]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Building2 className="w-3.5 h-3.5 text-[#0f2d5a]" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">{s.name}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {s.code && <span className="text-[10px] font-mono text-[#1e6ab0]">{s.code}</span>}
                              {s.category && <span className="text-[10px] text-gray-400">{s.category}</span>}
                              {(s as any).email && <span className="text-[10px] text-gray-400 truncate">{(s as any).email}</span>}
                            </div>
                          </div>
                        </button>
                      ))}
                      {allSuppliers.filter(s => {
                        if (!supplierQuery) return true;
                        const q = supplierQuery.toLowerCase();
                        return s.name.toLowerCase().includes(q) || (s.code ?? "").toLowerCase().includes(q);
                      }).length > 8 && (
                        <div className="px-3 py-2 text-xs text-muted-foreground text-center border-t">
                          Keep typing to narrow results…
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Project Code — shown when fetched */}
              {form.projectRef && (
                <div className="col-span-2">
                  <div className="flex items-center gap-2 bg-[#0f2d5a]/5 border border-[#0f2d5a]/20 rounded-lg px-3 py-2">
                    <span className="text-[10px] uppercase tracking-wider text-[#0f2d5a]/70 font-medium">Project Code</span>
                    <span className="font-mono font-bold text-[#0f2d5a] text-sm ml-auto">{form.projectRef}</span>
                  </div>
                </div>
              )}

              <div className="space-y-1"><Label>Payment Date *</Label><Input type="date" value={form.paymentDate} onChange={f("paymentDate")} /></div>
              <div className="space-y-1">
                <Label>Amount (AED) *</Label>
                <Input type="number" value={form.amount} onChange={f("amount")} placeholder="0.00" />
              </div>

              <div className="space-y-1 col-span-2">
                <Label>Payment Method *</Label>
                <Select value={form.paymentMethod} onValueChange={v => setForm(p => ({ ...p, paymentMethod: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{methodLabels[m]}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <div className="space-y-1 col-span-2">
                <Label>Bank Account</Label>
                <Select value={form.bankAccountId || "__none__"} onValueChange={v => setForm(p => ({ ...p, bankAccountId: v === "__none__" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Select bank account" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— None —</SelectItem>
                    {bankAccounts.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.bankName} — {b.accountNumber}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1 col-span-2"><Label>Reference / Transaction No.</Label><Input value={form.referenceNumber} onChange={f("referenceNumber")} placeholder="TXN / cheque number" /></div>
              <div className="space-y-1 col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={f("notes")} rows={2} /></div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              className="bg-[#0f2d5a] hover:bg-[#1e6ab0]"
              onClick={handleSave}
              disabled={!form.companyId || !form.payeeName || !form.amount || !form.paymentDate || createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending ? "Saving..." : editId ? "Update" : "Save Payment"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
