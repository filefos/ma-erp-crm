import { useState, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { useListQuotations, useListCompanies } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

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
import { Search, Upload, Eye, Download, Trash2, RefreshCw, FileText, X, CheckCircle2, Loader2, Stamp, PenLine, ArrowLeft, Printer, Mail, ChevronDown, Sheet } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { authHeaders } from "@/lib/ai-client";
import { HelpButton } from "@/components/help-button";
import { captureElementToPdfBase64 } from "@/lib/print-to-pdf";
import { useEmailCompose } from "@/contexts/email-compose-context";

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
  const { openCompose } = useEmailCompose();

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
  const [acPickOpen, setAcPickOpen] = useState(false);
  const [acPickId, setAcPickId] = useState<number | null>(null);
  const [acLetterRecord, setAcLetterRecord] = useState<AckRecord | null>(null);
  const [acPreviewOpen, setAcPreviewOpen] = useState(false);
  const [acPdfGenerating, setAcPdfGenerating] = useState(false);
  const [acStampOn, setAcStampOn] = useState(false);
  const [acSigOn, setAcSigOn] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);
  const acLetterRef = useRef<HTMLDivElement>(null);

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

  async function appendAckLetter(pdfDoc: PDFDocument, record: AckRecord) {
    const company = (companies ?? []).find(c => c.id === (record.companyId ?? activeCompanyId));
    const ourName = (company as any)?.name || "Our Company";
    const clientName = record.customerName || "Client";
    const lpoRef = record.lpoNumber ? `LPO No. ${record.lpoNumber}` : "the above-referenced LPO";
    const qtRef = record.quotationNumber ? ` (Quotation No. ${record.quotationNumber})` : "";
    const today = new Date().toLocaleDateString("en-AE", { day: "2-digit", month: "long", year: "numeric" });

    const page = pdfDoc.addPage([595, 842]);
    const { width, height } = page.getSize();
    const mx = 50;
    const cw = width - mx * 2;

    const fReg = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const navy = rgb(0.07, 0.17, 0.35);
    const dark = rgb(0.1, 0.1, 0.1);
    const grey = rgb(0.4, 0.4, 0.4);

    const wrap = (text: string, font: typeof fReg, size: number, maxW: number): string[] => {
      const words = text.split(" ");
      const lines: string[] = [];
      let line = "";
      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(test, size) > maxW && line) { lines.push(line); line = word; }
        else { line = test; }
      }
      if (line) lines.push(line);
      return lines;
    };

    let y = height - 50;

    // Logo (top-left)
    const logoSrc = (company as any)?.logo ?? null;
    if (logoSrc) {
      try {
        const { bytes, isPng } = await fetchImageBytes(logoSrc);
        const logoImg = isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
        const s = logoImg.scaleToFit(130, 60);
        page.drawImage(logoImg, { x: mx, y: y - s.height + 10, width: s.width, height: s.height });
      } catch { /* logo unavailable */ }
    }

    // Company info (right-aligned)
    page.drawText(ourName, { x: width - mx - fBold.widthOfTextAtSize(ourName, 13), y, font: fBold, size: 13, color: navy });
    y -= 16;
    const details = [
      (company as any)?.address,
      (company as any)?.phone ? `Tel: ${(company as any).phone}` : null,
      (company as any)?.email,
      (company as any)?.trn ? `TRN: ${(company as any).trn}` : null,
    ].filter(Boolean) as string[];
    for (const d of details) {
      page.drawText(d, { x: width - mx - fReg.widthOfTextAtSize(d, 8), y, font: fReg, size: 8, color: grey });
      y -= 11;
    }
    y -= 10;

    // Divider
    page.drawLine({ start: { x: mx, y }, end: { x: width - mx, y }, thickness: 0.8, color: navy });
    y -= 18;

    // Date & refs
    page.drawText(`Date: ${today}`, { x: mx, y, font: fReg, size: 9, color: dark }); y -= 13;
    const refs = [record.lpoNumber && `LPO No: ${record.lpoNumber}`, record.quotationNumber && `Quotation No: ${record.quotationNumber}`].filter(Boolean).join("   |   ");
    if (refs) { page.drawText(`Ref: ${refs}`, { x: mx, y, font: fReg, size: 9, color: dark }); y -= 13; }
    y -= 8;

    // Addressee
    page.drawText("To,", { x: mx, y, font: fReg, size: 9, color: dark }); y -= 13;
    page.drawText(clientName, { x: mx, y, font: fBold, size: 10, color: dark }); y -= 18;

    page.drawText("Dear Sir/Madam,", { x: mx, y, font: fReg, size: 10, color: dark }); y -= 16;

    // Subject (centred)
    const subj = "ACKNOWLEDGEMENT OF LOCAL PURCHASE ORDER";
    page.drawText(subj, { x: (width - fBold.widthOfTextAtSize(subj, 11)) / 2, y, font: fBold, size: 11, color: navy });
    y -= 22;

    // Body paragraphs
    const paras = [
      `We are pleased to acknowledge receipt of your Local Purchase Order ${lpoRef} and confirm our formal acceptance of the order as detailed therein.`,
      `${ourName} hereby accepts the terms and conditions set forth in the above LPO and commits to fulfilling the supply of goods and/or services as specified, in accordance with the agreed delivery schedule, payment terms, and quality standards${qtRef}.`,
      `${clientName}, by issuing the above LPO, acknowledges and agrees to the terms and conditions of ${ourName}, including the pricing, scope of work, payment terms, and delivery timelines as confirmed in the referenced quotation and the LPO.`,
      `Both parties mutually agree that this acknowledgement serves as a binding confirmation of the transaction, and both ${ourName} and ${clientName} are committed to fulfilling their respective obligations as outlined in the referenced documents.`,
      `We look forward to a successful business relationship and the timely execution of this order. Should you require any further clarification, please do not hesitate to contact us.`,
    ];
    for (const para of paras) {
      for (const line of wrap(para, fReg, 9.5, cw)) {
        if (y < 160) break;
        page.drawText(line, { x: mx, y, font: fReg, size: 9.5, color: dark });
        y -= 14;
      }
      y -= 8;
    }

    y -= 14;
    page.drawText("Yours faithfully,", { x: mx, y, font: fReg, size: 9.5, color: dark }); y -= 40;

    // Dual signature blocks
    const c1 = mx;
    const c2 = mx + cw / 2;
    page.drawText(`For ${ourName}`, { x: c1, y, font: fBold, size: 9.5, color: dark });
    page.drawText(`For ${clientName}`, { x: c2, y, font: fBold, size: 9.5, color: dark });
    y -= 50;
    page.drawLine({ start: { x: c1, y }, end: { x: c1 + 180, y }, thickness: 0.5, color: dark });
    page.drawLine({ start: { x: c2, y }, end: { x: c2 + 180, y }, thickness: 0.5, color: dark });
    y -= 12;
    page.drawText("Authorized Signatory", { x: c1, y, font: fReg, size: 8, color: grey });
    page.drawText("Authorized Signatory", { x: c2, y, font: fReg, size: 8, color: grey });
    y -= 12;
    page.drawText(ourName, { x: c1, y, font: fReg, size: 8, color: grey });
    page.drawText(clientName, { x: c2, y, font: fReg, size: 8, color: grey });
  }

  function openAckLetterPreview(record: AckRecord) {
    setAcLetterRecord(record);
    setAcPickOpen(false);
    setAcPreviewOpen(true);
  }

  async function downloadAckLetterPdf() {
    if (!acLetterRef.current || !acLetterRecord) return;
    setAcPdfGenerating(true);
    try {
      const filename = `Acknowledgement_Letter_${acLetterRecord.lpoNumber ?? acLetterRecord.id}.pdf`;
      const { base64 } = await captureElementToPdfBase64(acLetterRef.current, filename);
      const link = document.createElement("a");
      link.href = `data:application/pdf;base64,${base64}`;
      link.download = filename;
      link.click();
    } catch {
      toast({ title: "PDF generation failed", variant: "destructive" });
    } finally {
      setAcPdfGenerating(false);
    }
  }

  async function handleStampSign(record: AckRecord, mode: "stamp" | "signature" | "both") {
    const sigUrl = (user as any)?.signatureUrl ?? null;
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
      const margin = 36;
      const stampH = 120;
      const sigH = 60;

      let stampImg = null as Awaited<ReturnType<typeof pdfDoc.embedPng>> | null;
      let sigImg = null as Awaited<ReturnType<typeof pdfDoc.embedPng>> | null;

      if ((mode === "stamp" || mode === "both") && stampUrl) {
        const { bytes, isPng } = await fetchImageBytes(stampUrl);
        stampImg = isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
      }
      if ((mode === "signature" || mode === "both") && sigUrl) {
        const { bytes, isPng } = await fetchImageBytes(sigUrl);
        sigImg = isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
      }

      for (const page of pages) {
        const { width } = page.getSize();
        let stampX = width - margin;
        if (stampImg) {
          const scaled = stampImg.scaleToFit(170, stampH);
          stampX = width - margin - scaled.width;
          page.drawImage(stampImg, {
            x: stampX,
            y: margin,
            width: scaled.width,
            height: scaled.height,
            opacity: 0.85,
          });
        }
        if (sigImg) {
          const scaled = sigImg.scaleToFit(80, 40);
          const sigX = stampImg ? stampX - scaled.width - 8 : width - margin - scaled.width;
          page.drawImage(sigImg, {
            x: sigX,
            y: margin,
            width: scaled.width,
            height: scaled.height,
            opacity: 0.85,
          });
        }
      }

      await appendAckLetter(pdfDoc, record);

      const stamped = await pdfDoc.save();
      const blob = new Blob([stamped.buffer as ArrayBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const suffix = mode === "both" ? "_stamped_signed" : mode === "stamp" ? "_stamped" : "_signed";
      a.href = url;
      a.download = record.fileName.replace(/\.pdf$/i, "") + suffix + ".pdf";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast({ title: "Done", description: "PDF downloaded with acknowledgement letter." });
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
            size="sm"
            variant="outline"
            className="border-amber-500 text-amber-700 hover:bg-amber-50 font-semibold"
            onClick={() => { setAcPickId(null); setAcPickOpen(true); }}
          >
            <FileText className="w-3.5 h-3.5 mr-1.5" /> AC LETTER
          </Button>
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
                    if (!previewSigOn && !(user as any)?.signatureUrl) {
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
                    } else {
                      // Always append the ack letter even for plain download
                      setStampingId(viewRecord.id);
                      (async () => {
                        try {
                          const pdfRes = await fetch(`${BASE}api/lpo-acknowledgments/${viewRecord.id}/file`, { headers: authHeaders() });
                          if (!pdfRes.ok) throw new Error("Could not fetch PDF");
                          const pdfBytes = new Uint8Array(await pdfRes.arrayBuffer());
                          const pdfDoc = await PDFDocument.load(pdfBytes);
                          await appendAckLetter(pdfDoc, viewRecord);
                          const out = await pdfDoc.save();
                          const blob = new Blob([out.buffer as ArrayBuffer], { type: "application/pdf" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = viewRecord.fileName.replace(/\.pdf$/i, "") + "_with_ack.pdf";
                          a.click();
                          setTimeout(() => URL.revokeObjectURL(url), 5000);
                          toast({ title: "Done", description: "PDF downloaded with acknowledgement letter." });
                        } catch (e: any) {
                          toast({ title: "Download failed", description: e.message, variant: "destructive" });
                        } finally {
                          setStampingId(null);
                        }
                      })();
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
                {(() => {
                  const company = (companies ?? []).find(c => c.id === viewRecord?.companyId);
                  const stampUrl = (company as any)?.stamp ?? null;
                  const sigUrl = (user as any)?.signatureUrl ?? null;
                  return Array.from({ length: numPages }, (_, i) => (
                    <div key={i + 1} className="relative shadow-md mb-2">
                      <Page
                        pageNumber={i + 1}
                        renderTextLayer={true}
                        renderAnnotationLayer={false}
                      />
                      {((previewStampOn && stampUrl) || (previewSigOn && sigUrl)) && (
                        <div style={{
                          position: "absolute",
                          bottom: 20,
                          right: 36,
                          display: "flex",
                          flexDirection: "row",
                          alignItems: "flex-end",
                          gap: 8,
                          pointerEvents: "none",
                        }}>
                          {previewSigOn && sigUrl && (
                            <img
                              src={sigUrl}
                              alt="Signature"
                              style={{ maxHeight: 40, maxWidth: 90, objectFit: "contain", opacity: 0.85 }}
                            />
                          )}
                          {previewStampOn && stampUrl && (
                            <img
                              src={stampUrl}
                              alt="Stamp"
                              style={{ maxHeight: 100, maxWidth: 190, objectFit: "contain", opacity: 0.85 }}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  ));
                })()}
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

      {/* ─── AC LETTER: record picker ─── */}
      <Dialog open={acPickOpen} onOpenChange={v => { setAcPickOpen(v); if (!v) setAcPickId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-600" />
              Generate Acknowledgement Letter
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">Select acknowledgment record</Label>
              <Select value={acPickId ? String(acPickId) : ""} onValueChange={v => setAcPickId(Number(v))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a record…" />
                </SelectTrigger>
                <SelectContent>
                  {(records ?? []).map(r => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      <span className="font-mono text-xs font-semibold text-blue-900 mr-2">{r.lpoNumber ?? "—"}</span>
                      <span className="text-sm">{r.customerName}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {acPickId && (() => {
              const r = (records ?? []).find(x => x.id === acPickId);
              return r ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm space-y-1">
                  <div><span className="text-muted-foreground text-xs uppercase tracking-wide">Client:</span> <strong>{r.customerName}</strong></div>
                  {r.lpoNumber && <div><span className="text-muted-foreground text-xs uppercase tracking-wide">LPO No:</span> {r.lpoNumber}</div>}
                  {r.quotationNumber && <div><span className="text-muted-foreground text-xs uppercase tracking-wide">Quotation No:</span> {r.quotationNumber}</div>}
                </div>
              ) : null;
            })()}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setAcPickOpen(false)}>Cancel</Button>
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white"
                disabled={!acPickId}
                onClick={() => {
                  const rec = (records ?? []).find(r => r.id === acPickId);
                  if (rec) openAckLetterPreview(rec);
                }}
              >
                <FileText className="w-3.5 h-3.5 mr-1.5" />Open Letter
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── AC LETTER: Document Preview ─── */}
      <Dialog open={acPreviewOpen} onOpenChange={v => { setAcPreviewOpen(v); if (!v) setAcLetterRecord(null); }}>
        <DialogContent className="max-w-5xl h-[95vh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogTitle className="sr-only">Acknowledgement Letter Preview</DialogTitle>

          {/* ── Top toolbar (light, matching quotation detail style) ── */}
          <div className="shrink-0 border-b bg-white">
            {/* Row 1: back + title + badges */}
            <div className="flex items-center gap-2 px-4 py-2 border-b">
              <Button size="sm" variant="ghost" className="text-slate-600 hover:text-slate-900 -ml-1"
                onClick={() => setAcPreviewOpen(false)}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <div className="h-4 w-px bg-slate-200" />
              <FileText className="w-4 h-4 text-[#0f2d5a]" />
              <span className="font-semibold text-[#0f2d5a] text-sm">Acknowledgement Letter</span>
              {acLetterRecord?.lpoNumber && (
                <span className="inline-flex items-center rounded border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs font-mono text-slate-600">
                  {acLetterRecord.lpoNumber}
                </span>
              )}
              {acLetterRecord?.customerName && (
                <span className="inline-flex items-center rounded bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs text-blue-700">
                  {acLetterRecord.customerName}
                </span>
              )}
            </div>

            {/* Row 2: action buttons */}
            <div className="flex items-center gap-2 px-4 py-2">
              {/* P.STAMP toggle */}
              <Button size="sm"
                variant={acStampOn ? "default" : "outline"}
                className={acStampOn
                  ? "bg-purple-700 text-white hover:bg-purple-800"
                  : "text-purple-700 border-purple-300 hover:bg-purple-50"}
                onClick={() => {
                  if (!acStampOn) {
                    const co = (companies ?? []).find(c => c.id === (acLetterRecord?.companyId ?? activeCompanyId));
                    if (!(co as any)?.stamp) {
                      toast({ title: "No stamp configured", description: "Go to Admin → Companies and upload a company stamp.", variant: "destructive" });
                      return;
                    }
                  }
                  setAcStampOn(v => !v);
                }}>
                <Stamp className="w-3.5 h-3.5 mr-1" />P.STAMP
              </Button>

              {/* P.SIGNATURE toggle */}
              <Button size="sm"
                variant={acSigOn ? "default" : "outline"}
                className={acSigOn
                  ? "bg-orange-600 text-white hover:bg-orange-700"
                  : "text-orange-700 border-orange-300 hover:bg-orange-50"}
                onClick={() => {
                  if (!acSigOn && !(user as any)?.signatureUrl) {
                    toast({ title: "No signature uploaded", description: "Go to your Profile settings and upload a signature.", variant: "destructive" });
                    return;
                  }
                  setAcSigOn(v => !v);
                }}>
                <PenLine className="w-3.5 h-3.5 mr-1" />P.SIGNATURE
              </Button>

              <div className="h-4 w-px bg-slate-200" />

              <Button size="sm" variant="outline" disabled={acPdfGenerating} onClick={downloadAckLetterPdf}
                className="border-slate-300 text-slate-700 hover:bg-slate-50">
                {acPdfGenerating
                  ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Generating…</>
                  : <><Download className="w-3.5 h-3.5 mr-1.5" />Download PDF</>}
              </Button>

              <Button size="sm" variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  if (!acLetterRecord) return;
                  const co = (companies ?? []).find(c => c.id === (acLetterRecord.companyId ?? activeCompanyId)) as any;
                  openCompose({
                    to: acLetterRecord.customerName ? [acLetterRecord.customerName] : [],
                    subject: `Acknowledgement Letter${acLetterRecord.lpoNumber ? ` – LPO No. ${acLetterRecord.lpoNumber}` : ""}`,
                    body: `Dear Sir/Madam,\n\nPlease find attached our Acknowledgement Letter for ${acLetterRecord.lpoNumber ? `LPO No. ${acLetterRecord.lpoNumber}` : "the above-referenced LPO"}.\n\nKindly review and confirm receipt.\n\nWarm regards,\n${co?.name ?? ""}`,
                  });
                }}>
                <Mail className="w-3.5 h-3.5 mr-1.5" />Send Email
              </Button>

              <Button size="sm" variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  const el = acLetterRef.current;
                  if (!el) return;
                  const w = window.open("", "_blank");
                  if (!w) return;
                  w.document.write(`<!DOCTYPE html><html><head><title>Acknowledgement Letter</title>
                    <style>*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
                    body{margin:0;padding:0;font-family:Helvetica,Arial,sans-serif;color:#222;background:#fff}
                    @page{size:A4;margin:15mm 18mm}
                    @media print{body{padding:0}}</style></head><body>${el.innerHTML}</body></html>`);
                  w.document.close();
                  setTimeout(() => { w.focus(); w.print(); }, 400);
                }}>
                <Printer className="w-3.5 h-3.5 mr-1.5" />Print / PDF
              </Button>

              {/* ── Export To dropdown ── */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-50">
                    <Download className="w-3.5 h-3.5 mr-1.5" />Export To<ChevronDown className="w-3 h-3 ml-1.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  {/* PDF */}
                  <DropdownMenuItem
                    disabled={acPdfGenerating}
                    onClick={downloadAckLetterPdf}
                    className="gap-2 cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-red-600" />
                    <span>PDF (.pdf)</span>
                    {acPdfGenerating && <Loader2 className="w-3 h-3 ml-auto animate-spin" />}
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  {/* Word */}
                  <DropdownMenuItem
                    className="gap-2 cursor-pointer"
                    onClick={() => {
                      const el = acLetterRef.current;
                      if (!el || !acLetterRecord) return;
                      const co = (companies ?? []).find(c => c.id === (acLetterRecord.companyId ?? activeCompanyId)) as any;
                      const filename = `acknowledgement_letter_${acLetterRecord.lpoNumber ?? "letter"}.doc`;
                      const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office'
                        xmlns:w='urn:schemas-microsoft-com:office:word'
                        xmlns='http://www.w3.org/TR/REC-html40'>
                        <head><meta charset='utf-8'>
                        <style>
                          body{font-family:Calibri,Arial,sans-serif;font-size:11pt;margin:2cm 2.5cm;}
                          table{border-collapse:collapse;width:100%;}
                          td,th{padding:6pt;}
                        </style>
                        <!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View>
                        <w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
                        </head><body>${el.innerHTML}</body></html>`;
                      const blob = new Blob([html], { type: "application/msword" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url; a.download = filename; a.click();
                      setTimeout(() => URL.revokeObjectURL(url), 2000);
                    }}
                  >
                    <FileText className="w-4 h-4 text-blue-700" />
                    <span>Word (.doc)</span>
                  </DropdownMenuItem>

                  {/* Excel / CSV */}
                  <DropdownMenuItem
                    className="gap-2 cursor-pointer"
                    onClick={() => {
                      if (!acLetterRecord) return;
                      const co = (companies ?? []).find(c => c.id === (acLetterRecord.companyId ?? activeCompanyId)) as any;
                      const today = new Date().toLocaleDateString("en-AE", { day: "2-digit", month: "long", year: "numeric" });
                      const rows = [
                        ["Field", "Value"],
                        ["Date", today],
                        ["Our Company", co?.name ?? ""],
                        ["Our Address", co?.address ?? ""],
                        ["Our Phone", co?.phone ?? ""],
                        ["Our Email", co?.email ?? ""],
                        ["Our TRN", co?.trn ?? ""],
                        ["Client / Customer", acLetterRecord.customerName ?? ""],
                        ["LPO Number", acLetterRecord.lpoNumber ?? ""],
                        ["Quotation Number", acLetterRecord.quotationNumber ?? ""],
                        ["Document Type", "Acknowledgement Letter"],
                      ];
                      const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
                      const blob = new Blob([csv], { type: "text/csv" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `acknowledgement_letter_${acLetterRecord.lpoNumber ?? "data"}.csv`;
                      a.click();
                      setTimeout(() => URL.revokeObjectURL(url), 2000);
                    }}
                  >
                    <Sheet className="w-4 h-4 text-green-700" />
                    <span>Excel (.csv)</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* ── Document area ── */}
          <div className="flex-1 overflow-y-auto bg-[#e5e7eb] p-6">
            {acLetterRecord && (() => {
              const companyId = acLetterRecord.companyId ?? activeCompanyId ?? 1;
              // Hardcoded company info matching document-print.tsx exactly
              const CO_INFO: Record<number, { name: string; address: string; phone: string; email: string; contact: string; website?: string }> = {
                1: { name: "PRIME MAX PREFAB HOUSES IND. LLC. SP.", address: "Plot # 2040, Sajja Industrial Area, Sharjah, UAE", phone: "056 616 3555", email: "sales@primemaxprefab.com", contact: "ASIF LATIF", website: "www.primemaxprefab.com" },
                2: { name: "ELITE PREFAB INDUSTRIES LLC", address: "Industrial Area, Dubai, UAE", phone: "+971 55 100 2000", email: "info@eliteprefab.ae", contact: "Sales Team" },
              };
              const co = CO_INFO[companyId] ?? CO_INFO[1];
              const logoSrc = companyId === 2 ? `${BASE}elite-prefab-logo.svg` : `${BASE}prime-max-logo.png`;

              // Pull client contact fields from the linked quotation
              const linkedQt = (quotations ?? []).find((q: any) =>
                acLetterRecord.quotationNumber && q.quotationNumber === acLetterRecord.quotationNumber
              ) as any;
              const clientName      = linkedQt?.clientName ?? acLetterRecord.customerName ?? "Client";
              const clientContact   = linkedQt?.clientContactPerson ?? "—";
              const clientPhone     = linkedQt?.clientPhone ?? "—";
              const clientEmail     = linkedQt?.clientEmail ?? "—";

              const lpoRef = acLetterRecord.lpoNumber ? `LPO No. ${acLetterRecord.lpoNumber}` : "the above-referenced LPO";
              const qtRef  = acLetterRecord.quotationNumber ? ` (Quotation No. ${acLetterRecord.quotationNumber})` : "";
              const today  = new Date().toLocaleDateString("en-AE", { day: "2-digit", month: "long", year: "numeric" });

              const paras = [
                `We are pleased to acknowledge receipt of your Local Purchase Order ${lpoRef} and confirm our formal acceptance of the order as detailed therein.`,
                `${co.name} hereby accepts the terms and conditions set forth in the above LPO and commits to fulfilling the supply of goods and/or services as specified, in accordance with the agreed delivery schedule, payment terms, and quality standards${qtRef}.`,
                `${clientName}, by issuing the above LPO, acknowledges and agrees to the terms and conditions of ${co.name}, including the pricing, scope of work, payment terms, and delivery timelines as confirmed in the referenced quotation and the LPO.`,
                `Both parties mutually agree that this acknowledgement serves as a binding confirmation of the transaction, and both ${co.name} and ${clientName} are committed to fulfilling their respective obligations as outlined in the referenced documents.`,
                `We look forward to a successful business relationship and the timely execution of this order. Should you require any further clarification, please do not hesitate to contact us.`,
              ];

              // Shared inline print styles for table cells
              const navyHdr: React.CSSProperties = { backgroundColor: "#0f2d5a", WebkitPrintColorAdjust: "exact" as any, printColorAdjust: "exact" as any };
              const labelCell: React.CSSProperties = { backgroundColor: "#1e3a6e", WebkitPrintColorAdjust: "exact" as any, printColorAdjust: "exact" as any, color: "#fff", fontWeight: 600, fontSize: 11, padding: "2px 8px", width: "38%", whiteSpace: "nowrap" as const };
              const valCell: React.CSSProperties  = { border: "1px solid #9ca3af", fontSize: 11, padding: "2px 8px" };

              return (
                <div
                  ref={acLetterRef}
                  className="bg-white mx-auto shadow-2xl font-sans text-black"
                  style={{ maxWidth: 850, minHeight: 1123, display: "flex", flexDirection: "column" }}
                >
                  {/* ══ LETTERHEAD — exact match to document-print.tsx ══ */}
                  <div className="overflow-hidden mb-[2px]">
                    <div className="bg-[#0f2d5a] text-white py-2 px-4 flex items-center gap-4" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
                      <img src={logoSrc} alt="Logo" className="object-contain rounded bg-white p-1 flex-shrink-0" style={{ maxHeight: 60, maxWidth: 130, height: "auto" }} />
                      <div className="leading-tight flex-1">
                        <div className="text-[22px] font-black tracking-wider uppercase leading-none">{co.name}</div>
                        <div className="text-[11px] mt-[3px] opacity-90">{co.address}</div>
                        <div className="text-[11px] opacity-90">Tel: {co.phone} | Email: {co.email}{co.website ? ` | Web: ${co.website}` : ""}</div>
                      </div>
                    </div>
                    <div className="bg-[#1e6ab0] text-white text-center py-1" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
                      <span className="text-[15px] font-black tracking-widest uppercase">ACKNOWLEDGEMENT OF LOCAL PURCHASE ORDER</span>
                    </div>
                  </div>

                  {/* ══ COMPANY DETAIL + CLIENT DETAIL — two-column tables ══ */}
                  <div className="flex gap-[2px] mb-[2px]">
                    {/* Company Detail (left) */}
                    <table className="flex-1 border-collapse border border-gray-400" style={{ fontSize: 11 }}>
                      <thead>
                        <tr>
                          <th colSpan={2} className="border border-gray-400 px-2 py-[2px] text-[11px] font-bold text-white text-left" style={navyHdr}>Company Detail</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr><td style={labelCell}>Company</td><td style={valCell}>{co.name}</td></tr>
                        <tr><td style={labelCell}>Contact Person</td><td style={valCell}>{co.contact}</td></tr>
                        <tr><td style={labelCell}>Contact #</td><td style={valCell}>{co.phone}</td></tr>
                        <tr><td style={labelCell}>Email</td><td style={valCell}>{co.email}</td></tr>
                        <tr><td style={labelCell}>LPO No.</td><td style={{ ...valCell, fontWeight: 700, fontFamily: "monospace" }}>{acLetterRecord.lpoNumber ?? "—"}</td></tr>
                        <tr><td style={labelCell}>Quotation Ref.</td><td style={valCell}>{acLetterRecord.quotationNumber ?? "—"}</td></tr>
                        <tr><td style={labelCell}>Date</td><td style={valCell}>{today}</td></tr>
                      </tbody>
                    </table>

                    {/* Client DETAIL (right) */}
                    <table className="flex-1 border-collapse border border-gray-400" style={{ fontSize: 11 }}>
                      <thead>
                        <tr>
                          <th colSpan={2} className="border border-gray-400 px-2 py-[2px] text-[11px] font-bold text-white text-left" style={navyHdr}>Client DETAIL</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr><td style={labelCell}>Company</td><td style={valCell}>{clientName}</td></tr>
                        <tr><td style={labelCell}>Contact Person</td><td style={valCell}>{clientContact !== "—" ? clientContact : ""}</td></tr>
                        <tr><td style={labelCell}>Contact #</td><td style={valCell}>{clientPhone !== "—" ? clientPhone : ""}</td></tr>
                        <tr><td style={labelCell}>Email</td><td style={valCell}>{clientEmail !== "—" ? clientEmail : ""}</td></tr>
                        <tr><td style={labelCell}>LPO No.</td><td style={{ ...valCell, fontWeight: 700, fontFamily: "monospace" }}>{acLetterRecord.lpoNumber ?? "—"}</td></tr>
                        <tr><td style={labelCell}>Quotation Ref.</td><td style={valCell}>{acLetterRecord.quotationNumber ?? "—"}</td></tr>
                        <tr><td style={labelCell}>Date</td><td style={valCell}>{today}</td></tr>
                      </tbody>
                    </table>
                  </div>

                  {/* ══ LETTER BODY ══ */}
                  <div style={{ padding: "20px 24px 0", flex: 1 }}>
                    <div style={{ fontSize: 11, color: "#333", marginBottom: 14 }}>Dear Sir/Madam,</div>

                    {paras.map((p, i) => (
                      <div key={i} style={{ fontSize: 11, color: "#222", lineHeight: 1.85, textAlign: "justify" as const, marginBottom: 13 }}>{p}</div>
                    ))}

                    <div style={{ fontSize: 11, color: "#333", marginTop: 26, marginBottom: 56 }}>Yours faithfully,</div>

                    {/* Dual signature blocks */}
                    {(() => {
                      const coApi = (companies ?? []).find(c => c.id === companyId) as any;
                      const stampUrl = coApi?.stamp ?? null;
                      const sigUrl   = (user as any)?.signatureUrl ?? null;
                      return (
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 40 }}>
                          {/* Our company sig block */}
                          <div style={{ width: "44%", position: "relative" as const }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#0f2d5a", marginBottom: 4 }}>For {co.name}</div>
                            {/* Stamp / signature overlay inside the space above the line */}
                            <div style={{ height: 56, position: "relative" as const, display: "flex", alignItems: "flex-end", gap: 6, paddingBottom: 4 }}>
                              {acSigOn && sigUrl && (
                                <img src={sigUrl} alt="Signature"
                                  style={{ maxHeight: 40, maxWidth: 90, objectFit: "contain", opacity: 0.88 }} />
                              )}
                              {acStampOn && stampUrl && (
                                <img src={stampUrl} alt="Stamp"
                                  style={{ maxHeight: 56, maxWidth: 110, objectFit: "contain", opacity: 0.88 }} />
                              )}
                            </div>
                            <div style={{ borderTop: "1.5px solid #333", width: 200, marginBottom: 6 }} />
                            <div style={{ fontSize: 9.5, color: "#555" }}>Authorized Signatory & Stamp</div>
                            <div style={{ fontSize: 10, color: "#0f2d5a", fontWeight: 600, marginTop: 2 }}>{co.name}</div>
                          </div>
                          {/* Client sig block */}
                          <div style={{ width: "44%", textAlign: "right" as const }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#0f2d5a", marginBottom: 52 }}>For {clientName}</div>
                            <div style={{ borderTop: "1.5px solid #333", width: 200, marginBottom: 6, marginLeft: "auto" }} />
                            <div style={{ fontSize: 9.5, color: "#555" }}>Authorized Signatory & Stamp</div>
                            <div style={{ fontSize: 10, color: "#0f2d5a", fontWeight: 600, marginTop: 2 }}>{clientName}</div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* ══ FOOTER — exact match to PageFooter in document-print.tsx ══ */}
                  <div style={{ padding: "0 24px 12px" }}>
                    <div style={{ textAlign: "center", fontSize: 10, fontStyle: "italic", color: "#0f2d5a", marginBottom: 4 }}>
                      This is a computer generated document.
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10, color: "#0f2d5a", borderTop: "1px solid #0f2d5a", paddingTop: 4 }}>
                      <span style={{ fontFamily: "monospace", letterSpacing: "0.05em" }}>PRIME ERP SYSTEM</span>
                      <span style={{ fontWeight: 600 }}>1-1</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
