import { useState, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { useListQuotations, useListCompanies } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { PDFDocument } from "pdf-lib";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Search, Upload, Eye, Download, Trash2, RefreshCw, FileText, X, CheckCircle2, Loader2, Stamp, PenLine, ArrowLeft } from "lucide-react";
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

const EMPTY_FORM = { quotationNumber: "", clientRef: "" }; // clientRef auto-filled from quotation

export function LpoAcknowledgments() {
  const { activeCompanyId } = useActiveCompany();
  const { data: quotations } = useListQuotations();
  const { data: companies } = useListCompanies();
  const { user } = useAuth();
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
  const [uploadedRecord, setUploadedRecord] = useState<AckRecord | null>(null);
  const [previewBackRecord, setPreviewBackRecord] = useState<AckRecord | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [stampingId, setStampingId] = useState<number | null>(null);
  const [previewStampOn, setPreviewStampOn] = useState(false);
  const [previewSigOn, setPreviewSigOn] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);

  // Authenticated fetch → Blob URL (avoids 401 on plain href/iframe)
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

  async function fetchImageBytes(src: string): Promise<{ bytes: Uint8Array; isPng: boolean }> {
    if (src.startsWith("data:")) {
      const [header, b64] = src.split(",");
      const isPng = header.includes("png");
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return { bytes, isPng };
    }
    const r = await fetch(src, { headers: authHeaders() });
    if (!r.ok) throw new Error("Failed to fetch image");
    const ab = await r.arrayBuffer();
    const isPng = src.toLowerCase().includes(".png") || r.headers.get("content-type")?.includes("png") || false;
    return { bytes: new Uint8Array(ab), isPng };
  }

  async function handleStampSign(record: AckRecord, mode: "stamp" | "signature" | "both") {
    const sigUrl = user?.signatureUrl ?? null;
    const company = (companies ?? []).find(c => c.id === (record.companyId ?? activeCompanyId));
    const stampUrl = (company as any)?.stamp ?? null;

    if (mode === "stamp" && !stampUrl) {
      toast({ title: "No stamp configured", description: "Go to Admin → Companies and upload a company stamp.", variant: "destructive" });
      return;
    }
    if (mode === "signature" && !sigUrl) {
      toast({ title: "No signature uploaded", description: "Go to your Profile settings and upload a signature.", variant: "destructive" });
      return;
    }
    if (mode === "both" && !sigUrl && !stampUrl) {
      toast({ title: "Nothing to apply", description: "Upload a signature in Profile and a stamp in Admin → Companies.", variant: "destructive" });
      return;
    }

    setStampingId(record.id);
    try {
      const pdfRes = await fetch(`${BASE}api/lpo-acknowledgments/${record.id}/file`, { headers: authHeaders() });
      if (!pdfRes.ok) throw new Error("Could not fetch PDF");
      const pdfBytes = new Uint8Array(await pdfRes.arrayBuffer());
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const pages = pdfDoc.getPages();
      const lastPage = pages[pages.length - 1];
      const { width, height } = lastPage.getSize();
      const margin = 36;
      const imgH = 60;

      if ((mode === "stamp" || mode === "both") && stampUrl) {
        const { bytes, isPng } = await fetchImageBytes(stampUrl);
        const img = isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
        const scaled = img.scaleToFit(140, imgH);
        lastPage.drawImage(img, {
          x: width - margin - scaled.width,
          y: margin,
          width: scaled.width,
          height: scaled.height,
          opacity: 0.85,
        });
      }

      if ((mode === "signature" || mode === "both") && sigUrl) {
        const { bytes, isPng } = await fetchImageBytes(sigUrl);
        const img = isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
        const scaled = img.scaleToFit(120, imgH);
        lastPage.drawImage(img, {
          x: margin,
          y: margin,
          width: scaled.width,
          height: scaled.height,
          opacity: 0.85,
        });
      }

      const stamped = await pdfDoc.save();
      const blob = new Blob([stamped], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const suffix = mode === "both" ? "_stamped_signed" : mode === "stamp" ? "_stamped" : "_signed";
      a.href = url;
      a.download = record.fileName.replace(/\.pdf$/i, "") + suffix + ".pdf";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast({ title: "Done", description: "Stamped PDF downloaded successfully." });
    } catch (e: any) {
      toast({ title: "Failed to stamp PDF", description: e.message, variant: "destructive" });
    } finally {
      setStampingId(null);
    }
  }

  // Fetch blob URL for the preview iframe whenever viewRecord changes
  useEffect(() => {
    if (!viewRecord) { setBlobUrl(null); return; }
    let revoked = false;
    authedFetch(`${BASE}api/lpo-acknowledgments/${viewRecord.id}/file`)
      .then(url => {
        if (revoked) {
          URL.revokeObjectURL(url);
        } else {
          setBlobUrl(url);
        }
      })
      .catch(() => toast({ title: "Could not load preview", variant: "destructive" }));
    return () => {
      revoked = true;
      setBlobUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
    };
  }, [viewRecord?.id]);

  const { data: records = [], isLoading } = useQuery<AckRecord[]>({
    queryKey: ["lpo-acknowledgments", activeCompanyId],
    queryFn: async () => {
      const url = `${BASE}api/lpo-acknowledgments${activeCompanyId ? `?companyId=${activeCompanyId}` : ""}`;
      const r = await fetch(url, { headers: authHeaders() });
      if (!r.ok) throw new Error("Failed to load");
      return r.json();
    },
  });

  const quotationOptions = (quotations ?? []).filter(q =>
    activeCompanyId ? q.companyId === activeCompanyId : true
  );

  const filtered = records.filter(r => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      r.customerName?.toLowerCase().includes(s) ||
      r.quotationNumber?.toLowerCase().includes(s)
    );
  });

  async function readFileAsBase64(f: File): Promise<{ name: string; content: string; size: number; type: string }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
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
    readFileAsBase64(f).then(setFile);
  }

  async function handleUpload() {
    if (!file) { toast({ title: "No file selected", variant: "destructive" }); return; }
    const companyId = activeCompanyId;
    if (!companyId) { toast({ title: "No company selected", variant: "destructive" }); return; }

    setUploading(true);
    try {
      const r = await fetch(`${BASE}api/lpo-acknowledgments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          companyId,
          customerName: form.clientRef.trim() || form.quotationNumber || "N/A",
          quotationNumber: form.quotationNumber || null,
          fileName: file.name,
          contentType: file.type,
          fileContent: file.content,
          fileSize: file.size,
          uploadDate: new Date().toISOString().slice(0, 10),
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      const saved: AckRecord = await r.json();
      qc.invalidateQueries({ queryKey: ["lpo-acknowledgments"] });
      setUploadedRecord(saved);
      setForm({ ...EMPTY_FORM });
      setFile(null);
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
      toast({ title: "PDF only", variant: "destructive" });
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
            onClick={() => { setForm({ ...EMPTY_FORM }); setFile(null); setUploadOpen(true); }}
          >
            <Upload className="w-4 h-4 mr-2" /> Upload LPO Acknowledgment
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by client ref, quotation no.…"
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
              <TableHead>Client ID / REF</TableHead>
              <TableHead>Quotation No.</TableHead>
              <TableHead>File</TableHead>
              <TableHead>Uploaded By</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                  {search ? "No records match your search." : "No LPO acknowledgments uploaded yet."}
                </TableCell>
              </TableRow>
            ) : filtered.map(rec => (
              <TableRow key={rec.id} className="hover:bg-muted/40">
                <TableCell className="font-medium">{rec.customerName}</TableCell>
                <TableCell className="text-xs font-mono text-muted-foreground">
                  {rec.quotationNumber
                    ? <Badge variant="outline" className="font-mono text-xs">{rec.quotationNumber}</Badge>
                    : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                    <span className="text-xs text-gray-700 truncate max-w-[140px]">{rec.fileName}</span>
                    {rec.fileSize && (
                      <span className="text-[10px] text-muted-foreground">({formatBytes(rec.fileSize)})</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{rec.uploadedByName || "—"}</TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost" size="icon" title="View PDF"
                      className="text-[#1e6ab0] hover:text-[#0f2d5a]"
                      onClick={() => setViewRecord(rec)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" title="Download PDF"
                      className="text-green-600 hover:text-green-800"
                      onClick={() => downloadAuthed(`${BASE}api/lpo-acknowledgments/${rec.id}/file?download=1`, rec.fileName)}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" title="Replace PDF"
                      className="text-orange-500 hover:text-orange-700"
                      onClick={() => { setReplaceRecord(rec); replaceFileInputRef.current?.click(); }}
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
      <Dialog open={uploadOpen} onOpenChange={v => {
        if (!v) { setUploadOpen(false); setFile(null); setUploadedRecord(null); setPreviewBackRecord(null); }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="uppercase tracking-wide">
              {uploadedRecord ? "Upload Complete" : "Upload LPO Acknowledgment"}
            </DialogTitle>
          </DialogHeader>

          {/* ── Success screen ── */}
          {uploadedRecord ? (
            <div className="py-2 space-y-5">
              {/* File confirm */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
                <CheckCircle2 className="w-8 h-8 text-green-600 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="font-semibold text-green-800 text-sm truncate">{uploadedRecord.fileName}</p>
                  <p className="text-xs text-green-600 mt-0.5">
                    {uploadedRecord.quotationNumber ? `Quotation: ${uploadedRecord.quotationNumber}` : "No quotation linked"}
                    {uploadedRecord.fileSize ? ` · ${formatBytes(uploadedRecord.fileSize)}` : ""}
                  </p>
                </div>
              </div>

              {/* Action buttons grid */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  className="flex flex-col h-16 gap-1 border-[#1e6ab0]/40 text-[#1e6ab0] hover:bg-blue-50"
                  onClick={() => {
                    setPreviewBackRecord(uploadedRecord);
                    setViewRecord(uploadedRecord);
                    setUploadOpen(false);
                  }}
                >
                  <Eye className="w-5 h-5" />
                  <span className="text-xs font-medium">Preview</span>
                </Button>

                <Button
                  variant="outline"
                  className="flex flex-col h-16 gap-1 border-green-400/60 text-green-700 hover:bg-green-50"
                  onClick={() => downloadAuthed(
                    `${BASE}api/lpo-acknowledgments/${uploadedRecord.id}/file?download=1`,
                    uploadedRecord.fileName
                  )}
                >
                  <Download className="w-5 h-5" />
                  <span className="text-xs font-medium">Download</span>
                </Button>

                <Button
                  variant="outline"
                  className="flex flex-col h-16 gap-1 border-purple-400/60 text-purple-700 hover:bg-purple-50 disabled:opacity-60"
                  disabled={stampingId === uploadedRecord.id}
                  onClick={() => handleStampSign(uploadedRecord, "stamp")}
                >
                  {stampingId === uploadedRecord.id
                    ? <Loader2 className="w-5 h-5 animate-spin" />
                    : <Stamp className="w-5 h-5" />}
                  <span className="text-xs font-medium">Download Stamped</span>
                </Button>

                <Button
                  variant="outline"
                  className="flex flex-col h-16 gap-1 border-orange-400/60 text-orange-700 hover:bg-orange-50 disabled:opacity-60"
                  disabled={stampingId === uploadedRecord.id}
                  onClick={() => handleStampSign(uploadedRecord, "signature")}
                >
                  {stampingId === uploadedRecord.id
                    ? <Loader2 className="w-5 h-5 animate-spin" />
                    : <PenLine className="w-5 h-5" />}
                  <span className="text-xs font-medium">Download Signed</span>
                </Button>
              </div>

              <Button
                className="w-full bg-[#0f2d5a] hover:bg-[#1e6ab0]"
                onClick={() => { setUploadOpen(false); setUploadedRecord(null); }}
              >
                Close
              </Button>
            </div>
          ) : (
            /* ── Upload form ── */
            <div className="space-y-4 py-1">
              {/* Quotation Number */}
              <div className="space-y-1.5">
                <Label>Quotation Number</Label>
                <Select
                  onValueChange={v => {
                    if (v === "__none__") {
                      setForm(f => ({ ...f, quotationNumber: "" }));
                    } else {
                      const q = quotationOptions.find(q => q.quotationNumber === v);
                      setForm(f => ({
                        ...f,
                        quotationNumber: v,
                        clientRef: q?.clientCode || q?.clientName || f.clientRef,
                      }));
                    }
                  }}
                  value={form.quotationNumber || "__none__"}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select quotation…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— None —</SelectItem>
                    {quotationOptions.map(q => (
                      <SelectItem key={q.id} value={q.quotationNumber}>
                        {q.quotationNumber} — {q.clientName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                    <>
                      <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm font-medium text-gray-700">Click to select PDF</p>
                      <p className="text-xs text-muted-foreground mt-1">PDF only · Max {MAX_MB} MB</p>
                    </>
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
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => { setUploadOpen(false); setFile(null); }}>
                  Cancel
                </Button>
                <Button
                  className="bg-[#0f2d5a] hover:bg-[#1e6ab0]"
                  disabled={uploading || !file}
                  onClick={handleUpload}
                >
                  {uploading
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading…</>
                    : <><Upload className="w-4 h-4 mr-2" />Upload</>}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── View PDF Dialog ─── */}
      <Dialog open={!!viewRecord} onOpenChange={open => {
        if (!open) {
          setViewRecord(null);
          setPreviewBackRecord(null);
          setPreviewStampOn(false);
          setPreviewSigOn(false);
        }
      }}>
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-5 pb-3 border-b flex-shrink-0">
            <div className="flex items-center justify-between gap-3">
              {/* Back button — only shown when opened from the upload success screen */}
              {previewBackRecord && (
                <Button
                  size="sm" variant="ghost"
                  className="flex items-center gap-1.5 text-[#1e6ab0] hover:bg-blue-50 flex-shrink-0 -ml-2"
                  onClick={() => {
                    setViewRecord(null);
                    setUploadedRecord(previewBackRecord);
                    setPreviewBackRecord(null);
                    setUploadOpen(true);
                  }}
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="text-xs font-medium">Back</span>
                </Button>
              )}
              <DialogTitle className="text-sm flex-1 truncate min-w-0">
                {viewRecord?.customerName} — {viewRecord?.fileName}
              </DialogTitle>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  size="sm"
                  variant={previewStampOn ? "default" : "outline"}
                  className={previewStampOn
                    ? "bg-purple-700 text-white hover:bg-purple-800"
                    : "text-purple-700 border-purple-300 hover:bg-purple-50"}
                  onClick={() => {
                    if (!previewStampOn) {
                      const company = (companies ?? []).find(c => c.id === viewRecord?.companyId);
                      if (!(company as any)?.stamp) {
                        toast({ title: "No stamp configured", description: "Go to Admin → Companies and upload a company stamp.", variant: "destructive" });
                        return;
                      }
                    }
                    setPreviewStampOn(v => !v);
                  }}
                >
                  <Stamp className="w-3.5 h-3.5 mr-1" />
                  P.STAMP
                </Button>
                <Button
                  size="sm"
                  variant={previewSigOn ? "default" : "outline"}
                  className={previewSigOn
                    ? "bg-orange-600 text-white hover:bg-orange-700"
                    : "text-orange-700 border-orange-300 hover:bg-orange-50"}
                  onClick={() => {
                    if (!previewSigOn && !user?.signatureUrl) {
                      toast({ title: "No signature uploaded", description: "Go to your Profile settings and upload a signature.", variant: "destructive" });
                      return;
                    }
                    setPreviewSigOn(v => !v);
                  }}
                >
                  <PenLine className="w-3.5 h-3.5 mr-1" />
                  P.SIGNATURE
                </Button>
                <Button size="sm" variant="outline"
                  className="text-green-700 border-green-300 disabled:opacity-60"
                  disabled={!!stampingId}
                  onClick={() => {
                    if (!viewRecord) return;
                    if (previewStampOn || previewSigOn) {
                      const mode = previewStampOn && previewSigOn ? "both" : previewStampOn ? "stamp" : "signature";
                      handleStampSign(viewRecord, mode);
                    } else if (blobUrl) {
                      const a = document.createElement("a");
                      a.href = blobUrl;
                      a.download = viewRecord.fileName;
                      a.click();
                    } else {
                      downloadAuthed(`${BASE}api/lpo-acknowledgments/${viewRecord.id}/file?download=1`, viewRecord.fileName);
                    }
                  }}>
                  {stampingId === viewRecord?.id
                    ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    : <Download className="w-3.5 h-3.5 mr-1.5" />}
                  Download
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto bg-gray-100 flex flex-col items-center py-4 gap-3">
            {viewRecord && !blobUrl && (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground text-sm">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span>Loading PDF…</span>
              </div>
            )}
            {viewRecord && blobUrl && (
              <Document
                file={blobUrl}
                onLoadSuccess={({ numPages: n }) => setNumPages(n)}
                onLoadError={() => {
                  toast({ title: "Could not render PDF", variant: "destructive" });
                  if (viewRecord) window.open(blobUrl!, "_blank");
                }}
                loading={
                  <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground text-sm mt-20">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span>Rendering pages…</span>
                  </div>
                }
              >
                {Array.from({ length: numPages }, (_, i) => {
                  const isLast = i === numPages - 1;
                  const company = (companies ?? []).find(c => c.id === viewRecord?.companyId);
                  const stampUrl = (company as any)?.stamp ?? null;
                  const sigUrl = user?.signatureUrl ?? null;
                  const showStamp = isLast && previewStampOn && stampUrl;
                  const showSig = isLast && previewSigOn && sigUrl;
                  return (
                    <div key={i + 1} className="relative shadow-md mb-2">
                      <Page
                        pageNumber={i + 1}
                        renderTextLayer={true}
                        renderAnnotationLayer={false}
                      />
                      {showSig && (
                        <img
                          src={sigUrl}
                          alt="Signature"
                          style={{
                            position: "absolute",
                            bottom: 36,
                            left: 36,
                            maxHeight: 56,
                            maxWidth: 150,
                            objectFit: "contain",
                            opacity: 0.85,
                            pointerEvents: "none",
                          }}
                        />
                      )}
                      {showStamp && (
                        <img
                          src={stampUrl}
                          alt="Stamp"
                          style={{
                            position: "absolute",
                            bottom: 24,
                            right: 36,
                            maxHeight: 90,
                            maxWidth: 180,
                            objectFit: "contain",
                            opacity: 0.85,
                            pointerEvents: "none",
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </Document>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Replace file input ─── */}
      <input
        ref={replaceFileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleReplaceFileSelect}
      />

      {/* ─── Delete confirmation ─── */}
      <AlertDialog open={!!deleteRecord} onOpenChange={open => { if (!open) setDeleteRecord(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Acknowledgment</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete the acknowledgment for <strong>{deleteRecord?.customerName}</strong> ({deleteRecord?.fileName})? This cannot be undone.
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
