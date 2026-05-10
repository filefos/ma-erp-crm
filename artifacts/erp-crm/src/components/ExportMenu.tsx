import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ChevronDown, Printer, FileText, FileSpreadsheet, FileDown, File } from "lucide-react";
import { downloadCSV, downloadExcel, downloadWord, printTable } from "@/lib/export";
import { useActiveCompany } from "@/hooks/useActiveCompany";

export interface ExportColumn {
  header: string;
  key: string;
  format?: (v: unknown) => string;
}

interface ExportMenuProps {
  data: readonly object[];
  columns: ExportColumn[];
  filename: string;
  title?: string;
  size?: "sm" | "default";
  defaultLandscape?: boolean;
  companyId?: number;
}

function buildRows(
  data: readonly object[],
  columns: ExportColumn[]
): (string | number | null | undefined)[][] {
  const header = columns.map(c => c.header);
  const rows = data.map(row => {
    const r = row as Record<string, unknown>;
    return columns.map(c => {
      const v = r[c.key];
      if (v == null) return "";
      return c.format ? c.format(v) : (v as string | number);
    });
  });
  return [header, ...rows];
}

export function ExportMenu({ data, columns, filename, title, size = "sm", defaultLandscape = true, companyId }: ExportMenuProps) {
  const { activeCompanyId } = useActiveCompany();
  const effectiveCompanyId = companyId ?? activeCompanyId ?? undefined;
  const isElite = effectiveCompanyId === 2;

  const label = title ?? filename.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  const rows = () => buildRows(data, columns);

  const [pageSetupOpen, setPageSetupOpen] = useState(false);
  const [orientation, setOrientation] = useState<"landscape" | "portrait">(defaultLandscape ? "landscape" : "portrait");

  const brandPrimary = isElite ? "#8B0000" : "#0f2d5a";
  const brandAccent  = isElite ? "#C00000" : "#1e6ab0";
  const selectedBg   = isElite ? "bg-red-50 dark:bg-red-900/20" : "bg-blue-50 dark:bg-blue-900/20";

  function handlePrint() {
    printTable(label, rows(), orientation === "landscape", { companyId: effectiveCompanyId });
    setPageSetupOpen(false);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size={size} className="gap-1">
            <FileDown className="w-3.5 h-3.5" />
            Export
            <ChevronDown className="w-3 h-3 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="text-xs text-muted-foreground">Print / Export</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setPageSetupOpen(true)} className="gap-2">
            <Printer className="w-4 h-4" style={{ color: brandPrimary }} /> Print
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setPageSetupOpen(true)} className="gap-2">
            <FileText className="w-4 h-4 text-red-500" /> Save as PDF
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => void downloadExcel(filename, rows()).catch(console.error)} className="gap-2">
            <FileSpreadsheet className="w-4 h-4 text-green-600" /> Export Excel (.xlsx)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => downloadCSV(filename, rows())} className="gap-2">
            <FileText className="w-4 h-4 text-blue-500" /> Export CSV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => downloadWord(filename, label, rows(), { companyId: effectiveCompanyId })} className="gap-2">
            <File className="w-4 h-4 text-blue-700" /> Export Word (.doc)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={pageSetupOpen} onOpenChange={setPageSetupOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="w-4 h-4" style={{ color: brandPrimary }} /> Page Setup
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div>
              <p className="text-xs text-muted-foreground mb-3">Choose page orientation before printing / saving as PDF.</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setOrientation("portrait")}
                  className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                    orientation === "portrait"
                      ? `${selectedBg}`
                      : "border-border hover:border-muted-foreground"
                  }`}
                  style={orientation === "portrait" ? { borderColor: brandAccent } : undefined}
                >
                  <div
                    className={`w-9 h-12 rounded border-2 flex items-center justify-center ${
                      orientation === "portrait" ? "bg-white" : "border-muted-foreground/40 bg-muted"
                    }`}
                    style={orientation === "portrait" ? { borderColor: brandAccent } : undefined}
                  >
                    <div className="space-y-0.5 px-1">
                      <div className="h-0.5 bg-muted-foreground/40 rounded" />
                      <div className="h-0.5 bg-muted-foreground/40 rounded" />
                      <div className="h-0.5 bg-muted-foreground/40 rounded" />
                    </div>
                  </div>
                  <span
                    className="text-xs font-medium"
                    style={orientation === "portrait" ? { color: brandAccent } : undefined}
                  >Portrait</span>
                </button>
                <button
                  onClick={() => setOrientation("landscape")}
                  className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                    orientation === "landscape"
                      ? `${selectedBg}`
                      : "border-border hover:border-muted-foreground"
                  }`}
                  style={orientation === "landscape" ? { borderColor: brandAccent } : undefined}
                >
                  <div
                    className={`w-12 h-9 rounded border-2 flex items-center justify-center ${
                      orientation === "landscape" ? "bg-white" : "border-muted-foreground/40 bg-muted"
                    }`}
                    style={orientation === "landscape" ? { borderColor: brandAccent } : undefined}
                  >
                    <div className="space-y-0.5 px-1 w-full">
                      <div className="h-0.5 bg-muted-foreground/40 rounded" />
                      <div className="h-0.5 bg-muted-foreground/40 rounded" />
                      <div className="h-0.5 bg-muted-foreground/40 rounded" />
                    </div>
                  </div>
                  <span
                    className="text-xs font-medium"
                    style={orientation === "landscape" ? { color: brandAccent } : undefined}
                  >Landscape</span>
                </button>
              </div>
            </div>
            <Button
              onClick={handlePrint}
              className="w-full text-white"
              style={{ backgroundColor: brandPrimary }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = brandAccent)}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = brandPrimary)}
            >
              <Printer className="w-4 h-4 mr-2" />
              Print / Save as PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
