import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Printer, FileText, FileSpreadsheet, FileDown, File } from "lucide-react";
import { downloadCSV, downloadExcel, downloadWord, printTable } from "@/lib/export";

export interface ExportColumn {
  header: string;
  key: string;
  format?: (v: unknown) => string;
}

interface ExportMenuProps {
  data: Record<string, unknown>[];
  columns: ExportColumn[];
  filename: string;
  title?: string;
  size?: "sm" | "default";
}

function buildRows(
  data: Record<string, unknown>[],
  columns: ExportColumn[]
): (string | number | null | undefined)[][] {
  const header = columns.map(c => c.header);
  const rows = data.map(row =>
    columns.map(c => {
      const v = row[c.key];
      if (v == null) return "";
      return c.format ? c.format(v) : (v as string | number);
    })
  );
  return [header, ...rows];
}

export function ExportMenu({ data, columns, filename, title, size = "sm" }: ExportMenuProps) {
  const label = title ?? filename.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  const rows = () => buildRows(data, columns);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={size} className="gap-1">
          <FileDown className="w-3.5 h-3.5" />
          Export
          <ChevronDown className="w-3 h-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Export / Print</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => printTable(label, rows())} className="gap-2">
          <Printer className="w-4 h-4 text-[#0f2d5a]" /> Print
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => printTable(label, rows())} className="gap-2">
          <FileText className="w-4 h-4 text-red-500" /> Save as PDF
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => downloadExcel(filename, rows())} className="gap-2">
          <FileSpreadsheet className="w-4 h-4 text-green-600" /> Export Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => downloadCSV(filename, rows())} className="gap-2">
          <FileText className="w-4 h-4 text-blue-500" /> Export CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => downloadWord(filename, label, rows())} className="gap-2">
          <File className="w-4 h-4 text-blue-700" /> Export Word (.doc)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
