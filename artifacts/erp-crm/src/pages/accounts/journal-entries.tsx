import { useState } from "react";
import {
  useListJournalEntries, useCreateJournalEntry, useUpdateJournalEntry,
  useDeleteJournalEntry, useApproveJournalEntry, useListCompanies, useListChartOfAccounts,
} from "@workspace/api-client-react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Pencil, Trash2, CheckCircle, BookOpen, X } from "lucide-react";
import { ExportMenu } from "@/components/ExportMenu";
import { useQueryClient } from "@tanstack/react-query";

const statusColors: Record<string, string> = {
  draft: "bg-orange-100 text-orange-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

type Line = { accountName: string; accountId?: number; description: string; debit: string; credit: string };
type FormData = { companyId: string; entryDate: string; description: string; reference: string; status: string; lines: Line[] };

const EMPTY_LINE: Line = { accountName: "", description: "", debit: "0", credit: "0" };
const EMPTY: FormData = {
  companyId: "", entryDate: new Date().toISOString().split("T")[0],
  description: "", reference: "", status: "draft",
  lines: [{ ...EMPTY_LINE }, { ...EMPTY_LINE }],
};

export function JournalEntriesList() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY);

  const { data: entries = [], isLoading } = useListJournalEntries();
  const { data: companies = [] } = useListCompanies();
  const { data: coaAccounts = [] } = useListChartOfAccounts();
  const { filterByCompany } = useActiveCompany();

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/journal-entries"] });
  const createMutation = useCreateJournalEntry({ mutation: { onSuccess: () => { invalidate(); setOpen(false); toast({ title: "Journal entry created." }); }, onError: (e: any) => toast({ title: e?.message ?? "Failed", variant: "destructive" }) } });
  const updateMutation = useUpdateJournalEntry({ mutation: { onSuccess: () => { invalidate(); setOpen(false); toast({ title: "Updated." }); }, onError: (e: any) => toast({ title: e?.message ?? "Failed", variant: "destructive" }) } });
  const deleteMutation = useDeleteJournalEntry({ mutation: { onSuccess: () => { invalidate(); toast({ title: "Deleted." }); } } });
  const approveMutation = useApproveJournalEntry({ mutation: { onSuccess: () => { invalidate(); toast({ title: "Journal entry approved." }); }, onError: (e: any) => toast({ title: e?.message ?? "Failed", variant: "destructive" }) } });

  const filtered = filterByCompany(entries).filter(e =>
    (statusFilter === "all" || e.status === statusFilter) &&
    (!search || e.journalNumber.toLowerCase().includes(search.toLowerCase()) || e.description.toLowerCase().includes(search.toLowerCase()))
  );

  const selectedEntry = entries.find(e => e.id === detailId);

  const openCreate = () => { setEditId(null); setForm({ ...EMPTY, lines: [{ ...EMPTY_LINE }, { ...EMPTY_LINE }] }); setOpen(true); };
  const openEdit = (e: any) => {
    if (e.status === "approved") { toast({ title: "Cannot edit approved entries.", variant: "destructive" }); return; }
    setEditId(e.id);
    setForm({
      companyId: String(e.companyId), entryDate: e.entryDate, description: e.description,
      reference: e.reference ?? "", status: e.status,
      lines: (e.lines ?? []).map((l: any) => ({ accountName: l.accountName, accountId: l.accountId, description: l.description ?? "", debit: String(l.debit ?? 0), credit: String(l.credit ?? 0) })),
    });
    setOpen(true);
  };

  const totalDebit = form.lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalCredit = form.lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  const setLine = (i: number, k: keyof Line, v: string) => setForm(p => { const lines = [...p.lines]; lines[i] = { ...lines[i], [k]: v }; return { ...p, lines }; });
  const addLine = () => setForm(p => ({ ...p, lines: [...p.lines, { ...EMPTY_LINE }] }));
  const removeLine = (i: number) => setForm(p => ({ ...p, lines: p.lines.filter((_, idx) => idx !== i) }));

  const handleSave = () => {
    if (!isBalanced) { toast({ title: "Debit and credit must balance.", variant: "destructive" }); return; }
    const payload = {
      ...form, companyId: parseInt(form.companyId, 10),
      lines: form.lines.map((l, i) => ({ accountName: l.accountName, accountId: l.accountId, description: l.description, debit: parseFloat(l.debit) || 0, credit: parseFloat(l.credit) || 0, sortOrder: i })),
    };
    if (editId) updateMutation.mutate({ id: editId, data: payload as any });
    else createMutation.mutate({ data: payload as any });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Journal Entries</h1>
          <p className="text-muted-foreground">Manual accounting journal vouchers with double-entry bookkeeping.</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu
            data={filtered as Record<string, unknown>[]}
            columns={[
              { header: "Journal No.", key: "journalNumber" },
              { header: "Date", key: "entryDate" },
              { header: "Description", key: "description" },
              { header: "Reference", key: "reference" },
              { header: "Total Debit", key: "totalDebit", format: v => Number(v ?? 0).toFixed(2) },
              { header: "Total Credit", key: "totalCredit", format: v => Number(v ?? 0).toFixed(2) },
              { header: "Status", key: "status" },
            ]}
            filename="journal-entries"
            title="Journal Entries"
            size="sm"
          />
          <Button className="bg-[#0f2d5a] hover:bg-[#1e6ab0]" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />New Journal Entry
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search journal entries..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Journal No.</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="text-right">Total Debit</TableHead>
              <TableHead className="text-right">Total Credit</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12">
                  <BookOpen className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-muted-foreground">No journal entries yet.</p>
                </TableCell>
              </TableRow>
            ) : filtered.map(e => (
              <TableRow key={e.id} className="hover:bg-muted/40 cursor-pointer" onClick={() => setDetailId(e.id)}>
                <TableCell className="font-mono text-sm font-medium text-primary">{e.journalNumber}</TableCell>
                <TableCell>{e.entryDate}</TableCell>
                <TableCell className="max-w-[200px] truncate">{e.description}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{(e as any).reference || "-"}</TableCell>
                <TableCell className="text-right font-mono text-sm">AED {(e.totalDebit ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                <TableCell className="text-right font-mono text-sm">AED {(e.totalCredit ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                <TableCell onClick={ev => ev.stopPropagation()}>
                  <Badge variant="secondary" className={statusColors[e.status] ?? ""}>{e.status}</Badge>
                </TableCell>
                <TableCell onClick={ev => ev.stopPropagation()}>
                  <div className="flex gap-1 justify-end">
                    {e.status === "draft" && (
                      <>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(e)}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600 hover:text-green-800" title="Approve" onClick={() => { if (confirm("Approve this journal entry?")) approveMutation.mutate({ id: e.id }); }}><CheckCircle className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => { if (confirm("Delete?")) deleteMutation.mutate({ id: e.id }); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Detail Dialog */}
      <Dialog open={detailId !== null} onOpenChange={v => { if (!v) setDetailId(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <DialogTitle className="font-mono text-[#0f2d5a]">{selectedEntry?.journalNumber}</DialogTitle>
              <Badge variant="secondary" className={statusColors[selectedEntry?.status ?? "draft"] ?? ""}>{selectedEntry?.status}</Badge>
            </div>
          </DialogHeader>
          {selectedEntry && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Date:</span> <span className="font-medium">{selectedEntry.entryDate}</span></div>
                <div><span className="text-muted-foreground">Reference:</span> <span className="font-medium">{(selectedEntry as any).reference || "—"}</span></div>
                <div className="col-span-2"><span className="text-muted-foreground">Description:</span> <span className="font-medium">{selectedEntry.description}</span></div>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Account</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Debit (AED)</TableHead>
                      <TableHead className="text-right">Credit (AED)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {((selectedEntry as any).lines ?? []).map((l: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium text-sm">{l.accountName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{l.description || "—"}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{l.debit > 0 ? l.debit.toFixed(2) : "—"}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{l.credit > 0 ? l.credit.toFixed(2) : "—"}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/30 font-semibold">
                      <TableCell colSpan={2} className="text-right text-sm">Total</TableCell>
                      <TableCell className="text-right font-mono text-sm">{(selectedEntry.totalDebit ?? 0).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{(selectedEntry.totalCredit ?? 0).toFixed(2)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              {selectedEntry.status === "draft" && (
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => openEdit(selectedEntry)}>
                    <Pencil className="w-4 h-4 mr-2" />Edit
                  </Button>
                  <Button className="bg-green-700 hover:bg-green-800" onClick={() => { if (confirm("Approve this journal entry?")) { approveMutation.mutate({ id: selectedEntry.id }); setDetailId(null); } }}>
                    <CheckCircle className="w-4 h-4 mr-2" />Approve
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create / Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Edit Journal Entry" : "New Journal Entry"}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Company *</Label>
                <Select value={form.companyId} onValueChange={v => setForm(p => ({ ...p, companyId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{companies.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.shortName}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Entry Date *</Label>
                <Input type="date" value={form.entryDate} onChange={e => setForm(p => ({ ...p, entryDate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Reference</Label>
                <Input value={form.reference} onChange={e => setForm(p => ({ ...p, reference: e.target.value }))} placeholder="Optional ref" />
              </div>
              <div className="space-y-1 col-span-3">
                <Label>Description *</Label>
                <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} placeholder="Journal entry description..." />
              </div>
            </div>

            {/* Lines */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-semibold">Journal Lines</Label>
                <Button size="sm" variant="outline" onClick={addLine}><Plus className="w-3.5 h-3.5 mr-1" />Add Line</Button>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Account *</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-32 text-right">Debit (AED)</TableHead>
                      <TableHead className="w-32 text-right">Credit (AED)</TableHead>
                      <TableHead className="w-8"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {form.lines.map((line, i) => (
                      <TableRow key={i}>
                        <TableCell className="py-1.5">
                          {coaAccounts.length > 0 ? (
                            <Select value={line.accountName} onValueChange={v => {
                              const acc = coaAccounts.find(a => a.accountName === v);
                              setLine(i, "accountName", v);
                              if (acc) setForm(p => { const lines = [...p.lines]; lines[i] = { ...lines[i], accountName: v, accountId: acc.id }; return { ...p, lines }; });
                            }}>
                              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select account" /></SelectTrigger>
                              <SelectContent>
                                {coaAccounts.map(a => <SelectItem key={a.id} value={a.accountName}>{a.accountCode} — {a.accountName}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input className="h-8 text-sm" value={line.accountName} onChange={e => setLine(i, "accountName", e.target.value)} placeholder="Account name" />
                          )}
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Input className="h-8 text-sm" value={line.description} onChange={e => setLine(i, "description", e.target.value)} placeholder="Optional" />
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Input className="h-8 text-sm text-right" type="number" value={line.debit} onChange={e => setLine(i, "debit", e.target.value)} />
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Input className="h-8 text-sm text-right" type="number" value={line.credit} onChange={e => setLine(i, "credit", e.target.value)} />
                        </TableCell>
                        <TableCell className="py-1.5">
                          {form.lines.length > 2 && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => removeLine(i)}>
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={2} className="text-right text-sm font-semibold text-muted-foreground">Totals</TableCell>
                      <TableCell className={`text-right font-mono font-bold text-sm ${isBalanced ? "text-green-700" : "text-red-700"}`}>{totalDebit.toFixed(2)}</TableCell>
                      <TableCell className={`text-right font-mono font-bold text-sm ${isBalanced ? "text-green-700" : "text-red-700"}`}>{totalCredit.toFixed(2)}</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              {!isBalanced && totalDebit > 0 && (
                <p className="text-xs text-red-600 font-medium">Debit and credit totals must be equal. Difference: {Math.abs(totalDebit - totalCredit).toFixed(2)}</p>
              )}
              {isBalanced && (
                <p className="text-xs text-green-600 font-medium">Balanced</p>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="bg-[#0f2d5a] hover:bg-[#1e6ab0]" onClick={handleSave} disabled={!form.companyId || !form.description || !isBalanced || createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? "Saving..." : editId ? "Update" : "Create Journal Entry"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
