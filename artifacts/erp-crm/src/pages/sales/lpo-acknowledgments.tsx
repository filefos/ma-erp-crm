import { useState, useRef } from "react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { useListCompanies, useListContacts, useListQuotations, useListLpos } from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Search, Plus, Upload, Eye, Download, Trash2, RefreshCw,
  FileText, AlertTriangle, X, Building2, User, ClipboardList,
  CheckCircle2, Loader2, Calendar,
} from "lucide-react";
import { authHeaders } from "@/lib/ai-client";
import { HelpButton } from "@/components/help-button";

const BASE = import.meta.env.BASE_URL;
const MAX_MB = 20;

interface AckRecord {
  id: number;
  companyId: number;
  customerName: string;
  customerId: number | null;
  quotationNumber: string | null;
  lpoNumber: string | null;
  fileName: string;
  fileSize: number | null;
  uploadDate: string | null;
  remarks: string | null;
  uploadedByName: string | null;
  createdAt: string;
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" });
}

const EMPTY_FORM = {
  customerName: "",
  customerId: "",
  quotationNumber: "",
  lpoNumber: "",
  uploadDate: new Date().toISOString().slice(0, 10),
  remarks: "",
};

export function LpoAcknowledgments() {
  const { activeCompanyId } = useActiveCompany();
  const { data: companies } = useListCompanies();
  const { data: contacts } = useListContacts();
  const { data: quotations } = useListQuotations();
  const { data: lpos } = useListLpos();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [viewRecord, setViewRecord] = useState<AckRecord | null>(null);
  const [replaceRecord, setReplaceRecord] = useState<AckRecord | null>(null);
  const [deleteRecord, setDeleteRecord] = useState<AckRecord | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [file, setFile] = useState<{ name: string; content: string; size: number; type: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [warnShown, setWarnShown] = useState(false);
  const [pendingFile, setPendingFile] = useState<{ name: string; content: string; size: number; type: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);

  const { data: records = [], isLoading } = useQuery<AckRecord[]>({
    queryKey: ["lpo-acknowledgments", activeCompanyId],
    queryFn: async () => {
      const url = `${BASE}api/lpo-acknowledgments${activeCompanyId ? `?companyId=${activeCompanyId}` : ""}`;
      const r = await fetch(url, { headers: authHeaders() });
      if (!r.ok) throw new Error("Failed to load");
      return r.json();
    },
  });

  const filtered = records.filter(r => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      r.customerName?.toLowerCase().includes(s) ||
      r.lpoNumber?.toLowerCase().includes(s) ||
      r.quotationNumber?.toLowerCase().includes(s)
    );
  });

  const companyOptions = (companies ?? []).filter(c =>
    activeCompanyId ? c.id === activeCompanyId : true
  );

  const contactOptions = (contacts ?? []).filter(c =>
    activeCompanyId ? c.companyId === activeCompanyId : true
  );

  const quotationOptions = (quotations ?? []).filter(q =>
    activeCompanyId ? q.companyId === activeCompanyId : true
  );

  const lpoOptions = (lpos ?? []).filter(l =>
    activeCompanyId ? l.companyId === activeCompanyId : true
  );

  async function readFileAsBase64(f: File): Promise<{ name: string; content: string; size: number; type: string }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1];
        resolve({ name: f.name, content: base64, size: f.size, type: f.type });
      };
      reader.onerror = reject;
      reader.readAsDataURL(f);
    });
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    e.target.value = "";
    if (f.type !== "application/pdf") {
      toast({ title: "PDF only", description: "Please upload a PDF file.", variant: "destructive" });
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      toast({ title: "File too large", description: `Maximum file size is ${MAX_MB} MB.`, variant: "destructive" });
      return;
    }
    readFileAsBase64(f).then(data => {
      if (!warnShown) {
        setPendingFile(data);
      } else {
        setFile(data);
      }
    });
  }

  function confirmWarning() {
    if (pendingFile) setFile(pendingFile);
    setPendingFile(null);
    setWarnShown(true);
  }

  async function handleUpload() {
    if (!file) { toast({ title: "No file selected", variant: "destructive" }); return; }
    if (!form.customerName.trim()) { toast({ title: "Customer name is required", variant: "destructive" }); return; }
    const companyId = activeCompanyId ?? companyOptions[0]?.id;
    if (!companyId) { toast({ title: "No company selected", variant: "destructive" }); return; }

    setUploading(true);
    try {
      const body = {
        companyId,
        customerName: form.customerName,
        customerId: form.customerId || null,
        quotationNumber: form.quotationNumber || null,
        lpoNumber: form.lpoNumber || null,
        fileName: file.name,
        contentType: file.type,
        fileContent: file.content,
        fileSize: file.size,
        uploadDate: form.uploadDate,
        remarks: form.remarks || null,
      };
      const r = await fetch(`${BASE}api/lpo-acknowledgments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(await r.text());
      toast({ title: "Uploaded successfully" });
      qc.invalidateQueries({ queryKey: ["lpo-acknowledgments"] });
      setUploadOpen(false);
      setForm({ ...EMPTY_FORM });
      setFile(null);
      setWarnShown(false);
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  async function handleReplace(replaceFile: { name: string; content: string; size: number; type: string }) {
    if (!replaceRecord) return;
    setUploading(true);
    try {
      const r = await fetch(`${BASE}api/lpo-acknowledgments/${replaceRecord.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          fileContent: replaceFile.content,
          fileName: replaceFile.name,
          contentType: replaceFile.type,
          fileSize: replaceFile.size,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      toast({ title: "PDF replaced successfully" });
      qc.invalidateQueries({ queryKey: ["lpo-acknowledgments"] });
      setReplaceRecord(null);
    } catch (e: any) {
      toast({ title: "Replace failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  function handleReplaceFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    e.target.value = "";
    if (f.type !== "application/pdf") {
      toast({ title: "PDF only", description: "Please upload a PDF file.", variant: "destructive" });
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      toast({ title: "File too large", variant: "destructive" });
      return;
    }
    readFileAsBase64(f).then(handleReplace);
  }

  async function handleDelete() {
    if (!deleteRecord) return;
    try {
      const r = await fetch(`${BASE}api/lpo-acknowledgments/${deleteRecord.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!r.ok) throw new Error(await r.text());
      toast({ title: "Deleted" });
      qc.invalidateQueries({ queryKey: ["lpo-acknowledgments"] });
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    } finally {
      setDeleteRecord(null);
    }
  }

  function handleViewPdf(record: AckRecord) {
    setViewRecord(record);
  }

  function handleDownloadPdf(record: AckRecord) {
    const url = `${BASE}api/lpo-acknowledgments/${record.id}/file?download=1`;
    const a = document.createElement("a");
    a.href = url;
    a.download = record.fileName;
    a.click();
  }

  function autofillFromContact(contactId: string) {
    const c = contactOptions.find(x => String(x.id) === contactId);
    if (c) setForm(f => ({ ...f, customerId: contactId, customerName: c.name }));
  }

  function autofillFromLpo(lpoId: string) {
    const l = lpoOptions.find(x => String(x.id) === lpoId);
    if (l) {
      setForm(f => ({
        ...f,
        lpoNumber: l.lpoNumber ?? f.lpoNumber,
        quotationNumber: l.quotationRef ?? f.quotationNumber,
        customerName: l.clientName ?? f.customerName,
      }));
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight uppercase">Acknowledgment of LPO</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Store and retrieve stamped &amp; signed client LPO acknowledgment PDFs.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <HelpButton pageKey="lpo-acknowledgments" />
          <Button
            className="bg-[#0f2d5a] hover:bg-[#1e6ab0]"
            onClick={() => { setForm({ ...EMPTY_FORM }); setFile(null); setWarnShown(false); setUploadOpen(true); }}
          >
            <Upload className="w-4 h-4 mr-2" /> Upload LPO Acknowledgment
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by customer, LPO no., quotation no.…"
          className="pl-8"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>LPO Number</TableHead>
              <TableHead>Quotation No.</TableHead>
              <TableHead>Upload Date</TableHead>
              <TableHead>File</TableHead>
              <TableHead>Uploaded By</TableHead>
              <TableHead>Remarks</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                  {search ? "No records match your search." : "No LPO acknowledgments uploaded yet."}
                </TableCell>
              </TableRow>
            ) : filtered.map(rec => (
              <TableRow key={rec.id} className="hover:bg-muted/40">
                <TableCell className="font-medium">{rec.customerName}</TableCell>
                <TableCell>
                  {rec.lpoNumber
                    ? <Badge variant="outline" className="font-mono text-xs">{rec.lpoNumber}</Badge>
                    : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-xs font-mono text-muted-foreground">
                  {rec.quotationNumber || "—"}
                </TableCell>
                <TableCell className="text-sm">{fmtDate(rec.uploadDate || rec.createdAt)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                    <span className="text-xs text-gray-700 truncate max-w-[120px]">{rec.fileName}</span>
                    {rec.fileSize && (
                      <span className="text-[10px] text-muted-foreground">({formatBytes(rec.fileSize)})</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{rec.uploadedByName || "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{rec.remarks || "—"}</TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost" size="icon" title="View PDF"
                      className="text-[#1e6ab0] hover:text-[#0f2d5a]"
                      onClick={() => handleViewPdf(rec)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" title="Download PDF"
                      className="text-green-600 hover:text-green-800"
                      onClick={() => handleDownloadPdf(rec)}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" title="Replace PDF"
                      className="text-orange-500 hover:text-orange-700"
                      onClick={() => setReplaceRecord(rec)}
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" title="Delete"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => setDeleteRecord(rec)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* ─── Upload Dialog ─── */}
      <Dialog open={uploadOpen} onOpenChange={v => { if (!v) { setUploadOpen(false); setFile(null); setWarnShown(false); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="uppercase tracking-wide">Upload LPO Acknowledgment</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-1">
            {/* Warning banner */}
            <div className="flex gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-semibold mb-1">Important — PDF Upload Rules</p>
                <p>Upload <strong>only</strong> the client LPO sheet with stamp and signature. Do <strong>not</strong> upload quotations, drawings, or any company-generated documents. Do not merge files or add company letterhead.</p>
              </div>
            </div>

            {/* Fields */}
            <div className="grid grid-cols-2 gap-4">
              {/* Customer (from contacts) */}
              <div className="space-y-1.5">
                <Label>Contact / Customer</Label>
                <Select onValueChange={autofillFromContact} value={form.customerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select contact…" />
                  </SelectTrigger>
                  <SelectContent>
                    {contactOptions.map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}{c.companyName ? ` — ${c.companyName}` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Customer name (editable override) */}
              <div className="space-y-1.5">
                <Label>Customer Name <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="Customer / client name"
                  value={form.customerName}
                  onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))}
                />
              </div>

              {/* Quotation number */}
              <div className="space-y-1.5">
                <Label>Quotation Number</Label>
                <Select
                  onValueChange={v => setForm(f => ({ ...f, quotationNumber: v === "__none__" ? "" : v }))}
                  value={form.quotationNumber || "__none__"}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select quotation…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— None —</SelectItem>
                    {quotationOptions.map(q => (
                      <SelectItem key={q.id} value={q.quotationNumber}>{q.quotationNumber} — {q.clientName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* LPO number */}
              <div className="space-y-1.5">
                <Label>LPO Number</Label>
                <Select
                  onValueChange={v => {
                    const val = v === "__none__" ? "" : v;
                    setForm(f => ({ ...f, lpoNumber: val }));
                    if (val) autofillFromLpo(String(lpoOptions.find(l => l.lpoNumber === val)?.id ?? ""));
                  }}
                  value={form.lpoNumber || "__none__"}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select LPO…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— None —</SelectItem>
                    {lpoOptions.map(l => (
                      <SelectItem key={l.id} value={l.lpoNumber ?? String(l.id)}>{l.lpoNumber} — {l.clientName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Upload date */}
              <div className="space-y-1.5">
                <Label>Upload Date</Label>
                <Input
                  type="date"
                  value={form.uploadDate}
                  onChange={e => setForm(f => ({ ...f, uploadDate: e.target.value }))}
                />
              </div>
            </div>

            {/* Remarks */}
            <div className="space-y-1.5">
              <Label>Remarks / Notes</Label>
              <Textarea
                placeholder="Any notes about this acknowledgment…"
                rows={2}
                value={form.remarks}
                onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
              />
            </div>

            {/* File upload */}
            <div className="space-y-2">
              <Label>Client LPO PDF <span className="text-red-500">*</span></Label>
              <div
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                  file ? "border-green-400 bg-green-50" : "border-gray-200 hover:border-[#1e6ab0] hover:bg-blue-50/30"
                }`}
                onClick={() => fileInputRef.current?.click()}
              >
                {file ? (
                  <div className="flex items-center justify-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
                    <div className="text-left">
                      <div className="font-medium text-green-800 text-sm">{file.name}</div>
                      <div className="text-xs text-green-600">{formatBytes(file.size)}</div>
                    </div>
                    <button
                      className="ml-2 text-gray-400 hover:text-red-500 p-1"
                      onClick={e => { e.stopPropagation(); setFile(null); }}
                    ><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <div>
                    <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-700">Click to select PDF</p>
                    <p className="text-xs text-muted-foreground mt-1">PDF only · Max {MAX_MB} MB</p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setUploadOpen(false); setFile(null); setWarnShown(false); }}>
                Cancel
              </Button>
              <Button
                className="bg-[#0f2d5a] hover:bg-[#1e6ab0]"
                disabled={uploading || !file || !form.customerName.trim()}
                onClick={handleUpload}
              >
                {uploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading…</> : <><Upload className="w-4 h-4 mr-2" />Upload PDF</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Upload Warning Dialog ─── */}
      <AlertDialog open={!!pendingFile} onOpenChange={open => { if (!open) setPendingFile(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Important — Before You Upload
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base leading-relaxed">
              Please upload <strong>only the client LPO sheet with stamp and signature</strong>.<br /><br />
              Do <strong>not</strong> upload:
              <ul className="list-disc ml-5 mt-2 space-y-1">
                <li>Our quotation</li>
                <li>Company drawings</li>
                <li>Related documents</li>
                <li>Any extra pages from our company</li>
              </ul>
              <br />
              Only the stamped and signed client LPO file should be uploaded.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingFile(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#0f2d5a] hover:bg-[#1e6ab0]"
              onClick={confirmWarning}
            >
              I understand — Proceed
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── View PDF Dialog ─── */}
      <Dialog open={!!viewRecord} onOpenChange={open => { if (!open) setViewRecord(null); }}>
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-5 pb-3 border-b flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-base">{viewRecord?.fileName}</DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {viewRecord?.customerName}
                  {viewRecord?.lpoNumber && <> · LPO: <span className="font-mono">{viewRecord.lpoNumber}</span></>}
                  {viewRecord?.quotationNumber && <> · Quotation: <span className="font-mono">{viewRecord.quotationNumber}</span></>}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-green-700 border-green-300 hover:bg-green-50"
                  onClick={() => viewRecord && handleDownloadPdf(viewRecord)}
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />Download
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            {viewRecord && (
              <iframe
                src={`${BASE}api/lpo-acknowledgments/${viewRecord.id}/file`}
                className="w-full h-full border-0"
                title="LPO Acknowledgment PDF"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Replace PDF hidden input ─── */}
      <input
        ref={replaceFileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleReplaceFileSelect}
      />

      {/* ─── Replace confirmation dialog ─── */}
      <AlertDialog open={!!replaceRecord} onOpenChange={open => { if (!open) setReplaceRecord(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace PDF</AlertDialogTitle>
            <AlertDialogDescription>
              Select a new PDF to replace the current file for <strong>{replaceRecord?.customerName}</strong>
              {replaceRecord?.lpoNumber && <> (LPO: {replaceRecord.lpoNumber})</>}.
              <br /><br />
              <span className="text-amber-700 font-medium">Upload only the stamped and signed client LPO sheet. Do not include any other documents.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-orange-600 hover:bg-orange-700"
              onClick={() => replaceFileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Replacing…</> : <><RefreshCw className="w-4 h-4 mr-1" />Choose New PDF</>}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Delete confirmation ─── */}
      <AlertDialog open={!!deleteRecord} onOpenChange={open => { if (!open) setDeleteRecord(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Acknowledgment</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the LPO acknowledgment PDF for <strong>{deleteRecord?.customerName}</strong>
              {deleteRecord?.lpoNumber && <> (LPO: {deleteRecord.lpoNumber})</>}.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleDelete}>
              <Trash2 className="w-4 h-4 mr-1" />Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
