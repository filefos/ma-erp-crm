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
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { captureElementToPdfBase64 } from "@/lib/print-to-pdf";

interface ExportButtonsProps {
  docNumber: string;
  /** Optional default WhatsApp number for the recipient (any format). */
  recipientPhone?: string;
  /** Optional document type label, e.g. "Quotation", "Tax Invoice". */
  docTypeLabel?: string;
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

export function ExportButtons({ docNumber, recipientPhone, docTypeLabel }: ExportButtonsProps) {
  const { toast } = useToast();
  const [waOpen, setWaOpen] = useState(false);
  const [waPhone, setWaPhone] = useState(recipientPhone ?? "");
  const [waMessage, setWaMessage] = useState(
    `Dear Sir/Madam,\n\nPlease find attached ${docTypeLabel ?? "document"} ${docNumber} for your kind reference.\n\nKindly review and revert.\n\nBest regards.`,
  );
  const [sending, setSending] = useState(false);

  const handlePrint = () => {
    const prev = document.title;
    document.title = docNumber;
    window.print();
    setTimeout(() => { document.title = prev; }, 3000);
  };

  const handleSendViaWhatsApp = () => {
    setWaOpen(true);
  };

  const handleSendNow = async () => {
    const digits = normalizePhone(waPhone);
    if (!digits) {
      toast({ title: "Phone number required", description: "Enter the recipient's WhatsApp number with country code.", variant: "destructive" });
      return;
    }
    const el = getPrintEl();
    if (!el) {
      toast({ title: "Document not ready", description: "Could not find the printable document on this page.", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      toast({ title: "Preparing PDF…", description: `Building ${docTypeLabel ?? "document"} ${docNumber}` });
      const { base64, filename } = await captureElementToPdfBase64(el, `${docNumber}.pdf`);

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
        toast({
          title: "WhatsApp send failed",
          description: json?.message ?? `HTTP ${resp.status}`,
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Sent via WhatsApp ✓", description: `Delivered to +${digits}` });
      setWaOpen(false);
    } catch (err) {
      toast({
        title: "Send failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleWord = () => {
    const el = getPrintEl();
    if (!el) return;
    const html = buildWordHtml(el.innerHTML);
    const blob = new Blob(["\ufeff", html], {
      type: "application/msword;charset=utf-8",
    });
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
      for (const row of rows) {
        ws.addRow(row);
      }
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
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
        onClick={handleSendViaWhatsApp}
        className="bg-[#25D366] hover:bg-[#1ea952] text-white border-0"
      >
        <MessageCircle className="w-4 h-4 mr-1" />Send via WhatsApp
      </Button>

      <Dialog open={waOpen} onOpenChange={(o) => { if (!sending) setWaOpen(o); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#0f2d5a]">
              <MessageCircle className="w-5 h-5 text-[#25D366]" />
              Send {docTypeLabel ?? "document"} {docNumber}
            </DialogTitle>
            <DialogDescription>
              Enter the recipient's WhatsApp number with country code (e.g. 9715XXXXXXXX).
              The PDF will be delivered to their WhatsApp directly — no other steps required.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-1">
            <div className="space-y-1">
              <Label htmlFor="wa-phone">WhatsApp Number *</Label>
              <Input
                id="wa-phone"
                value={waPhone}
                onChange={(e) => setWaPhone(e.target.value)}
                placeholder="971501234567"
                inputMode="tel"
                autoFocus
                disabled={sending}
              />
              <p className="text-[11px] text-gray-500">
                Country code required. Spaces and symbols are ignored.
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="wa-message">Message (sent as caption)</Label>
              <Textarea
                id="wa-message"
                value={waMessage}
                onChange={(e) => setWaMessage(e.target.value)}
                rows={5}
                disabled={sending}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => void handleSendNow()}
              disabled={sending || !normalizePhone(waPhone)}
              className="bg-[#25D366] hover:bg-[#1ea952] text-white w-full sm:w-auto"
            >
              {sending ? (
                <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Sending…</>
              ) : (
                <><MessageCircle className="w-4 h-4 mr-1" />Send Now</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
