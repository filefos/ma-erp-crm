import { useRef, useState } from "react";
import ExcelJS from "exceljs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Upload, Download, Loader2, CheckCircle2, AlertCircle,
  FileSpreadsheet, ArrowRight, ArrowLeft, MapPin,
} from "lucide-react";

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
type Step = "upload" | "mapping" | "importing";

const SKIP = "__skip__";

function autoSuggest(header: string, columns: BulkColumn[]): string {
  const h = header.trim().toLowerCase();
  for (const col of columns) {
    const candidates = [col.label, ...(col.aliases ?? [])];
    if (candidates.some(c => c.trim().toLowerCase() === h)) return col.label;
  }
  return SKIP;
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
      const s = v == null ? "" : (typeof v === "object" && "text" in (v as any)
        ? String((v as any).text) : String(v)).trim();
      if (s) any = true;
      obj[h] = s;
    });
    if (any) rows.push(obj);
  });
  return rows;
}

function applyMapping(rawRows: ParsedRow[], colMap: Record<string, string>): ParsedRow[] {
  return rawRows.map(raw => {
    const out: ParsedRow = {};
    for (const [header, target] of Object.entries(colMap)) {
      if (target !== SKIP && header in raw) {
        if (!out[target]) out[target] = raw[header];
      }
    }
    return out;
  });
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
  const [step, setStep] = useState<Step>("upload");
  const [rawRows, setRawRows] = useState<ParsedRow[]>([]);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [colMap, setColMap] = useState<Record<string, string>>({});
  const [mappedRows, setMappedRows] = useState<ParsedRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [parseError, setParseError] = useState("");
  const [progress, setProgress] = useState({ done: 0, ok: 0, fail: 0, errors: [] as string[] });
  const fileRef = useRef<HTMLInputElement | null>(null);

  function resetAll() {
    setStep("upload");
    setRawRows([]);
    setRawHeaders([]);
    setColMap({});
    setMappedRows([]);
    setBusy(false);
    setParseError("");
    setProgress({ done: 0, ok: 0, fail: 0, errors: [] });
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleFile(file: File) {
    setParseError("");
    setRawRows([]);
    setRawHeaders([]);
    try {
      let parsed: ParsedRow[] = [];
      if (/\.xlsx?$/i.test(file.name)) parsed = await parseXlsx(file);
      else parsed = parseCsv(await file.text());
      if (!parsed.length) { setParseError("No data rows found in the file."); return; }
      const headers = Object.keys(parsed[0]).filter(h => h.trim());
      const suggested: Record<string, string> = {};
      for (const h of headers) suggested[h] = autoSuggest(h, columns);
      setRawRows(parsed);
      setRawHeaders(headers);
      setColMap(suggested);
      setStep("mapping");
    } catch (err: any) {
      setParseError(`Could not read file: ${err?.message ?? err}`);
    }
  }

  function confirmMapping() {
    const mapped = applyMapping(rawRows, colMap);
    setMappedRows(mapped);
    setProgress({ done: 0, ok: 0, fail: 0, errors: [] });
    setStep("importing");
  }

  async function importAll() {
    if (!mappedRows.length || busy) return;
    setBusy(true);
    setProgress({ done: 0, ok: 0, fail: 0, errors: [] });
    for (let i = 0; i < mappedRows.length; i++) {
      const row = mappedRows[i];
      const missing = columns.filter(c => c.required && !row[c.label]).map(c => c.label);
      if (missing.length) {
        setProgress(p => ({ ...p, done: p.done + 1, fail: p.fail + 1, errors: [...p.errors, `Row ${i + 2}: missing required field(s): ${missing.join(", ")}`] }));
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
    ws.columns = columns.map(c => ({ header: c.label, key: c.key, width: Math.max(16, c.label.length + 4) }));
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

  const mappedFieldLabels = new Set(Object.values(colMap).filter(v => v !== SKIP));
  const importDone = progress.done > 0 && progress.done === mappedRows.length && !busy;

  const stepLabels: Record<Step, string> = {
    upload: "1. Upload File",
    mapping: "2. Map Columns",
    importing: "3. Import",
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetAll(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="button-bulk-upload">
          <Upload className="w-4 h-4 mr-2" />{triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 text-xs mb-2">
          {(["upload", "mapping", "importing"] as Step[]).map((s, i) => (
            <span key={s} className="flex items-center gap-1">
              {i > 0 && <ArrowRight className="w-3 h-3 text-muted-foreground" />}
              <span className={`px-2 py-0.5 rounded-full font-medium ${step === s ? "bg-[#0f2d5a] text-white" : "bg-muted text-muted-foreground"}`}>
                {stepLabels[s]}
              </span>
            </span>
          ))}
        </div>

        <div className="space-y-4">

          {/* ── STEP 1: UPLOAD ─────────────────────────────────────────── */}
          {step === "upload" && (
            <>
              {description && <p className="text-sm text-muted-foreground">{description}</p>}

              <div className="rounded-lg border bg-slate-50 dark:bg-slate-900/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <FileSpreadsheet className="w-4 h-4 text-[#1e6ab0]" />
                    Available fields
                  </div>
                  <Button variant="outline" size="sm" onClick={downloadTemplate} data-testid="button-download-template">
                    <Download className="w-3.5 h-3.5 mr-1.5" />Download template
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {columns.map(c => (
                    <span key={c.key} className={`text-xs px-2 py-0.5 rounded border ${c.required ? "bg-[#0f2d5a]/10 border-[#0f2d5a]/30 text-[#0f2d5a] font-semibold" : "bg-white border-slate-200 text-slate-600"}`}>
                      {c.label}{c.required ? " *" : ""}
                    </span>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Your file can use any column names — you'll map them to fields in the next step.
                </p>
              </div>

              <div className="rounded-lg border-2 border-dashed border-slate-200 bg-slate-50/50 p-6 text-center space-y-3">
                <Upload className="w-8 h-8 mx-auto text-slate-400" />
                <div>
                  <p className="text-sm font-medium text-slate-700">Choose your Excel or CSV file</p>
                  <p className="text-xs text-muted-foreground mt-1">Supports .xlsx, .xls, .csv</p>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="block w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-[#0f2d5a] file:text-white file:font-medium hover:file:bg-[#1e6ab0] cursor-pointer"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                  data-testid="input-bulk-file"
                />
              </div>

              {parseError && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" /> {parseError}
                </div>
              )}
            </>
          )}

          {/* ── STEP 2: MAP COLUMNS ────────────────────────────────────── */}
          {step === "mapping" && (
            <>
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                <MapPin className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span>We detected <strong>{rawHeaders.length} column{rawHeaders.length !== 1 ? "s" : ""}</strong> and <strong>{rawRows.length} row{rawRows.length !== 1 ? "s" : ""}</strong> in your file. Map each column to a contact field below.</span>
              </div>

              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-semibold text-slate-700 w-1/2">Your file column</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-slate-700">Maps to field</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-slate-700 text-xs text-muted-foreground">Sample value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rawHeaders.map((h, i) => {
                      const sample = rawRows[0]?.[h] ?? "";
                      const isDuplicate = colMap[h] !== SKIP &&
                        rawHeaders.filter(rh => colMap[rh] === colMap[h]).length > 1;
                      return (
                        <tr key={h} className={`border-t ${isDuplicate ? "bg-amber-50" : i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}>
                          <td className="px-4 py-2.5">
                            <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{h}</span>
                          </td>
                          <td className="px-4 py-2.5">
                            <Select
                              value={colMap[h] ?? SKIP}
                              onValueChange={(val) => setColMap(prev => ({ ...prev, [h]: val }))}
                            >
                              <SelectTrigger className={`h-8 text-sm ${colMap[h] && colMap[h] !== SKIP ? "border-emerald-400 text-emerald-800 bg-emerald-50" : "text-muted-foreground"}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={SKIP}>— Skip this column —</SelectItem>
                                {columns.map(c => (
                                  <SelectItem key={c.key} value={c.label}>
                                    {c.label}{c.required ? " *" : ""}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {isDuplicate && (
                              <p className="text-[10px] text-amber-600 mt-0.5">Mapped to same field as another column</p>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono truncate max-w-[140px]" title={sample}>
                            {sample || <span className="italic">empty</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {columns.some(c => c.required && !mappedFieldLabels.has(c.label)) && (
                <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>Required field(s) not yet mapped: <strong>{columns.filter(c => c.required && !mappedFieldLabels.has(c.label)).map(c => c.label).join(", ")}</strong></span>
                </div>
              )}

              <div className="flex justify-between gap-2 pt-1">
                <Button variant="outline" onClick={() => setStep("upload")}>
                  <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />Back
                </Button>
                <Button
                  className="bg-[#0f2d5a] hover:bg-[#1e6ab0]"
                  onClick={confirmMapping}
                  disabled={Object.values(colMap).every(v => v === SKIP)}
                >
                  Confirm mapping <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              </div>
            </>
          )}

          {/* ── STEP 3: PREVIEW & IMPORT ───────────────────────────────── */}
          {step === "importing" && (
            <>
              <div className="rounded-lg border bg-card">
                <div className="px-4 py-2.5 border-b flex items-center justify-between">
                  <span className="text-sm font-semibold">{mappedRows.length} row{mappedRows.length !== 1 ? "s" : ""} ready to import</span>
                  {progress.done > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {progress.done}/{mappedRows.length} · <span className="text-emerald-700">{progress.ok} ok</span> · <span className="text-red-600">{progress.fail} failed</span>
                    </span>
                  )}
                </div>
                <div className="max-h-52 overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 sticky top-0 border-b">
                      <tr>
                        {columns.filter(c => mappedFieldLabels.has(c.label)).map(c => (
                          <th key={c.key} className="text-left px-3 py-2 font-medium">{c.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {mappedRows.slice(0, 50).map((r, i) => (
                        <tr key={i} className="border-t">
                          {columns.filter(c => mappedFieldLabels.has(c.label)).map(c => (
                            <td key={c.key} className="px-3 py-1.5 text-slate-600">{r[c.label] || <span className="text-slate-300 italic">—</span>}</td>
                          ))}
                        </tr>
                      ))}
                      {mappedRows.length > 50 && (
                        <tr><td colSpan={columns.length} className="text-center py-2 text-muted-foreground italic text-xs">…and {mappedRows.length - 50} more rows</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {progress.errors.length > 0 && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                    <AlertCircle className="w-4 h-4" /> {progress.errors.length} issue{progress.errors.length !== 1 ? "s" : ""}
                  </div>
                  <ul className="mt-2 text-xs text-amber-800 space-y-0.5 max-h-32 overflow-auto">
                    {progress.errors.slice(0, 30).map((e, i) => <li key={i}>• {e}</li>)}
                  </ul>
                </div>
              )}

              {importDone && (
                <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Import finished — {progress.ok} created, {progress.fail} failed.
                </div>
              )}

              <div className="flex justify-between gap-2 pt-1">
                <Button variant="outline" onClick={() => setStep("mapping")} disabled={busy}>
                  <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />Back
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
                    {importDone ? "Close" : "Cancel"}
                  </Button>
                  <Button
                    onClick={importAll}
                    disabled={busy || importDone}
                    className="bg-[#0f2d5a] hover:bg-[#1e6ab0]"
                    data-testid="button-bulk-import"
                  >
                    {busy
                      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importing…</>
                      : <>Import {mappedRows.length} row{mappedRows.length !== 1 ? "s" : ""}</>}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
