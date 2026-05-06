import { useRef, useState } from "react";
import {
  useListUndertakingLetters, useUpdateUndertakingLetter,
} from "@workspace/api-client-react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Search, FileText, Pencil, CheckCircle, FileDown, Printer } from "lucide-react";
import { ExportMenu } from "@/components/ExportMenu";
import { AccountsPageHeader } from "@/components/accounts-page-header";
import { useQueryClient } from "@tanstack/react-query";
import { UndertakingLetterTemplate } from "@/components/undertaking-letter-template";
import { captureElementToPdfBase64 } from "@/lib/print-to-pdf";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  issued: "bg-blue-100 text-blue-800",
  signed: "bg-green-100 text-green-800",
};

interface EditForm {
  letterDate: string; scope: string; commitmentText: string;
  signedByName: string; signedDate: string; status: string; notes: string;
}

export function UndertakingLettersList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const [detailId, setDetailId] = useState<number | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [form, setForm] = useState<EditForm>({
    letterDate: "", scope: "", commitmentText: "",
    signedByName: "", signedDate: "", status: "draft", notes: "",
  });

  const printRef = useRef<HTMLDivElement>(null);

  const { data: letters = [], isLoading } = useListUndertakingLetters();
  const { filterByCompany } = useActiveCompany();

  const updateMutation = useUpdateUndertakingLetter({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/undertaking-letters"] });
        setEditMode(false);
        toast({ title: "Undertaking Letter updated." });
      },
      onError: (e: any) => toast({ title: e?.message ?? "Failed", variant: "destructive" }),
    },
  });

  const filtered = filterByCompany(letters).filter(l => {
    const q = search.toLowerCase();
    const pq = projectSearch.toLowerCase();
    const ref = ((l as any).projectRef ?? "").toLowerCase();
    const matchesSearch = !q ||
      l.ulNumber.toLowerCase().includes(q) ||
      l.clientName.toLowerCase().includes(q) ||
      ref.includes(q) ||
      ((l as any).lpoNumber ?? "").toLowerCase().includes(q);
    const matchesProject = !pq || ref.includes(pq);
    return matchesSearch && matchesProject;
  });

  const selectedLetter = letters.find(l => l.id === detailId);

  const openDetail = (id: number) => {
    const l = letters.find(x => x.id === id);
    if (!l) return;
    setDetailId(id);
    setEditMode(false);
    setForm({
      letterDate: (l as any).letterDate ?? "",
      scope: (l as any).scope ?? "",
      commitmentText: (l as any).commitmentText ?? "",
      signedByName: (l as any).signedByName ?? "",
      signedDate: (l as any).signedDate ?? "",
      status: l.status ?? "draft",
      notes: (l as any).notes ?? "",
    });
  };

  const handleSave = () => {
    if (!detailId) return;
    updateMutation.mutate({ id: detailId, data: form as any });
  };

  const handleDownloadPdf = async () => {
    if (!printRef.current || !selectedLetter) return;
    setExporting(true);
    try {
      const { base64, filename } = await captureElementToPdfBase64(
        printRef.current,
        `${selectedLetter.ulNumber}.pdf`
      );
      const link = document.createElement("a");
      link.href = `data:application/pdf;base64,${base64}`;
      link.download = filename;
      link.click();
    } catch {
      toast({ title: "PDF export failed.", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head>
      <title>${selectedLetter?.ulNumber ?? "Undertaking Letter"}</title>
      <style>
        @page { size: A4 portrait; margin: 0; }
        body { margin: 0; padding: 0; background: white; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      </style>
    </head><body>${printRef.current.outerHTML}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  const draft = letters.filter(l => l.status === "draft").length;

  return (
    <div className="space-y-4">
      {/* Hidden print template — rendered off-screen for PDF capture */}
      <div style={{ position: "fixed", top: "200%", left: 0, pointerEvents: "none", zIndex: -1 }}>
        {selectedLetter && (
          <UndertakingLetterTemplate
            ref={printRef}
            doc={{
              ulNumber: selectedLetter.ulNumber,
              letterDate: (selectedLetter as any).letterDate ?? null,
              clientName: selectedLetter.clientName,
              lpoNumber: (selectedLetter as any).lpoNumber ?? null,
              projectRef: (selectedLetter as any).projectRef ?? null,
              scope: (selectedLetter as any).scope ?? null,
              commitmentText: (selectedLetter as any).commitmentText ?? null,
              signedByName: (selectedLetter as any).signedByName ?? null,
              signedDate: (selectedLetter as any).signedDate ?? null,
              notes: (selectedLetter as any).notes ?? null,
              companyId: (selectedLetter as any).companyId ?? 1,
            }}
          />
        )}
      </div>

      <AccountsPageHeader
        title="Undertaking Letters"
        breadcrumb="Accounts"
        subtitle="Formal undertaking documents issued per LPO — auto-created on LPO registration."
        right={
          <>
            {draft > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-lg text-orange-700 text-sm">
                <FileText className="w-4 h-4" /> {draft} draft{draft !== 1 ? "s" : ""}
              </div>
            )}
            <ExportMenu
              data={filtered}
              columns={[
                { header: "UL Number", key: "ulNumber" },
                { header: "Client", key: "clientName" },
                { header: "Project Ref", key: "projectRef" },
                { header: "LPO Number", key: "lpoNumber" },
                { header: "Letter Date", key: "letterDate" },
                { header: "Status", key: "status" },
              ]}
              filename="undertaking-letters"
              title="Undertaking Letters"
              size="sm"
            />
          </>
        }
      />

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by UL no., client, LPO..."
            className="pl-8 w-64"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="relative">
          <span className="absolute left-2.5 top-2 text-[11px] font-bold text-[#0f2d5a] select-none pointer-events-none">PRJ</span>
          <Input
            placeholder="Filter by Project ID…"
            className="pl-10 w-52 border-[#0f2d5a]/40 focus-visible:ring-[#0f2d5a]/30 font-mono text-sm"
            value={projectSearch}
            onChange={e => setProjectSearch(e.target.value)}
          />
          {projectSearch && (
            <button
              className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground text-xs"
              onClick={() => setProjectSearch("")}
            >✕</button>
          )}
        </div>
        {(search || projectSearch) && (
          <span className="text-xs text-muted-foreground">
            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project Ref</TableHead>
              <TableHead>UL Number</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>LPO Number</TableHead>
              <TableHead>Letter Date</TableHead>
              <TableHead>Signed By</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No undertaking letters found. They are created automatically when an LPO is registered.</TableCell></TableRow>
            ) : filtered.map(l => (
              <TableRow
                key={l.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => openDetail(l.id)}
              >
                <TableCell>
                  {(l as any).projectRef ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-[#0f2d5a] text-white border border-blue-300/30 tracking-wide whitespace-nowrap">
                      {(l as any).projectRef}
                    </span>
                  ) : <span className="text-muted-foreground text-xs">—</span>}
                </TableCell>
                <TableCell className="font-medium font-mono text-sm text-primary">{l.ulNumber}</TableCell>
                <TableCell className="font-medium">{l.clientName}</TableCell>
                <TableCell className="font-mono text-xs">{(l as any).lpoNumber || "—"}</TableCell>
                <TableCell>{(l as any).letterDate || "—"}</TableCell>
                <TableCell>{(l as any).signedByName || "—"}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className={STATUS_COLORS[l.status] ?? ""}>
                    {l.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={detailId !== null} onOpenChange={v => { if (!v) { setDetailId(null); setEditMode(false); } }}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <DialogTitle className="font-mono text-[#0f2d5a]">
                {selectedLetter?.ulNumber ?? "Undertaking Letter"}
              </DialogTitle>
              <div className="flex items-center gap-2">
                {!editMode && (
                  <>
                    <Button size="sm" variant="outline" onClick={handlePrint} disabled={exporting}>
                      <Printer className="w-3.5 h-3.5 mr-1.5" /> Print
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleDownloadPdf} disabled={exporting}>
                      <FileDown className="w-3.5 h-3.5 mr-1.5" />
                      {exporting ? "Exporting…" : "PDF"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditMode(true)}>
                      <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
                    </Button>
                  </>
                )}
                <Badge variant="secondary" className={STATUS_COLORS[selectedLetter?.status ?? "draft"] ?? ""}>
                  {selectedLetter?.status}
                </Badge>
              </div>
            </div>
          </DialogHeader>

          {selectedLetter && !editMode && (
            <div className="space-y-4 py-2">
              {/* Meta strip */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm bg-muted/30 border rounded-lg p-3">
                <div><span className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">Client</span><div className="font-medium mt-0.5">{selectedLetter.clientName}</div></div>
                <div><span className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">LPO No.</span><div className="font-mono mt-0.5">{(selectedLetter as any).lpoNumber || "—"}</div></div>
                <div><span className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">Project</span><div className="font-mono font-semibold text-[#0f2d5a] mt-0.5">{(selectedLetter as any).projectRef || "—"}</div></div>
                <div><span className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">Letter Date</span><div className="mt-0.5">{(selectedLetter as any).letterDate || "—"}</div></div>
                <div><span className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">Signed By</span><div className="mt-0.5">{(selectedLetter as any).signedByName || "—"}</div></div>
                <div><span className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">Signed Date</span><div className="mt-0.5">{(selectedLetter as any).signedDate || "—"}</div></div>
              </div>

              {(selectedLetter as any).scope && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Scope of Work</p>
                  <p className="text-sm whitespace-pre-wrap border rounded p-3 bg-muted/30">{(selectedLetter as any).scope}</p>
                </div>
              )}
              {(selectedLetter as any).commitmentText && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Undertaking / Commitment</p>
                  <p className="text-sm whitespace-pre-wrap border rounded p-3 bg-muted/30">{(selectedLetter as any).commitmentText}</p>
                </div>
              )}
              {(selectedLetter as any).notes && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
                  <p className="text-sm whitespace-pre-wrap border rounded p-3 bg-muted/30">{(selectedLetter as any).notes}</p>
                </div>
              )}

              {/* Preview banner */}
              <div className="rounded-lg border border-[#0f2d5a]/20 bg-[#0f2d5a]/5 px-4 py-2.5 text-sm text-[#0f2d5a] flex items-center gap-2">
                <FileDown className="w-4 h-4 flex-shrink-0" />
                Use <strong>PDF</strong> or <strong>Print</strong> above to generate the official letterhead document.
              </div>
            </div>
          )}

          {editMode && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Letter Date</Label>
                  <Input type="date" value={form.letterDate} onChange={e => setForm(p => ({ ...p, letterDate: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="issued">Issued</SelectItem>
                      <SelectItem value="signed">Signed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Signed By (Authorised Signatory)</Label>
                  <Input value={form.signedByName} onChange={e => setForm(p => ({ ...p, signedByName: e.target.value }))} placeholder="Full name of signatory" />
                </div>
                <div className="space-y-1">
                  <Label>Signed Date</Label>
                  <Input type="date" value={form.signedDate} onChange={e => setForm(p => ({ ...p, signedDate: e.target.value }))} />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label>Scope of Work</Label>
                  <Textarea rows={3} value={form.scope} onChange={e => setForm(p => ({ ...p, scope: e.target.value }))} placeholder="Describe the contracted scope of work…" />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label>Commitment Statement</Label>
                  <p className="text-xs text-muted-foreground">List each fire-rated material on a new line — each appears as a separate line in the letter.</p>
                  <Textarea rows={6} value={form.commitmentText} onChange={e => setForm(p => ({ ...p, commitmentText: e.target.value }))} placeholder={"MS Steel: Fire-rated mild steel for structural components.\nGI Framing: Fire-rated galvanized iron framing for support structures.\nGypsum board 12.5mm thick 01 Hour fire rated.\nCement Board 06mm Thick 01 Hour Fire Rated."} />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label>Additional Notes</Label>
                  <Textarea rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Any additional notes or conditions…" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button variant="outline" onClick={() => setEditMode(false)}>Cancel</Button>
                <Button
                  className="bg-[#0f2d5a] hover:bg-[#1e6ab0]"
                  onClick={handleSave}
                  disabled={updateMutation.isPending}
                >
                  <CheckCircle className="w-4 h-4 mr-1.5" />
                  {updateMutation.isPending ? "Saving…" : "Save Changes"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
