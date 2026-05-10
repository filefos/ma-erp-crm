import { useState, useRef, useEffect } from "react";
import { useListPaymentsReceived, useCreatePaymentReceived, useUpdatePaymentReceived, useDeletePaymentReceived, useListCompanies, useListBankAccounts } from "@workspace/api-client-react";
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
import { Plus, Search, Pencil, Trash2, ArrowDownCircle, BookOpen, Loader2, CheckCircle2, XCircle, Paperclip, FileIcon, X, Download } from "lucide-react";
import { authHeaders } from "@/lib/ai-client";
import { ExportMenu } from "@/components/ExportMenu";
import { useQueryClient } from "@tanstack/react-query";
import { AccountsPageHeader, AccountsStat, AccountsStatStrip } from "@/components/accounts-page-header";

const BASE = import.meta.env.BASE_URL;
const MAX_MB = 20;
const PAYMENT_METHODS = ["cash", "bank_transfer", "cheque", "card", "online"];
const methodLabels: Record<string, string> = {
  cash: "Cash", bank_transfer: "Bank Transfer", cheque: "Cheque", card: "Card", online: "Online",
};

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

type AttachmentMeta = { filename: string; contentType: string; size: number; content?: string };

type FormData = {
  companyId: string; customerName: string; invoiceRef: string; paymentDate: string;
  amount: string; paymentMethod: string; bankAccountId: string; referenceNumber: string;
  notes: string; status: string; projectRef: string; projectId: string; taxInvoiceId: string;
};

const EMPTY: FormData = {
  companyId: "", customerName: "", invoiceRef: "",
  paymentDate: new Date().toISOString().split("T")[0],
  amount: "", paymentMethod: "bank_transfer", bankAccountId: "",
  referenceNumber: "", notes: "", status: "completed",
  projectRef: "", projectId: "", taxInvoiceId: "",
};

type LookupState = "idle" | "loading" | "found" | "not_found";

export function PaymentsReceivedList() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY);
  const [attachments, setAttachments] = useState<AttachmentMeta[]>([]);
  const [lookupState, setLookupState] = useState<LookupState>("idle");
  const [lookupData, setLookupData] = useState<any>(null);
  const [pendingJournalId, setPendingJournalId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleJournal = async (paymentId: number) => {
    if (pendingJournalId) return;
    setPendingJournalId(paymentId);
    try {
      const res = await fetch(`${BASE}api/journal-entries/auto-from-source`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sourceType: "payment_received", sourceId: paymentId }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        toast({ title: "Draft journal created", description: `${(j as any).journalNumber} — review in Journal Entries.` });
      } else {
        toast({ title: (j as any).message ?? "Failed to create journal", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setPendingJournalId(null);
    }
  };

  const { data: payments = [], isLoading } = useListPaymentsReceived();
  const { data: companies = [] } = useListCompanies();
  const { data: bankAccounts = [] } = useListBankAccounts();
  const { filterByCompany, activeCompanyId } = useActiveCompany();
  const isElite = activeCompanyId === 2;
  const primeBtnCls = isElite ? "bg-[#0D0D0D] hover:bg-[#8B0000]" : "bg-[#0f2d5a] hover:bg-[#1e6ab0]";

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/payments-received"] });
  const createMutation = useCreatePaymentReceived({ mutation: { onSuccess: () => { invalidate(); setOpen(false); toast({ title: "Receivable recorded." }); }, onError: (e: any) => toast({ title: e?.message ?? "Failed", variant: "destructive" }) } });
  const updateMutation = useUpdatePaymentReceived({ mutation: { onSuccess: () => { invalidate(); setOpen(false); toast({ title: "Receivable updated." }); }, onError: (e: any) => toast({ title: e?.message ?? "Failed", variant: "destructive" }) } });
  const deleteMutation = useDeletePaymentReceived({ mutation: { onSuccess: () => { invalidate(); toast({ title: "Receivable deleted." }); } } });

  const filtered = filterByCompany(payments).filter(p =>
    !search || p.customerName.toLowerCase().includes(search.toLowerCase()) ||
    p.paymentNumber.toLowerCase().includes(search.toLowerCase()) ||
    (p.invoiceRef ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const totalReceived = filtered.reduce((s, p) => s + (p.amount ?? 0), 0);

  const openCreate = () => {
    setEditId(null); setForm(EMPTY); setAttachments([]);
    setLookupState("idle"); setLookupData(null); setOpen(true);
  };
  const openEdit = (p: any) => {
    setEditId(p.id);
    setForm({
      companyId: String(p.companyId), customerName: p.customerName,
      invoiceRef: p.invoiceRef ?? "", paymentDate: p.paymentDate,
      amount: String(p.amount), paymentMethod: p.paymentMethod,
      bankAccountId: String(p.bankAccountId ?? ""), referenceNumber: p.referenceNumber ?? "",
      notes: p.notes ?? "", status: p.status,
      projectRef: p.projectRef ?? "", projectId: String(p.projectId ?? ""),
      taxInvoiceId: String(p.taxInvoiceId ?? ""),
    });
    setAttachments(parseAttachments(p.attachments));
    setLookupState("idle"); setLookupData(null); setOpen(true);
  };

  const parseAttachments = (raw: any): AttachmentMeta[] => {
    if (!raw) return [];
    try { return typeof raw === "string" ? JSON.parse(raw) : raw; } catch { return []; }
  };

  const handleSave = () => {
    const payload = {
      ...form,
      companyId: parseInt(form.companyId, 10),
      amount: parseFloat(form.amount) || 0,
      bankAccountId: form.bankAccountId ? parseInt(form.bankAccountId, 10) : undefined,
      projectId: form.projectId ? parseInt(form.projectId, 10) : undefined,
      taxInvoiceId: form.taxInvoiceId ? parseInt(form.taxInvoiceId, 10) : undefined,
      projectRef: form.projectRef || undefined,
      attachments: JSON.stringify(attachments),
    };
    if (editId) updateMutation.mutate({ id: editId, data: payload as any });
    else createMutation.mutate({ data: payload as any });
  };

  const f = (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  const handleInvoiceLookup = (invoiceNumber: string) => {
    setForm(p => ({ ...p, invoiceRef: invoiceNumber }));
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    if (!invoiceNumber.trim()) { setLookupState("idle"); setLookupData(null); return; }
    setLookupState("loading");
    lookupTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`${BASE}api/invoice-lookup?invoiceNumber=${encodeURIComponent(invoiceNumber.trim())}`, {
          headers: authHeaders(), credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setLookupData(data);
          setLookupState("found");
          setForm(p => ({
            ...p,
            invoiceRef: data.invoiceNumber,
            customerName: data.clientName || p.customerName,
            companyId: data.companyId ? String(data.companyId) : p.companyId,
            amount: data.balance != null && data.balance > 0
              ? String(data.balance)
              : data.grandTotal != null ? String(data.grandTotal) : p.amount,
            projectRef: data.projectRef || p.projectRef,
            projectId: data.projectId ? String(data.projectId) : p.projectId,
            taxInvoiceId: String(data.id),
          }));
        } else {
          setLookupState("not_found");
          setLookupData(null);
        }
      } catch {
        setLookupState("not_found");
        setLookupData(null);
      }
    }, 600);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const newAtts: AttachmentMeta[] = [];
    for (const file of files) {
      if (file.size > MAX_MB * 1024 * 1024) {
        toast({ title: `${file.name} exceeds ${MAX_MB}MB limit.`, variant: "destructive" });
        continue;
      }
      const base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve((r.result as string).split(",")[1]);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      newAtts.push({ filename: file.name, content: base64, contentType: file.type || "application/octet-stream", size: file.size });
    }
    setAttachments(p => [...p, ...newAtts]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  useEffect(() => () => { if (lookupTimer.current) clearTimeout(lookupTimer.current); }, []);

  return (
    <div className="space-y-4">
      <AccountsPageHeader
        title="Receivable"
        subtitle="Record payments collected from customers."
        right={
          <>
            <ExportMenu
              data={filtered}
              columns={[
                { header: "Payment No.", key: "paymentNumber" },
                { header: "Customer", key: "customerName" },
                { header: "Invoice Ref", key: "invoiceRef" },
                { header: "Project Code", key: "projectRef" },
                { header: "Date", key: "paymentDate" },
                { header: "Amount (AED)", key: "amount", format: v => Number(v ?? 0).toFixed(2) },
                { header: "Method", key: "paymentMethod" },
                { header: "Reference", key: "referenceNumber" },
              ]}
              filename="payments-received"
              title="Receivable"
              size="sm"
            />
            <Button className={primeBtnCls} onClick={openCreate}>
              <Plus className="w-4 h-4 mr-2" />Record Receivable
            </Button>
          </>
        }
      />

      <AccountsStatStrip>
        <AccountsStat label="Total Received (Filtered)" tone="good" value={`AED ${totalReceived.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
        <AccountsStat label="Records" value={filtered.length} />
      </AccountsStatStrip>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by customer, invoice, payment no..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project Code</TableHead>
              <TableHead>Payment No.</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Invoice Ref</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="text-right">Amount (AED)</TableHead>
              <TableHead>Docs</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-12">
                  <ArrowDownCircle className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-muted-foreground">No payments received yet.</p>
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
                <TableCell className="font-medium">{p.customerName}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{p.invoiceRef || "-"}</TableCell>
                <TableCell>{p.paymentDate}</TableCell>
                <TableCell className="text-sm">{methodLabels[p.paymentMethod] ?? p.paymentMethod}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{(p as any).referenceNumber || "-"}</TableCell>
                <TableCell className="text-right font-semibold text-green-700">AED {(p.amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                <TableCell>
                  {parseAttachments((p as any).attachments).length > 0 ? (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Paperclip className="w-3.5 h-3.5" />
                      <span className="text-xs">{parseAttachments((p as any).attachments).length}</span>
                    </div>
                  ) : <span className="text-muted-foreground text-xs">—</span>}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">{p.status}</Badge>
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

      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setAttachments([]); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Edit Receivable" : "Record Receivable"}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-1">

            {/* Invoice number with auto-lookup */}
            <div className="space-y-1">
              <Label>Invoice Number <span className="text-muted-foreground font-normal text-xs">(type to auto-fill fields)</span></Label>
              <div className="relative">
                <Input
                  value={form.invoiceRef}
                  onChange={e => handleInvoiceLookup(e.target.value)}
                  placeholder="e.g. PM-INV-2026-00001"
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
                  <span className="inline-flex items-center gap-1 text-xs bg-green-50 border border-green-200 text-green-800 rounded px-2 py-0.5">
                    <CheckCircle2 className="w-3 h-3" /> {lookupData.clientName}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs bg-blue-50 border border-blue-200 text-blue-800 rounded px-2 py-0.5">
                    AED {Number(lookupData.balance ?? lookupData.grandTotal ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} outstanding
                  </span>
                  {lookupData.projectRef && (
                    <span className="inline-flex items-center gap-1 text-xs bg-[#0f2d5a]/8 border border-[#0f2d5a]/20 text-[#0f2d5a] rounded font-mono px-2 py-0.5">
                      {lookupData.projectRef}
                    </span>
                  )}
                </div>
              )}
              {lookupState === "not_found" && (
                <p className="text-xs text-red-500 mt-1">Invoice not found — you can still fill in the fields manually.</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Company — auto-filled or manual */}
              <div className="space-y-1 col-span-2">
                <Label>Company *</Label>
                <CompanyField value={form.companyId} onChange={v => setForm(p => ({ ...p, companyId: v }))} />
              </div>

              {/* Customer Name — auto-filled or manual */}
              <div className="space-y-1 col-span-2">
                <Label>Customer Name *</Label>
                <Input value={form.customerName} onChange={f("customerName")} placeholder="Customer / company name" />
              </div>

              {/* Project Code — editable, auto-filled from invoice lookup */}
              <div className="space-y-1 col-span-2">
                <Label>Project Code</Label>
                <Input
                  value={form.projectRef}
                  onChange={f("projectRef")}
                  placeholder="e.g. PM-PRJ-2026-0001 (auto-filled from invoice)"
                  className={form.projectRef ? "font-mono font-semibold border-[#0f2d5a]/40 bg-[#0f2d5a]/5" : ""}
                />
              </div>

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

            {/* Attachments */}
            <div className="space-y-2 pt-1 border-t">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Attachments</Label>
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-xs text-[#1e6ab0] hover:text-[#0f2d5a] font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip className="w-3.5 h-3.5" /> Attach File
                </button>
                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
              </div>
              {attachments.length === 0 ? (
                <p className="text-xs text-muted-foreground py-1">No attachments. Click "Attach File" to add documents (receipts, bank slips, etc.).</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {attachments.map((att, i) => (
                    <div key={i} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg pl-2.5 pr-1.5 py-1.5">
                      <FileIcon className="w-3.5 h-3.5 text-[#1e6ab0] flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-gray-700 truncate max-w-[130px]">{att.filename}</div>
                        <div className="text-[10px] text-gray-400">{formatBytes(att.size)}</div>
                      </div>
                      <button
                        className="ml-1 p-0.5 rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-600"
                        onClick={() => setAttachments(p => p.filter((_, idx) => idx !== i))}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">Max {MAX_MB}MB per file. Stored securely on server.</p>
            </div>

          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              className={primeBtnCls}
              onClick={handleSave}
              disabled={!form.companyId || !form.customerName || !form.amount || !form.paymentDate || createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending ? "Saving..." : editId ? "Update" : "Save Payment"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Attachment detail viewer (for table rows with attachments) */}
      {filtered.some(p => parseAttachments((p as any).attachments).length > 0) && (
        <AttachmentViewer payments={filtered} parseAttachments={parseAttachments} />
      )}
    </div>
  );
}

function AttachmentViewer({ payments, parseAttachments }: { payments: any[]; parseAttachments: (raw: any) => AttachmentMeta[] }) {
  const [viewId, setViewId] = useState<number | null>(null);
  const selected = payments.find(p => p.id === viewId);
  const atts = selected ? parseAttachments(selected.attachments) : [];

  if (!payments.some(p => parseAttachments(p.attachments).length > 0)) return null;

  return (
    <>
      {payments.filter(p => parseAttachments(p.attachments).length > 0).map(p => (
        <div key={p.id} style={{ display: "none" }} data-attachment-trigger={p.id} />
      ))}
      <Dialog open={viewId !== null} onOpenChange={v => { if (!v) setViewId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Attachments — {selected?.paymentNumber}</DialogTitle></DialogHeader>
          <div className="flex flex-wrap gap-2 py-2">
            {atts.map((att, i) => (
              <a
                key={i}
                href={att.content ? `data:${att.contentType};base64,${att.content}` : "#"}
                download={att.filename}
                className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 hover:bg-blue-50 hover:border-[#1e6ab0] transition-colors group"
              >
                <FileIcon className="w-4 h-4 text-[#1e6ab0]" />
                <div className="min-w-0">
                  <div className="text-xs font-medium text-gray-800 truncate max-w-[150px]">{att.filename}</div>
                  <div className="text-[10px] text-gray-400">{formatBytes(att.size ?? 0)}</div>
                </div>
                <Download className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#1e6ab0] ml-1" />
              </a>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
