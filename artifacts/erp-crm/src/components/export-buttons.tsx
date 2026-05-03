import { useState } from "react";
import ExcelJS from "exceljs";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Download,
  FileText,
  FileSpreadsheet,
  ChevronDown,
  Printer,
  MessageCircle,
  Mail,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { captureElementToPdfBase64 } from "@/lib/print-to-pdf";

interface ExportButtonsProps {
  docNumber: string;
  recipientPhone?: string;
  recipientEmail?: string;
  docTypeLabel?: string;
  companyId?: number;
}

function normalizePhone(raw: string): string {
  return (raw || "").replace(/[^0-9]/g, "");
}

function getPrintEl(): HTMLElement | null {
  return document.querySelector(".print-doc");
}

function buildWordHtml(innerHtml: string): string {
  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="UTF-8" />
  <meta name="ProgId" content="Word.Document" />
  <meta name="Generator" content="Microsoft Word 15" />
  <!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View>
    <w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]-->
  <style>
    @page WordSection1 { size: 210mm 297mm; margin: 15mm 12mm; }
    div.WordSection1 { page: WordSection1; }
    body { font-family: Arial, sans-serif; font-size: 10pt; color: #000; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 6pt; }
    td, th { border: 0.5pt solid #9ca3af; padding: 3pt 5pt; font-size: 9pt; }
    img { max-width: 120pt; }
  </style>
</head>
<body>
  <div class="WordSection1">${innerHtml}</div>
</body>
</html>`;
}

function extractTableRows(table: HTMLTableElement): (string | number)[][] {
  const rows: (string | number)[][] = [];
  for (const tr of Array.from(table.rows)) {
    const cells: (string | number)[] = [];
    for (const cell of Array.from(tr.cells)) {
      const text = (cell.textContent ?? "").trim();
      const num = Number(text.replace(/,/g, ""));
      cells.push(!isNaN(num) && text !== "" ? num : text);
    }
    rows.push(cells);
  }
  return rows;
}

export function ExportButtons({ docNumber, recipientPhone, recipientEmail, docTypeLabel, companyId }: ExportButtonsProps) {
  const { toast } = useToast();
  const label = docTypeLabel ?? "document";

  // WhatsApp dialog state
  const [waOpen, setWaOpen] = useState(false);
  const [waPhone, setWaPhone] = useState(recipientPhone ?? "");
  const [waMessage, setWaMessage] = useState(
    `Dear Sir/Madam,\n\nPlease find attached ${label} ${docNumber} for your kind reference.\n\nKindly review and revert.\n\nBest regards.`,
  );
  const [waSending, setWaSending] = useState(false);

  // Email dialog state
  const [mailOpen, setMailOpen] = useState(false);
  const [mailTo, setMailTo] = useState(recipientEmail ?? "");
  const [mailSubject, setMailSubject] = useState(`${label} ${docNumber}`);
  const [mailBody, setMailBody] = useState(
    `Dear Sir/Madam,\n\nPlease find attached ${label} ${docNumber} for your kind reference.\n\nKindly review and revert.\n\nBest regards.`,
  );
  const [mailSending, setMailSending] = useState(false);

  const handlePrint = () => {
    const prev = document.title;
    document.title = docNumber;
    window.print();
    setTimeout(() => { document.title = prev; }, 3000);
  };

  const generatePdf = async () => {
    const el = getPrintEl();
    if (!el) throw new Error("Could not find the printable document on this page.");
    return captureElementToPdfBase64(el, `${docNumber}.pdf`);
  };

  const handleWhatsAppSend = async () => {
    const digits = normalizePhone(waPhone);
    if (!digits) {
      toast({ title: "Phone number required", description: "Enter the recipient's WhatsApp number with country code.", variant: "destructive" });
      return;
    }
    setWaSending(true);
    try {
      toast({ title: "Preparing PDF…", description: `Building ${label} ${docNumber}` });
      const { base64, filename } = await generatePdf();
      const resp = await fetch("/api/whatsapp/send-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          to: digits,
          filename,
          contentBase64: base64,
          contentType: "application/pdf",
          caption: waMessage,
        }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        toast({ title: "WhatsApp send failed", description: json?.message ?? `HTTP ${resp.status}`, variant: "destructive" });
        return;
      }
      toast({ title: "Sent via WhatsApp ✓", description: `Delivered to +${digits}` });
      setWaOpen(false);
    } catch (err) {
      toast({ title: "Send failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setWaSending(false);
    }
  };

  const handleEmailSend = async () => {
    const to = mailTo.trim();
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      toast({ title: "Email required", description: "Enter a valid recipient email address.", variant: "destructive" });
      return;
    }
    setMailSending(true);
    try {
      toast({ title: "Preparing PDF…", description: `Building ${label} ${docNumber}` });
      const { base64, filename } = await generatePdf();
      const resp = await fetch("/api/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "send",
          companyId: companyId ?? null,
          toAddress: to,
          subject: mailSubject,
          body: mailBody,
          attachments: [{ filename, content: base64, contentType: "application/pdf" }],
        }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        toast({ title: "Email send failed", description: json?.message ?? `HTTP ${resp.status}`, variant: "destructive" });
        return;
      }
      toast({ title: "Email sent ✓", description: `Delivered to ${to}` });
      setMailOpen(false);
    } catch (err) {
      toast({ title: "Send failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setMailSending(false);
    }
  };

  const handleWord = () => {
    const el = getPrintEl();
    if (!el) return;
    const html = buildWordHtml(el.innerHTML);
    const blob = new Blob(["\ufeff", html], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${docNumber}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExcel = async () => {
    const el = getPrintEl();
    if (!el) return;
    const tables = Array.from(el.querySelectorAll("table")) as HTMLTableElement[];
    if (tables.length === 0) return;
    const wb = new ExcelJS.Workbook();
    const sheetNames = ["Company-Client", "Line Items", "Additional Items", "Totals", "Sheet5"];
    for (let idx = 0; idx < tables.length; idx++) {
      const tbl = tables[idx];
      const name = (sheetNames[idx] ?? `Sheet${idx + 1}`).slice(0, 31);
      const ws = wb.addWorksheet(name);
      const rows = extractTableRows(tbl);
      const maxCols = rows.reduce((m, r) => Math.max(m, r.length), 0);
      ws.columns = Array.from({ length: maxCols }, () => ({ width: 22 }));
      for (const row of rows) ws.addRow(row);
    }
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${docNumber}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline">
            <Download className="w-4 h-4 mr-1" />
            Export
            <ChevronDown className="w-3.5 h-3.5 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2 text-gray-600" />
            PDF (Print → Save as PDF)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleWord}>
            <FileText className="w-4 h-4 mr-2 text-blue-600" />
            Word Document (.doc)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void handleExcel()}>
            <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" />
            Excel Spreadsheet (.xlsx)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button size="sm" variant="outline" onClick={handlePrint}>
        <Printer className="w-4 h-4 mr-1" />Print / PDF
      </Button>

      <Button
        size="sm"
        onClick={() => setWaOpen(true)}
        className="bg-[#25D366] hover:bg-[#1ea952] text-white border-0"
      >
        <MessageCircle className="w-4 h-4 mr-1" />Send via WhatsApp
      </Button>

      <Button
        size="sm"
        onClick={() => setMailOpen(true)}
        className="bg-[#1e6ab0] hover:bg-[#0f2d5a] text-white border-0"
      >
        <Mail className="w-4 h-4 mr-1" />Send via Email
      </Button>

      {/* WhatsApp dialog */}
      <Dialog open={waOpen} onOpenChange={(o) => { if (!waSending) setWaOpen(o); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#0f2d5a]">
              <MessageCircle className="w-5 h-5 text-[#25D366]" />
              Send {label} {docNumber} via WhatsApp
            </DialogTitle>
            <DialogDescription>
              Enter the recipient's WhatsApp number with country code (e.g. 9715XXXXXXXX). The PDF is delivered to their WhatsApp directly.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="space-y-1">
              <Label htmlFor="wa-phone">WhatsApp Number *</Label>
              <Input id="wa-phone" value={waPhone} onChange={(e) => setWaPhone(e.target.value)} placeholder="971501234567" inputMode="tel" autoFocus disabled={waSending} />
              <p className="text-[11px] text-gray-500">Country code required. Spaces and symbols are ignored.</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="wa-message">Message (sent as caption)</Label>
              <Textarea id="wa-message" value={waMessage} onChange={(e) => setWaMessage(e.target.value)} rows={5} disabled={waSending} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => void handleWhatsAppSend()} disabled={waSending || !normalizePhone(waPhone)} className="bg-[#25D366] hover:bg-[#1ea952] text-white w-full sm:w-auto">
              {waSending ? (<><Loader2 className="w-4 h-4 mr-1 animate-spin" />Sending…</>) : (<><MessageCircle className="w-4 h-4 mr-1" />Send Now</>)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email dialog */}
      <Dialog open={mailOpen} onOpenChange={(o) => { if (!mailSending) setMailOpen(o); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#0f2d5a]">
              <Mail className="w-5 h-5 text-[#1e6ab0]" />
              Send {label} {docNumber} via Email
            </DialogTitle>
            <DialogDescription>
              Enter the recipient's email. The PDF is attached and delivered immediately via your company's email account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="space-y-1">
              <Label htmlFor="mail-to">Recipient Email *</Label>
              <Input id="mail-to" type="email" value={mailTo} onChange={(e) => setMailTo(e.target.value)} placeholder="client@example.com" autoFocus disabled={mailSending} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="mail-subject">Subject</Label>
              <Input id="mail-subject" value={mailSubject} onChange={(e) => setMailSubject(e.target.value)} disabled={mailSending} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="mail-body">Message</Label>
              <Textarea id="mail-body" value={mailBody} onChange={(e) => setMailBody(e.target.value)} rows={5} disabled={mailSending} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => void handleEmailSend()} disabled={mailSending || !mailTo.trim()} className="bg-[#1e6ab0] hover:bg-[#0f2d5a] text-white w-full sm:w-auto">
              {mailSending ? (<><Loader2 className="w-4 h-4 mr-1 animate-spin" />Sending…</>) : (<><Mail className="w-4 h-4 mr-1" />Send Now</>)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
