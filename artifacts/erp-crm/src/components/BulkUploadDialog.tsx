import { useRef, useState } from "react";
import ExcelJS from "exceljs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Download, Loader2, CheckCircle2, AlertCircle, FileSpreadsheet } from "lucide-react";

export interface BulkColumn {
  key: string;
  label: string;
  required?: boolean;
  example?: string | number;
  aliases?: string[];
}

interface BulkUploadDialogProps {
  title: string;
  description?: string;
  triggerLabel?: string;
  templateFilename: string;
  columns: BulkColumn[];
  onRow: (row: Record<string, string>) => Promise<void>;
  onComplete?: () => void;
}

type ParsedRow = Record<string, string>;

function normalizeRows(rows: ParsedRow[], columns: BulkColumn[]): ParsedRow[] {
  if (!rows.length) return rows;
  const sampleKeys = Object.keys(rows[0]);
  const keyMap: Record<string, string> = {};
  const mapped = new Set<string>();

  for (const col of columns) {
    if (mapped.has(col.label)) continue;
    const candidates = [col.label, ...(col.aliases ?? [])];
    const match = sampleKeys.find(k =>
      candidates.some(c => c.trim().toLowerCase() === k.trim().toLowerCase())
    );
    if (match && match !== col.label) {
      keyMap[match] = col.label;
      mapped.add(col.label);
    }
  }
  if (!Object.keys(keyMap).length) return rows;
  return rows.map(row => {
    const out: ParsedRow = { ...row };
    for (const [orig, canonical] of Object.entries(keyMap)) {
      if (orig in out) { out[canonical] = out[orig]; delete out[orig]; }
    }
    return out;
  });
}

function parseCsv(text: string): ParsedRow[] {
  const lines: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (field !== "" || cur.length) { cur.push(field); lines.push(cur); cur = []; field = ""; }
        if (c === "\r" && text[i + 1] === "\n") i++;
      } else field += c;
    }
  }
  if (field !== "" || cur.length) { cur.push(field); lines.push(cur); }
  if (!lines.length) return [];
  const headers = lines[0].map(h => h.trim());
  return lines.slice(1).filter(r => r.some(c => c && c.trim())).map(r => {
    const row: ParsedRow = {};
    headers.forEach((h, idx) => { row[h] = (r[idx] ?? "").trim(); });
    return row;
  });
}

async function parseXlsx(file: File): Promise<ParsedRow[]> {
  const buf = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const headers: string[] = [];
  ws.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col - 1] = String(cell.value ?? "").trim();
  });
  const rows: ParsedRow[] = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj: ParsedRow = {};
    let any = false;
    headers.forEach((h, idx) => {
      const v = row.getCell(idx + 1).value;
      const s = v == null ? "" : (typeof v === "object" && "text" in (v as any) ? String((v as any).text) : String(v)).trim();
      if (s) any = true;
      obj[h] = s;
    });
    if (any) rows.push(obj);
  });
  return rows;
}

export function BulkUploadDialog({
  title,
  description,
  triggerLabel = "Bulk Upload",
  templateFilename,
  columns,
  onRow,
  onComplete,
}: BulkUploadDialogProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [progress, setProgress] = useState({ done: 0, ok: 0, fail: 0, errors: [] as string[] });
  const fileRef = useRef<HTMLInputElement | null>(null);

  function reset() {
    setRows([]);
    setProgress({ done: 0, ok: 0, fail: 0, errors: [] });
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleFile(file: File) {
    reset();
    try {
      let parsed: ParsedRow[] = [];
      if (/\.xlsx?$/i.test(file.name)) parsed = await parseXlsx(file);
      else parsed = parseCsv(await file.text());
      setRows(normalizeRows(parsed, columns));
    } catch (err: any) {
      setProgress(p => ({ ...p, errors: [`Could not read file: ${err?.message ?? err}`] }));
    }
  }

  async function importAll() {
    if (!rows.length || busy) return;
    setBusy(true);
    setProgress({ done: 0, ok: 0, fail: 0, errors: [] });
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const missing = columns.filter(c => c.required && !row[c.label]).map(c => c.label);
      if (missing.length) {
        setProgress(p => ({ ...p, done: p.done + 1, fail: p.fail + 1, errors: [...p.errors, `Row ${i + 2}: missing ${missing.join(", ")}`] }));
        continue;
      }
      try {
        await onRow(row);
        setProgress(p => ({ ...p, done: p.done + 1, ok: p.ok + 1 }));
      } catch (err: any) {
        setProgress(p => ({ ...p, done: p.done + 1, fail: p.fail + 1, errors: [...p.errors, `Row ${i + 2}: ${err?.message ?? "failed"}`] }));
      }
    }
    setBusy(false);
    onComplete?.();
  }

  async function downloadTemplate() {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Template");
    ws.columns = columns.map(c => ({ header: c.label, key: c.key, width: Math.max(14, c.label.length + 4) }));
    ws.addRow(Object.fromEntries(columns.map(c => [c.key, c.example ?? ""])));
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F2D5A" } };
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = templateFilename.endsWith(".xlsx") ? templateFilename : `${templateFilename}.xlsx`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { reset(); } }}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="button-bulk-upload">
          <Upload className="w-4 h-4 mr-2" />{triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          {description && <p className="text-sm text-muted-foreground">{description}</p>}

          <div className="rounded-lg border bg-slate-50 dark:bg-slate-900/40 p-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <FileSpreadsheet className="w-4 h-4 text-[#1e6ab0]" /> Required columns
              </div>
              <Button variant="outline" size="sm" onClick={downloadTemplate} data-testid="button-download-template">
                <Download className="w-3.5 h-3.5 mr-1.5" />Download Excel template
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">
              {columns.map(c => <span key={c.key} className={`inline-block mr-3 ${c.required ? "font-semibold text-[#0f2d5a] dark:text-[#1e6ab0]" : ""}`}>{c.label}{c.required ? " *" : ""}</span>)}
            </div>
          </div>

          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="block w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded file:border-0 file:bg-[#0f2d5a] file:text-white hover:file:bg-[#1e6ab0]"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              data-testid="input-bulk-file"
            />
            <p className="text-[11px] text-muted-foreground mt-1">Accepts .xlsx or .csv. The first row must be the column headers shown above.</p>
          </div>

          {rows.length > 0 && (
            <div className="rounded-lg border bg-card">
              <div className="px-3 py-2 border-b text-sm font-medium flex items-center justify-between">
                <span>{rows.length} row(s) ready to import</span>
                {progress.done > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {progress.done}/{rows.length} processed · {progress.ok} ok · {progress.fail} failed
                  </span>
                )}
              </div>
              <div className="max-h-48 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900/40 sticky top-0">
                    <tr>{columns.map(c => <th key={c.key} className="text-left px-2 py-1.5 font-medium">{c.label}</th>)}</tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 50).map((r, i) => (
                      <tr key={i} className="border-t">
                        {columns.map(c => <td key={c.key} className="px-2 py-1">{r[c.label] ?? ""}</td>)}
                      </tr>
                    ))}
                    {rows.length > 50 && (
                      <tr><td colSpan={columns.length} className="text-center py-2 text-muted-foreground">…and {rows.length - 50} more</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {progress.errors.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-300">
                <AlertCircle className="w-4 h-4" /> {progress.errors.length} issue(s)
              </div>
              <ul className="mt-2 text-xs text-amber-800 dark:text-amber-300 space-y-0.5 max-h-32 overflow-auto">
                {progress.errors.slice(0, 30).map((e, i) => <li key={i}>• {e}</li>)}
              </ul>
            </div>
          )}

          {progress.done > 0 && progress.done === rows.length && !busy && (
            <div className="flex items-center gap-2 text-sm text-emerald-700">
              <CheckCircle2 className="w-4 h-4" /> Import finished — {progress.ok} created, {progress.fail} failed.
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Close</Button>
            <Button
              onClick={importAll}
              disabled={!rows.length || busy}
              className="bg-[#0f2d5a] hover:bg-[#1e6ab0]"
              data-testid="button-bulk-import"
            >
              {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importing…</> : <>Import {rows.length || ""} row(s)</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
