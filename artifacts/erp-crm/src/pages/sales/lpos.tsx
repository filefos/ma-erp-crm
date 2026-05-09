import { useState, useRef, useEffect } from "react";
import {
  useListLpos, useCreateLpo, useUpdateLpo, useListCompanies, useListQuotations,
} from "@workspace/api-client-react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { useAuth } from "@/hooks/useAuth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Search, Plus, Pencil, Paperclip, FileIcon, X, Download,
  Building2, Calendar, DollarSign, FileText, ClipboardList, Sparkles, Upload, Link2, Printer, Loader2 as Loader2Icon,
} from "lucide-react";
import { ExportMenu } from "@/components/ExportMenu";
import { useQueryClient } from "@tanstack/react-query";
import { extractLpoFields, authHeaders } from "@/lib/ai-client";
import { HelpButton } from "@/components/help-button";
import { captureElementToPdfBase64 } from "@/lib/print-to-pdf";
import { SignatureStampPreview } from "@/components/signature-stamp-preview";
import { canSignDocuments } from "@/lib/permissions";

const BASE = import.meta.env.BASE_URL;
const MAX_MB = 20;

interface AttachmentMeta { filename: string; contentType: string; size: number; content?: string }

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function statusBadge(s: string) {
  const map: Record<string, string> = {
    active: "bg-green-100 text-green-800",
    closed: "bg-gray-100 text-gray-700",
    cancelled: "bg-red-100 text-red-700",
  };
  return map[s] ?? "bg-blue-100 text-blue-700";
}

type LpoForm = {
  clientName: string; lpoNumber: string; lpoDate: string; lpoValue: string;
  paymentTerms: string; projectRef: string; scope: string; deliverySchedule: string;
  notes: string; status: string; companyId: string;
  quotationId: string;
};

const EMPTY_FORM: LpoForm = {
  clientName: "", lpoNumber: "", lpoDate: "", lpoValue: "",
  paymentTerms: "", projectRef: "", scope: "",
  deliverySchedule: "", notes: "", status: "active", companyId: "",
  quotationId: "",
};

// ── Quotation Picker ─────────────────────────────────────────────────────────
function QuotationPicker({
  quotations,
  value,
  onChange,
}: {
  quotations: any[];
  value: string;
  onChange: (id: string, q: any | null) => void;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const selected = quotations.find(q => String(q.id) === value) ?? null;

  const filtered = quotations.filter(q =>
    !search ||
    (q.quotationNumber ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (q.clientName ?? "").toLowerCase().includes(search.toLowerCase())
  ).slice(0, 10);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (selected) {
    return (
      <div className="flex items-center gap-2 border border-blue-200 rounded-md px-3 py-2 bg-blue-50/60">
        <Link2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-mono text-sm font-bold text-blue-900">{selected.quotationNumber}</div>
          <div className="text-xs text-blue-700 truncate">{selected.clientName}</div>
        </div>
        <button
          type="button"
          onClick={() => { onChange("", null); setSearch(""); }}
          className="p-0.5 rounded hover:bg-blue-200 text-blue-500"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative">
      <Input
        value={search}
        onChange={e => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Search quotation number or client name…"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-52 overflow-y-auto">
          {filtered.map(q => (
            <button
              key={q.id}
              type="button"
              className="w-full text-left px-3 py-2.5 hover:bg-blue-50 border-b border-gray-50 last:border-0 transition-colors"
              onClick={() => { onChange(String(q.id), q); setOpen(false); }}
            >
              <div className="font-mono text-sm font-bold text-[#0f2d5a]">{q.quotationNumber}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {q.clientName}
                {q.grandTotal ? ` · AED ${Number(q.grandTotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : ""}
                {q.paymentTerms ? ` · ${q.paymentTerms}` : ""}
              </div>
            </button>
          ))}
        </div>
      )}
      {open && search && filtered.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-sm px-3 py-3 text-sm text-muted-foreground">
          No quotations found for "{search}"
        </div>
      )}
    </div>
  );
}

export function LposList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<LpoForm>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<LpoForm>(EMPTY_FORM);
  const [attachments, setAttachments] = useState<AttachmentMeta[]>([]);
  const [editAttachments, setEditAttachments] = useState<AttachmentMeta[]>([]);
  const [aiExtracting, setAiExtracting] = useState(false);
  const aiInputRef = useRef<HTMLInputElement | null>(null);

  const { data: lpos = [], isLoading } = useListLpos();
  const { data: companies = [] } = useListCompanies();
  const { data: quotations = [] } = useListQuotations();
  const { filterByCompany } = useActiveCompany();
  const { user } = useAuth();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/lpos"] });

  const createMutation = useCreateLpo({
    mutation: {
      onSuccess: (resp: any) => {
        invalidate();
        setCreateOpen(false);
        setForm(EMPTY_FORM);
        setAttachments([]);
        const auto = resp?.autoCreated;
        if (auto?.project) {
          toast({
            title: "LPO registered — Project code allocated",
            description: `Project ${auto.project.projectNumber} created and linked to this LPO.`,
          });
          queryClient.invalidateQueries({ queryKey: ["/projects"] });
        } else {
          toast({ title: "LPO registered." });
        }
        if (auto?.proformaInvoice || auto?.taxInvoice) {
          const parts: string[] = [];
          if (auto.proformaInvoice) parts.push(`Proforma ${auto.proformaInvoice.piNumber}`);
          if (auto.taxInvoice) parts.push(`Tax Invoice ${auto.taxInvoice.invoiceNumber}`);
          toast({
            title: "Draft invoices auto-created",
            description: parts.join(" + ") + " — review them in Accounts.",
          });
          queryClient.invalidateQueries({ queryKey: ["/proforma-invoices"] });
          queryClient.invalidateQueries({ queryKey: ["/tax-invoices"] });
        }
      },
      onError: (e: any) => toast({ title: e?.message ?? "Failed", variant: "destructive" }),
    },
  });

  const updateMutation = useUpdateLpo({
    mutation: {
      onSuccess: (data) => {
        invalidate();
        setEditMode(false);
        const updated = data as any;
        setEditAttachments((updated.attachments ?? []) as AttachmentMeta[]);
        toast({ title: "LPO updated." });
      },
      onError: (e: any) => toast({ title: e?.message ?? "Failed", variant: "destructive" }),
    },
  });

  const filtered = filterByCompany(lpos).filter(l =>
    !search ||
    l.lpoNumber.toLowerCase().includes(search.toLowerCase()) ||
    l.clientName.toLowerCase().includes(search.toLowerCase()) ||
    ((l as any).projectRef ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const totalValue = filtered.reduce((s, l) => s + (l.lpoValue ?? 0), 0);
  const selectedLpo = lpos.find(l => l.id === detailId);

  // Lookup: quotationId → quotationNumber for display in the list
  const quotationById = new Map<number, any>(quotations.map((q: any) => [q.id, q]));

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
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
    if (isEdit) setEditAttachments(p => [...p, ...newAtts]);
    else setAttachments(p => [...p, ...newAtts]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const openDetail = (id: number) => {
    const lpo = lpos.find(l => l.id === id);
    if (!lpo) return;
    setDetailId(id);
    setEditMode(false);
    setEditForm({
      clientName: lpo.clientName ?? "",
      lpoNumber: lpo.lpoNumber ?? "",
      lpoDate: (lpo as any).lpoDate ?? "",
      lpoValue: String(lpo.lpoValue ?? ""),
      paymentTerms: (lpo as any).paymentTerms ?? "",
      projectRef: (lpo as any).projectRef ?? "",
      scope: (lpo as any).scope ?? "",
      deliverySchedule: (lpo as any).deliverySchedule ?? "",
      notes: (lpo as any).notes ?? "",
      status: lpo.status ?? "active",
      companyId: String(lpo.companyId),
      quotationId: String((lpo as any).quotationId ?? ""),
    });
    setEditAttachments(((lpo as any).attachments ?? []) as AttachmentMeta[]);
  };

  const handleAiExtract = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (aiInputRef.current) aiInputRef.current.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Use an image (JPG/PNG/WEBP). For PDFs, screenshot the page.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast({ title: `${file.name} exceeds ${MAX_MB}MB.`, variant: "destructive" });
      return;
    }
    setAiExtracting(true);
    try {
      const fileBase64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve((r.result as string).split(",")[1]);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const json = await extractLpoFields(fileBase64, file.type);
      const x = json.extracted ?? {};
      const srcAtt: AttachmentMeta = { filename: file.name, content: fileBase64, contentType: file.type, size: file.size };
      setAttachments(p => [...p, srcAtt]);
      setForm(p => ({
        ...p,
        clientName: x.clientName || p.clientName,
        lpoNumber: x.lpoNumber || p.lpoNumber,
        lpoDate: x.lpoDate || p.lpoDate,
        lpoValue: x.lpoValue != null && x.lpoValue !== "" ? String(x.lpoValue) : p.lpoValue,
        projectRef: x.projectRef || p.projectRef,
        // AI extracted paymentTerms are only applied if no quotation is linked
        paymentTerms: p.quotationId ? p.paymentTerms : (x.paymentTerms || p.paymentTerms),
        scope: x.scope || p.scope,
        deliverySchedule: x.deliverySchedule || p.deliverySchedule,
        notes: x.notes || p.notes,
      }));
      toast({ title: "Fields extracted — please review before saving." });
    } catch (err: any) {
      toast({ title: err?.message ?? "AI extract failed", variant: "destructive" });
    } finally {
      setAiExtracting(false);
    }
  };

  const handleCreate = () => {
    createMutation.mutate({
      data: {
        ...form,
        lpoValue: parseFloat(form.lpoValue) || 0,
        companyId: parseInt(form.companyId, 10),
        quotationId: form.quotationId ? parseInt(form.quotationId, 10) : undefined,
        attachments: attachments as any,
      } as any,
    });
  };

  const handleUpdate = () => {
    if (!detailId) return;
    updateMutation.mutate({
      id: detailId,
      data: {
        ...editForm,
        lpoValue: parseFloat(editForm.lpoValue) || 0,
        companyId: parseInt(editForm.companyId, 10),
        quotationId: editForm.quotationId ? parseInt(editForm.quotationId, 10) : undefined,
        attachments: editAttachments as any,
      } as any,
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Local Purchase Orders (LPO)</h1>
          <p className="text-muted-foreground">LPOs received from clients for confirmed orders.</p>
        </div>
        <div className="flex items-center gap-3">
          <HelpButton pageKey="lpos" />
          <ExportMenu
            data={(lpos ?? [])}
            columns={[
              { header: "LPO Number", key: "lpoNumber" },
              { header: "Client", key: "clientName" },
              { header: "Project Code", key: "projectRef" },
              { header: "LPO Value (AED)", key: "lpoValue", format: v => Number(v ?? 0).toFixed(2) },
              { header: "Status", key: "status" },
              { header: "LPO Date", key: "lpoDate" },
            ]}
            filename="lpos"
            title="Local Purchase Orders (LPO)"
            size="sm"
          />
          <Button
            className="bg-[#0f2d5a] hover:bg-[#1e6ab0]"
            onClick={() => { setForm(EMPTY_FORM); setAttachments([]); setCreateOpen(true); }}
          >
            <Plus className="w-4 h-4 mr-2" /> Register LPO
          </Button>
        </div>
      </div>

      {/* Search + summary */}
      <div className="flex items-center justify-between">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search LPOs..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="text-sm text-muted-foreground">
          Total: <span className="font-semibold text-foreground">AED {totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          {" · "}
          <span className="font-semibold text-foreground">{filtered.length}</span> LPO{filtered.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>LPO Number</TableHead>
              <TableHead>Our Quotation #</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Project Code</TableHead>
              <TableHead>LPO Date</TableHead>
              <TableHead className="text-right">LPO Value (AED)</TableHead>
              <TableHead>Payment Terms</TableHead>
              <TableHead>Attachments</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No LPOs found.</TableCell></TableRow>
            ) : filtered.map(l => {
              const linkedQ = (l as any).quotationId ? quotationById.get((l as any).quotationId) : null;
              return (
                <TableRow
                  key={l.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => openDetail(l.id)}
                >
                  <TableCell className="font-medium text-primary font-mono text-sm">{l.lpoNumber}</TableCell>
                  <TableCell>
                    {linkedQ ? (
                      <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200 rounded-md px-2 py-0.5">
                        <Link2 className="w-2.5 h-2.5" />{linkedQ.quotationNumber}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{l.clientName}</TableCell>
                  <TableCell>
                    {(l as any).projectRef ? (
                      <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold bg-[#0f2d5a]/8 text-[#0f2d5a] border border-[#0f2d5a]/20 rounded-md px-2 py-0.5">
                        {(l as any).projectRef}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>{(l as any).lpoDate || "-"}</TableCell>
                  <TableCell className="text-right font-medium">
                    AED {(l.lpoValue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-sm max-w-[180px] truncate" title={(l as any).paymentTerms || ""}>{(l as any).paymentTerms || "-"}</TableCell>
                  <TableCell>
                    {((l as any).attachments ?? []).length > 0 ? (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Paperclip className="w-3.5 h-3.5" />
                        <span className="text-xs">{((l as any).attachments as any[]).length}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={statusBadge(l.status ?? "active")}>
                      {l.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* ── Create Dialog ── */}
      <Dialog open={createOpen} onOpenChange={v => { setCreateOpen(v); if (!v) setAttachments([]); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Register New LPO</DialogTitle></DialogHeader>

          {/* AI extract bar */}
          <div className="flex items-center justify-between gap-3 p-3 rounded-md border border-dashed border-blue-300 bg-blue-50/50">
            <div className="text-sm">
              <div className="font-medium text-blue-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" /> Extract from LPO image
              </div>
              <div className="text-xs text-muted-foreground">
                Upload a JPG/PNG/WEBP of the client&apos;s LPO. AI will pre-fill the fields below for your review.
              </div>
            </div>
            <input ref={aiInputRef} type="file" accept="image/*" className="hidden" onChange={handleAiExtract} />
            <Button
              type="button" variant="outline" size="sm"
              className="border-blue-400 text-blue-700 hover:bg-blue-100"
              onClick={() => aiInputRef.current?.click()}
              disabled={aiExtracting}
            >
              {aiExtracting ? (
                <>Extracting…</>
              ) : (
                <><Upload className="w-4 h-4 mr-1.5" />AI Extract</>
              )}
            </Button>
          </div>

          <LpoFormFields
            form={form} setForm={setForm}
            attachments={attachments} setAttachments={setAttachments}
            companies={companies as any[]}
            quotations={quotations as any[]}
            fileInputRef={fileInputRef}
            onFileChange={e => handleFileSelect(e, false)}
          />
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              className="bg-[#0f2d5a] hover:bg-[#1e6ab0]"
              onClick={handleCreate}
              disabled={!form.clientName || !form.lpoNumber || !form.lpoValue || !form.companyId || createMutation.isPending}
            >
              {createMutation.isPending ? "Saving..." : "Register LPO"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Detail / Edit Dialog ── */}
      <Dialog open={detailId !== null} onOpenChange={v => { if (!v) { setDetailId(null); setEditMode(false); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <DialogTitle className="font-mono text-[#0f2d5a]">
                {selectedLpo?.lpoNumber ?? "LPO Detail"}
              </DialogTitle>
              <div className="flex items-center gap-2">
                {!editMode && (
                  <Button size="sm" variant="outline" onClick={() => setEditMode(true)}>
                    <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
                  </Button>
                )}
                <Badge variant="secondary" className={statusBadge(selectedLpo?.status ?? "active")}>
                  {selectedLpo?.status}
                </Badge>
              </div>
            </div>
          </DialogHeader>

          {editMode ? (
            <>
              <LpoFormFields
                form={editForm} setForm={setEditForm}
                attachments={editAttachments} setAttachments={setEditAttachments}
                companies={companies as any[]}
                quotations={quotations as any[]}
                fileInputRef={fileInputRef}
                onFileChange={e => handleFileSelect(e, true)}
                isEdit
              />
              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button variant="outline" onClick={() => setEditMode(false)}>Cancel</Button>
                <Button
                  className="bg-[#0f2d5a] hover:bg-[#1e6ab0]"
                  onClick={handleUpdate}
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </>
          ) : (
            selectedLpo && (
              <LpoDetailView
                lpo={selectedLpo as any}
                linkedQuotation={
                  (selectedLpo as any).quotationId
                    ? quotationById.get((selectedLpo as any).quotationId) ?? null
                    : null
                }
                signatureUrl={user?.signatureUrl ?? undefined}
                stampUrl={companies.find(c => c.id === selectedLpo?.companyId)?.stamp ?? undefined}
                stampWidthPct={companies.find(c => c.id === selectedLpo?.companyId)?.stampWidthPct ?? undefined}
                stampMarginPct={companies.find(c => c.id === selectedLpo?.companyId)?.stampMarginPct ?? undefined}
                canSign={true}
              />
            )
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LpoFormFields({
  form, setForm, attachments, setAttachments, companies, quotations, fileInputRef, onFileChange, isEdit = false,
}: {
  form: LpoForm;
  setForm: React.Dispatch<React.SetStateAction<LpoForm>>;
  attachments: AttachmentMeta[];
  setAttachments: React.Dispatch<React.SetStateAction<AttachmentMeta[]>>;
  companies: Array<{ id: number; shortName?: string; name?: string }>;
  quotations: any[];
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isEdit?: boolean;
}) {
  const f = (k: keyof LpoForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  const isQuotationLinked = !!form.quotationId;

  const handleQuotationSelect = (id: string, q: any | null) => {
    if (!q) {
      setForm(p => ({ ...p, quotationId: "" }));
      return;
    }
    setForm(p => ({
      ...p,
      quotationId: id,
      clientName: q.clientName ?? p.clientName,
      lpoValue: q.grandTotal != null ? String(Number(q.grandTotal).toFixed(2)) : p.lpoValue,
      paymentTerms: q.paymentTerms ?? p.paymentTerms,
      companyId: q.companyId ? String(q.companyId) : p.companyId,
      projectRef: q.projectName ?? p.projectRef,
    }));
  };

  return (
    <div className="space-y-4 py-2">
      {/* Quotation linkage — always first */}
      <div className="space-y-1.5 p-3 bg-blue-50/40 border border-blue-100 rounded-lg">
        <Label className="text-blue-900 font-semibold flex items-center gap-1.5">
          <Link2 className="w-3.5 h-3.5" /> Link to Our Quotation #
          <span className="text-muted-foreground font-normal text-xs ml-1">— auto-fills client, value &amp; payment terms</span>
        </Label>
        <QuotationPicker
          quotations={quotations}
          value={form.quotationId}
          onChange={handleQuotationSelect}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1 col-span-2">
          <Label>
            Client Name *
            {isQuotationLinked && (
              <span className="ml-2 text-[10px] text-blue-600 font-normal bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5">from quotation</span>
            )}
          </Label>
          <Input value={form.clientName} onChange={f("clientName")} placeholder="Client / Company name" />
        </div>
        <div className="space-y-1">
          <Label>Client LPO Number *
            <span className="text-muted-foreground font-normal text-xs ml-1">(as printed on the client&apos;s purchase order)</span>
          </Label>
          <Input value={form.lpoNumber} onChange={f("lpoNumber")} placeholder="e.g. LPO/ABC-CORP/2025/001" />
        </div>
        <div className="space-y-1">
          <Label>LPO Date</Label>
          <Input type="date" value={form.lpoDate} onChange={f("lpoDate")} />
        </div>
        <div className="space-y-1">
          <Label>
            LPO Value (AED) *
            {isQuotationLinked && (
              <span className="ml-2 text-[10px] text-blue-600 font-normal bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5">from quotation</span>
            )}
          </Label>
          <Input type="number" value={form.lpoValue} onChange={f("lpoValue")} placeholder="0.00" />
        </div>
        <div className="space-y-1">
          <Label>
            Payment Terms
            {isQuotationLinked ? (
              <span className="ml-2 text-[10px] text-blue-600 font-semibold bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5">strictly from quotation</span>
            ) : null}
          </Label>
          <Input
            value={form.paymentTerms}
            onChange={f("paymentTerms")}
            placeholder="e.g. 50% advance, 50% on delivery"
            readOnly={isQuotationLinked}
            className={isQuotationLinked ? "bg-blue-50/50 border-blue-200 text-blue-900 cursor-default" : ""}
          />
          {isQuotationLinked && (
            <p className="text-[10px] text-blue-600">Payment terms are locked to the linked quotation and will be used for all auto-created invoices.</p>
          )}
        </div>
        <div className="space-y-1">
          <Label>Project Name <span className="text-muted-foreground font-normal text-xs">(Project Code auto-generated on save)</span></Label>
          <Input value={form.projectRef} onChange={f("projectRef")} placeholder="e.g. Warehouse Extension Phase 2" />
        </div>
        <div className="space-y-1">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Company *</Label>
          <Select value={form.companyId} onValueChange={v => setForm(p => ({ ...p, companyId: v }))}>
            <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
            <SelectContent>
              {companies.map(c => (
                <SelectItem key={c.id} value={String(c.id)}>{c.shortName ?? c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 col-span-2">
          <Label>Scope of Work</Label>
          <Textarea value={form.scope} onChange={f("scope")} placeholder="Describe the scope of work..." rows={2} />
        </div>
        <div className="space-y-1">
          <Label>Delivery Schedule</Label>
          <Input value={form.deliverySchedule} onChange={f("deliverySchedule")} placeholder="e.g. 4 weeks from order" />
        </div>
        <div className="space-y-1 col-span-2">
          <Label>Notes / Remarks</Label>
          <Textarea value={form.notes} onChange={f("notes")} placeholder="Any additional notes..." rows={2} />
        </div>
      </div>

      {/* Attachments section */}
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
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={onFileChange} />
        </div>
        {attachments.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">No attachments yet. Click "Attach File" to add documents.</p>
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
        <p className="text-[11px] text-muted-foreground">Max {MAX_MB}MB per file</p>
      </div>
    </div>
  );
}

function LpoDetailView({
  lpo,
  linkedQuotation,
  signatureUrl,
  stampUrl,
  stampWidthPct,
  stampMarginPct,
  canSign,
}: {
  lpo: any;
  linkedQuotation: any | null;
  signatureUrl?: string;
  stampUrl?: string;
  stampWidthPct?: number | null;
  stampMarginPct?: number | null;
  canSign?: boolean;
}) {
  const atts: AttachmentMeta[] = lpo.attachments ?? [];
  const BASE_URL = import.meta.env.BASE_URL;
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingAtt, setDownloadingAtt] = useState<number | null>(null);
  const { toast } = useToast();

  async function authedFetch(url: string): Promise<string> {
    const r = await fetch(url, { headers: authHeaders() });
    if (!r.ok) throw new Error(`Failed to fetch file: ${r.status}`);
    const blob = await r.blob();
    return URL.createObjectURL(blob);
  }

  async function downloadAuthed(url: string, filename: string) {
    try {
      const objectUrl = await authedFetch(url);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
    } catch {
      toast({ title: "Download failed", variant: "destructive" });
    }
  }

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const el = document.getElementById(`lpo-detail-print-${lpo.id}`);
      if (!el) return;
      const filename = `LPO_${lpo.lpoNumber ?? lpo.id}.pdf`;
      const { base64 } = await captureElementToPdfBase64(el, filename, {
        signatureUrl: signatureUrl || undefined,
        stampUrl: stampUrl || undefined,
        stampWidthPct: stampWidthPct ?? undefined,
        stampMarginPct: stampMarginPct ?? undefined,
      });
      const link = document.createElement("a");
      link.href = `data:application/pdf;base64,${base64}`;
      link.download = filename;
      link.click();
    } catch {
      /* silently ignore */
    } finally {
      setDownloadingPdf(false);
    }
  };

  const InfoRow = ({ icon: Icon, label, value }: { icon: any; label: string; value: string }) => (
    value ? (
      <div className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
        <div className="w-7 h-7 rounded-md bg-[#0f2d5a]/8 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Icon className="w-3.5 h-3.5 text-[#1e6ab0]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">{label}</div>
          <div className="text-sm text-gray-800 mt-0.5">{value}</div>
        </div>
      </div>
    ) : null
  );

  return (
    <div className="space-y-5 py-1">
      {/* PDF Download button */}
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="outline"
          disabled={downloadingPdf}
          onClick={handleDownloadPdf}
          className="border-[#1e6ab0] text-[#0f2d5a] hover:bg-[#e8f1fb]"
        >
          {downloadingPdf
            ? <><Loader2Icon className="w-3.5 h-3.5 mr-1.5 animate-spin" />Generating PDF…</>
            : <><Printer className="w-3.5 h-3.5 mr-1.5" />Download PDF</>}
        </Button>
      </div>
      <div id={`lpo-detail-print-${lpo.id}`} className="space-y-5">
      {/* Linked quotation banner */}
      {linkedQuotation && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
            <Link2 className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-blue-700/70 font-medium mb-0.5">Linked to Our Quotation</div>
            <div className="font-mono font-bold text-blue-900 text-base tracking-wide">{linkedQuotation.quotationNumber}</div>
            {linkedQuotation.clientName && (
              <div className="text-xs text-blue-600 mt-0.5">{linkedQuotation.clientName}</div>
            )}
          </div>
          <div className="text-[10px] text-blue-600/70 text-right leading-4">
            Payment terms<br />from quotation
          </div>
        </div>
      )}

      {/* Auto-allocated project code banner */}
      {lpo.projectRef && (
        <div className="flex items-center gap-3 bg-[#0f2d5a]/5 border border-[#0f2d5a]/20 rounded-xl px-4 py-3">
          <div className="w-8 h-8 rounded-lg bg-[#0f2d5a] flex items-center justify-center flex-shrink-0">
            <FileText className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-[#0f2d5a]/70 font-medium mb-0.5">Auto-Allocated Project Code</div>
            <div className="font-mono font-bold text-[#0f2d5a] text-lg tracking-wide">{lpo.projectRef}</div>
          </div>
          <div className="text-[10px] text-[#0f2d5a]/60 text-right leading-4">
            Linked to<br />Projects module
          </div>
        </div>
      )}

      {/* Key stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#0f2d5a]/5 rounded-xl p-3 text-center">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">LPO Value</div>
          <div className="text-xl font-bold text-[#0f2d5a]">
            AED {(lpo.lpoValue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">LPO Date</div>
          <div className="text-sm font-semibold text-gray-800">{lpo.lpoDate || "—"}</div>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Payment Terms</div>
          <div className="text-xs font-semibold text-gray-800 leading-tight">{lpo.paymentTerms || "—"}</div>
        </div>
      </div>

      {/* Details */}
      <div className="bg-white border border-gray-100 rounded-xl px-4 py-1">
        <InfoRow icon={Building2} label="Client Name" value={lpo.clientName} />
        <InfoRow icon={ClipboardList} label="Scope of Work" value={lpo.scope} />
        <InfoRow icon={Calendar} label="Delivery Schedule" value={lpo.deliverySchedule} />
        <InfoRow icon={DollarSign} label="Notes" value={lpo.notes} />
      </div>

      {/* Attachments */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-[#1e6ab0]" />
          <span className="text-sm font-semibold text-gray-700">Attachments</span>
          <Badge variant="secondary" className="text-xs">{atts.length}</Badge>
        </div>
        {atts.length === 0 ? (
          <p className="text-sm text-muted-foreground pl-6">No attachments. Click Edit to add files.</p>
        ) : (
          <div className="flex flex-wrap gap-2 pl-6">
            {atts.map((att, i) => (
              <button
                key={i}
                type="button"
                disabled={downloadingAtt === i}
                onClick={async () => {
                  if (att.content) {
                    const a = document.createElement("a");
                    a.href = `data:${att.contentType};base64,${att.content}`;
                    a.download = att.filename;
                    a.click();
                  } else {
                    setDownloadingAtt(i);
                    try {
                      await downloadAuthed(
                        `${BASE_URL}api/lpos/${lpo.id}/attachments/${i}`,
                        att.filename,
                      );
                    } finally {
                      setDownloadingAtt(null);
                    }
                  }
                }}
                className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 hover:bg-blue-50 hover:border-[#1e6ab0] transition-colors group disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <FileIcon className="w-4 h-4 text-[#1e6ab0] flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-medium text-gray-800 truncate max-w-[150px] group-hover:text-[#1e6ab0]">{att.filename}</div>
                  <div className="text-[10px] text-gray-400">{formatBytes(att.size ?? 0)}</div>
                </div>
                {downloadingAtt === i
                  ? <Loader2Icon className="w-3.5 h-3.5 text-[#1e6ab0] ml-1 flex-shrink-0 animate-spin" />
                  : <Download className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#1e6ab0] ml-1 flex-shrink-0" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Timestamps */}
      <div className="text-[11px] text-muted-foreground border-t pt-2 flex gap-4">
        <span>Created: {new Date(lpo.createdAt).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" })}</span>
        {lpo.updatedAt && lpo.updatedAt !== lpo.createdAt && (
          <span>Updated: {new Date(lpo.updatedAt).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" })}</span>
        )}
      </div>

      {/* Signature & Stamp — inside print area so they appear on document */}
      {(signatureUrl || stampUrl) && (
        <div className="grid grid-cols-2 gap-8 text-xs border-t border-gray-300 pt-3 mt-2">
          <div>
            <div className="font-semibold mb-0.5 text-[#0f2d5a]">Prepared by:</div>
            {signatureUrl && (
              <div data-html2canvas-ignore="true" style={{ marginTop: 46, display: "flex", justifyContent: "center" }}>
                <img src={signatureUrl} alt="Signature" style={{ maxHeight: 56, maxWidth: 180, objectFit: "contain", opacity: 0.85 }} />
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="font-semibold mb-0.5 text-[#0f2d5a]">For &amp; on behalf of</div>
            {stampUrl && (
              <div data-html2canvas-ignore="true" style={{ marginTop: 6 }}>
                <img src={stampUrl} alt="Stamp" style={{ maxHeight: 160, maxWidth: 360, objectFit: "contain", opacity: 0.85, display: "block", marginLeft: "auto" }} />
              </div>
            )}
          </div>
        </div>
      )}
      </div>{/* end lpo-detail-print */}
    </div>
  );
}
