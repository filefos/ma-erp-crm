import { useState } from "react";
import {
  useListUndertakingLetters, useUpdateUndertakingLetter, useListCompanies,
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
import { Search, FileText, Pencil, CheckCircle } from "lucide-react";
import { ExportMenu } from "@/components/ExportMenu";
import { AccountsPageHeader } from "@/components/accounts-page-header";
import { useQueryClient } from "@tanstack/react-query";

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
  const [detailId, setDetailId] = useState<number | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<EditForm>({
    letterDate: "", scope: "", commitmentText: "", signedByName: "", signedDate: "", status: "draft", notes: "",
  });

  const { data: letters = [], isLoading } = useListUndertakingLetters();
  const { data: companies = [] } = useListCompanies();
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

  const filtered = filterByCompany(letters).filter(l =>
    !search ||
    l.ulNumber.toLowerCase().includes(search.toLowerCase()) ||
    l.clientName.toLowerCase().includes(search.toLowerCase()) ||
    ((l as any).projectRef ?? "").toLowerCase().includes(search.toLowerCase())
  );

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

  const draft = letters.filter(l => l.status === "draft").length;

  return (
    <div className="space-y-4">
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

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by UL no., client, project..."
          className="pl-8"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <DialogTitle className="font-mono text-[#0f2d5a]">
                {selectedLetter?.ulNumber ?? "Undertaking Letter"}
              </DialogTitle>
              <div className="flex items-center gap-2">
                {!editMode && (
                  <Button size="sm" variant="outline" onClick={() => setEditMode(true)}>
                    <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
                  </Button>
                )}
                <Badge variant="secondary" className={STATUS_COLORS[selectedLetter?.status ?? "draft"] ?? ""}>
                  {selectedLetter?.status}
                </Badge>
              </div>
            </div>
          </DialogHeader>

          {selectedLetter && !editMode && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Client:</span> <span className="font-medium ml-1">{selectedLetter.clientName}</span></div>
                <div><span className="text-muted-foreground">LPO No.:</span> <span className="font-medium ml-1">{(selectedLetter as any).lpoNumber || "—"}</span></div>
                <div><span className="text-muted-foreground">Project:</span> <span className="font-medium ml-1">{(selectedLetter as any).projectRef || "—"}</span></div>
                <div><span className="text-muted-foreground">Letter Date:</span> <span className="font-medium ml-1">{(selectedLetter as any).letterDate || "—"}</span></div>
                <div><span className="text-muted-foreground">Signed By:</span> <span className="font-medium ml-1">{(selectedLetter as any).signedByName || "—"}</span></div>
                <div><span className="text-muted-foreground">Signed Date:</span> <span className="font-medium ml-1">{(selectedLetter as any).signedDate || "—"}</span></div>
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
                  <Label>Signed By</Label>
                  <Input value={form.signedByName} onChange={e => setForm(p => ({ ...p, signedByName: e.target.value }))} placeholder="Name of signatory" />
                </div>
                <div className="space-y-1">
                  <Label>Signed Date</Label>
                  <Input type="date" value={form.signedDate} onChange={e => setForm(p => ({ ...p, signedDate: e.target.value }))} />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label>Scope of Work</Label>
                  <Textarea rows={3} value={form.scope} onChange={e => setForm(p => ({ ...p, scope: e.target.value }))} placeholder="Describe the scope..." />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label>Undertaking / Commitment Statement</Label>
                  <Textarea rows={4} value={form.commitmentText} onChange={e => setForm(p => ({ ...p, commitmentText: e.target.value }))} placeholder="We hereby undertake and commit to..." />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label>Notes</Label>
                  <Textarea rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Any additional notes..." />
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
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
