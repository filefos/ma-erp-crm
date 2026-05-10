import { useState } from "react";
import {
  useListUndertakingLetters, useCreateUndertakingLetter, useListLpos,
} from "@workspace/api-client-react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CompanyField } from "@/components/CompanyField";
import { useToast } from "@/hooks/use-toast";
import { Search, FileText, Plus, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { ExportMenu } from "@/components/ExportMenu";
import { AccountsPageHeader } from "@/components/accounts-page-header";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  issued: "bg-blue-100 text-blue-800",
  signed: "bg-green-100 text-green-800",
};

const EMPTY_NEW_UL = () => ({
  lpoNumber: "", projectRef: "", clientName: "", companyId: "", scope: "", letterDate: "",
});

export function UndertakingLettersList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [newForm, setNewForm] = useState(EMPTY_NEW_UL());
  const [lpoLookup, setLpoLookup] = useState<"idle" | "found" | "notfound" | "searching">("idle");

  const { data: letters = [], isLoading } = useListUndertakingLetters();
  const { data: lpos = [] } = useListLpos();
  const { filterByCompany, activeCompanyId } = useActiveCompany();
  const isElite = activeCompanyId === 2;
  const primeBtnCls = isElite ? "bg-[#0D0D0D] hover:bg-[#8B0000]" : "bg-[#0f2d5a] hover:bg-[#1e6ab0]";

  const createMutation = useCreateUndertakingLetter({
    mutation: {
      onSuccess: (created) => {
        queryClient.invalidateQueries({ queryKey: ["/undertaking-letters"] });
        setNewOpen(false);
        setNewForm(EMPTY_NEW_UL());
        setLpoLookup("idle");
        toast({ title: "Undertaking Letter created." });
        if ((created as any)?.id) navigate(`/accounts/undertaking-letters/${(created as any).id}`);
      },
      onError: (e: any) => toast({ title: e?.message ?? "Failed to create", variant: "destructive" }),
    },
  });

  const handleLpoChange = (val: string) => {
    setNewForm(p => ({ ...p, lpoNumber: val }));
    if (!val.trim()) { setLpoLookup("idle"); return; }
    const match = (lpos as any[]).find((l: any) =>
      (l.lpoNumber ?? "").toLowerCase() === val.trim().toLowerCase()
    );
    if (match) {
      setLpoLookup("found");
      setNewForm(p => ({
        ...p,
        lpoNumber: val,
        clientName: match.clientName || p.clientName,
        companyId: match.companyId ? String(match.companyId) : p.companyId,
        projectRef: match.projectRef || p.projectRef,
        scope: match.scope || match.description || match.projectDescription || p.scope,
      }));
    } else {
      setLpoLookup("notfound");
    }
  };

  const filtered = filterByCompany(letters).filter(l => {
    const q = search.toLowerCase();
    const pq = projectSearch.toLowerCase();
    const ref = ((l as any).projectRef ?? "").toLowerCase();
    return (
      (!q || l.ulNumber.toLowerCase().includes(q) || l.clientName.toLowerCase().includes(q) || ref.includes(q) || ((l as any).lpoNumber ?? "").toLowerCase().includes(q)) &&
      (!pq || ref.includes(pq))
    );
  });

  const draft = letters.filter(l => l.status === "draft").length;

  return (
    <div className="space-y-4">
      <AccountsPageHeader
        title="Undertaking Letters"
        breadcrumb="Accounts"
        subtitle="Formal undertaking documents issued per LPO."
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
            <Dialog open={newOpen} onOpenChange={v => { setNewOpen(v); if (!v) { setNewForm(EMPTY_NEW_UL()); setLpoLookup("idle"); } }}>
              <DialogTrigger asChild>
                <Button className={primeBtnCls}>
                  <Plus className="w-4 h-4 mr-2" />New Undertaking Letter
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Create Undertaking Letter</DialogTitle></DialogHeader>

                {/* LPO lookup — primary field */}
                <div className="space-y-1 pt-2">
                  <Label className="font-semibold">LPO Number <span className="text-muted-foreground font-normal text-xs">(enter to auto-fill)</span></Label>
                  <div className="relative">
                    <Input
                      className="pr-8"
                      value={newForm.lpoNumber}
                      onChange={e => handleLpoChange(e.target.value)}
                      placeholder="e.g. PM-LPO-2025-0001"
                    />
                    {lpoLookup === "found" && <CheckCircle2 className="absolute right-2.5 top-2.5 w-4 h-4 text-green-500" />}
                    {lpoLookup === "notfound" && <AlertCircle className="absolute right-2.5 top-2.5 w-4 h-4 text-orange-400" />}
                    {lpoLookup === "searching" && <Loader2 className="absolute right-2.5 top-2.5 w-4 h-4 text-muted-foreground animate-spin" />}
                  </div>
                  {lpoLookup === "found" && (
                    <p className="text-xs text-green-600 font-medium">LPO found — client, company and project auto-filled below.</p>
                  )}
                  {lpoLookup === "notfound" && (
                    <p className="text-xs text-orange-500">LPO not found — fill details manually below.</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <Label>Project ID</Label>
                    <Input value={newForm.projectRef} onChange={e => setNewForm(p => ({ ...p, projectRef: e.target.value }))} placeholder="e.g. PM-PRJ-2025-0001" className="font-mono" />
                  </div>
                  <div className="space-y-1">
                    <Label>Letter Date</Label>
                    <Input type="date" value={newForm.letterDate} onChange={e => setNewForm(p => ({ ...p, letterDate: e.target.value }))} />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label>Client Name *</Label>
                    <Input value={newForm.clientName} onChange={e => setNewForm(p => ({ ...p, clientName: e.target.value }))} placeholder="Client / company name" />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label>Company *</Label>
                    <CompanyField value={newForm.companyId} onChange={v => setNewForm(p => ({ ...p, companyId: v }))} />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label>Project / Scope Description</Label>
                    <Input value={newForm.scope} onChange={e => setNewForm(p => ({ ...p, scope: e.target.value }))} placeholder="Brief description of the project scope" />
                  </div>
                </div>

                <Button
                  className={`mt-3 ${primeBtnCls} w-full`}
                  onClick={() => createMutation.mutate({ data: { ...newForm, companyId: parseInt(newForm.companyId, 10) } as any })}
                  disabled={!newForm.clientName || !newForm.companyId || createMutation.isPending}
                >
                  {createMutation.isPending ? "Creating..." : "Create Undertaking Letter"}
                </Button>
              </DialogContent>
            </Dialog>
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
            <button className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground text-xs" onClick={() => setProjectSearch("")}>✕</button>
          )}
        </div>
        {(search || projectSearch) && (
          <span className="text-xs text-muted-foreground">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
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
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No undertaking letters found.</TableCell></TableRow>
            ) : filtered.map(l => (
              <TableRow
                key={l.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => navigate(`/accounts/undertaking-letters/${l.id}`)}
              >
                <TableCell>
                  {(l as any).projectRef ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-[#0f2d5a] text-white border border-blue-300/30 tracking-wide whitespace-nowrap">
                      {(l as any).projectRef}
                    </span>
                  ) : <span className="text-muted-foreground text-xs">—</span>}
                </TableCell>
                <TableCell className="font-medium font-mono text-sm">
                  <Link
                    href={`/accounts/undertaking-letters/${l.id}`}
                    className="text-primary hover:underline"
                    onClick={e => e.stopPropagation()}
                  >
                    {l.ulNumber}
                  </Link>
                </TableCell>
                <TableCell className="font-medium">{l.clientName}</TableCell>
                <TableCell className="font-mono text-xs">{(l as any).lpoNumber || "—"}</TableCell>
                <TableCell>{(l as any).letterDate || "—"}</TableCell>
                <TableCell>{(l as any).signedByName || "—"}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className={STATUS_COLORS[l.status] ?? ""}>{l.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
