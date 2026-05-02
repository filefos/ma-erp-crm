import { useRef, useState } from "react";
import { useCreateLead } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, FileText, CheckCircle2, AlertTriangle, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SAMPLE_HEADERS = [
  "leadName", "companyName", "contactPerson", "phone", "whatsapp", "email",
  "location", "source", "requirementType", "budget", "leadScore", "status", "notes", "nextFollowUp",
];

const SAMPLE_CSV =
  SAMPLE_HEADERS.join(",") + "\n" +
  '"Al Habtoor Villa","Al Habtoor Group","Khalid Al Habtoor","+971501234567","+971501234567","khalid@example.ae","Dubai","referral","Villa Construction","850000","hot","new","2 storey villa, urgent","2026-05-15"\n' +
  '"DEWA Labour Camp","DEWA","Project Manager","+971501112222","+971501112222","pm@dewa.gov.ae","Sharjah","tender","Labour Camp","2500000","warm","contacted","Govt tender","2026-05-20"';

// Tiny CSV parser — handles quoted strings with commas and "" escapes.
function parseCsv(text: string): string[][] {
  // Strip UTF-8 BOM if present so the first header doesn't get a hidden prefix.
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const out: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else cell += c;        // preserves \r and \n inside quoted fields
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n") { row.push(cell); out.push(row); row = []; cell = ""; }
      else if (c === "\r") { /* ignore */ }
      else cell += c;
    }
  }
  if (cell.length > 0 || row.length > 0) { row.push(cell); out.push(row); }
  return out.filter(r => r.some(v => v.trim() !== ""));
}

export function LeadCsvImport({ open, onOpenChange, companyId }: {
  open: boolean; onOpenChange: (v: boolean) => void; companyId?: number;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, errors: 0 });
  const create = useCreateLead();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const grid = parseCsv(text);
      if (grid.length < 2) { toast({ title: "Empty CSV", variant: "destructive" }); return; }
      const hdr = grid[0].map(h => h.trim());
      const data = grid.slice(1).map(r => {
        const obj: Record<string, string> = {};
        hdr.forEach((h, i) => { obj[h] = (r[i] ?? "").trim(); });
        return obj;
      });
      setHeaders(hdr);
      setRows(data);
      setProgress({ done: 0, total: 0, errors: 0 });
    };
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "leads-template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const runImport = async () => {
    if (rows.length === 0) return;
    setImporting(true);
    setProgress({ done: 0, total: rows.length, errors: 0 });
    let errors = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.leadName) { errors++; setProgress(p => ({ ...p, done: i + 1, errors })); continue; }
      try {
        await create.mutateAsync({
          data: {
            leadName: r.leadName,
            companyName: r.companyName || undefined,
            contactPerson: r.contactPerson || undefined,
            phone: r.phone || undefined,
            whatsapp: r.whatsapp || undefined,
            email: r.email || undefined,
            location: r.location || undefined,
            source: r.source || "other",
            requirementType: r.requirementType || undefined,
            budget: r.budget ? parseFloat(r.budget) : undefined,
            leadScore: (r.leadScore as any) || "warm",
            status: (r.status as any) || "new",
            notes: r.notes || undefined,
            nextFollowUp: r.nextFollowUp || undefined,
            companyId,
          } as any,
        });
      } catch {
        errors++;
      }
      setProgress({ done: i + 1, total: rows.length, errors });
    }
    queryClient.invalidateQueries({ queryKey: ["/leads"] });
    setImporting(false);
    toast({
      title: "Import complete",
      description: `Imported ${rows.length - errors}/${rows.length} leads${errors ? ` · ${errors} skipped` : ""}.`,
    });
    if (errors === 0) {
      setRows([]); setHeaders([]);
      onOpenChange(false);
    }
  };

  const reset = () => { setRows([]); setHeaders([]); setProgress({ done: 0, total: 0, errors: 0 }); };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Upload className="w-4 h-4" />Import Leads from CSV</DialogTitle></DialogHeader>

        {rows.length === 0 ? (
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-xl p-8 text-center bg-muted/30">
              <FileText className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-3">Drop a CSV file here or click to browse</p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
                className="hidden"
                data-testid="input-csv-file"
              />
              <Button size="sm" className="bg-[#0f2d5a] hover:bg-[#1e6ab0]" onClick={() => fileRef.current?.click()}>
                <Upload className="w-3.5 h-3.5 mr-1.5" />Choose CSV File
              </Button>
            </div>

            <div className="border rounded-lg p-3 bg-muted/20">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold">Required column: <code className="text-primary">leadName</code></div>
                <Button size="sm" variant="outline" onClick={downloadTemplate} data-testid="button-download-template">
                  <Download className="w-3.5 h-3.5 mr-1.5" />Download template
                </Button>
              </div>
              <div className="text-[11px] text-muted-foreground">
                Optional columns: {SAMPLE_HEADERS.filter(h => h !== "leadName").join(", ")}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <span className="font-semibold">{rows.length}</span> rows ready to import.
                {!headers.includes("leadName") && (
                  <span className="text-red-600 ml-2 inline-flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" />Missing required column "leadName"</span>
                )}
              </div>
              <Button size="sm" variant="ghost" onClick={reset}>Choose different file</Button>
            </div>

            <div className="border rounded-lg overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 sticky top-0">
                  <tr>{headers.map(h => <th key={h} className="px-2 py-1.5 text-left font-medium">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.slice(0, 25).map((r, i) => (
                    <tr key={i} className="border-t">{headers.map(h => <td key={h} className="px-2 py-1 truncate max-w-[180px]">{r[h]}</td>)}</tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 25 && <div className="px-2 py-1.5 text-[11px] text-muted-foreground bg-muted/40 text-center">… and {rows.length - 25} more rows</div>}
            </div>

            {importing && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Importing… {progress.done}/{progress.total}</span>
                  {progress.errors > 0 && <span className="text-red-600">{progress.errors} errors</span>}
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-[#1e6ab0] transition-all" style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%` }} />
                </div>
              </div>
            )}

            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              onClick={runImport}
              disabled={importing || !headers.includes("leadName")}
              data-testid="button-import-csv"
            >
              {importing ? "Importing…" : <><CheckCircle2 className="w-4 h-4 mr-1.5" />Import {rows.length} leads</>}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
