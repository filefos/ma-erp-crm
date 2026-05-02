import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileText, FileSpreadsheet, ChevronDown, Printer } from "lucide-react";

interface ExportButtonsProps {
  docNumber: string;
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

export function ExportButtons({ docNumber }: ExportButtonsProps) {
  const handlePrint = () => {
    const prev = document.title;
    document.title = docNumber;
    window.print();
    setTimeout(() => { document.title = prev; }, 3000);
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

  const handleExcel = () => {
    const el = getPrintEl();
    if (!el) return;
    const tables = Array.from(el.querySelectorAll("table"));
    if (tables.length === 0) return;

    const wb = XLSX.utils.book_new();
    const sheetNames = ["Company-Client", "Line Items", "Additional Items", "Totals", "Sheet5"];

    tables.forEach((tbl, idx) => {
      const ws = XLSX.utils.table_to_sheet(tbl as HTMLTableElement, { raw: false });
      const cols: XLSX.ColInfo[] = [];
      const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
      for (let c = range.s.c; c <= range.e.c; c++) cols.push({ wch: 22 });
      ws["!cols"] = cols;
      const name = (sheetNames[idx] ?? `Sheet${idx + 1}`).slice(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, name);
    });

    XLSX.writeFile(wb, `${docNumber}.xlsx`);
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
          <DropdownMenuItem onClick={handleExcel}>
            <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" />
            Excel Spreadsheet (.xlsx)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button size="sm" variant="outline" onClick={handlePrint}>
        <Printer className="w-4 h-4 mr-1" />Print / PDF
      </Button>
    </>
  );
}
