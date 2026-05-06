import { useState } from "react";
import {
  useListHandoverNotes, useUpdateHandoverNote, useListCompanies,
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
import { Search, PackageCheck, Pencil, CheckCircle, Plus, Trash2 } from "lucide-react";
import { ExportMenu } from "@/components/ExportMenu";
import { AccountsPageHeader } from "@/components/accounts-page-header";
import { useQueryClient } from "@tanstack/react-query";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  completed: "bg-blue-100 text-blue-800",
  signed: "bg-green-100 text-green-800",
};

interface HandoverItem { description: string; quantity: number; unit: string; }

interface EditForm {
  handoverDate: string;
  projectDescription: string;
  receivedByName: string;
  receivedByDesignation: string;
  clientRepresentative: string;
  status: string;
  notes: string;
  items: HandoverItem[];
}

const EMPTY_ITEM = (): HandoverItem => ({ description: "", quantity: 1, unit: "nos" });

export function HandoverNotesList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [detailId, setDetailId] = useState<number | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<EditForm>({
    handoverDate: "", projectDescription: "", receivedByName: "",
    receivedByDesignation: "", clientRepresentative: "",
    status: "draft", notes: "", items: [EMPTY_ITEM()],
  });

  const { data: notes = [], isLoading } = useListHandoverNotes();
  const { data: companies = [] } = useListCompanies();
  const { filterByCompany } = useActiveCompany();

  const updateMutation = useUpdateHandoverNote({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/handover-notes"] });
        setEditMode(false);
        toast({ title: "Handover Note updated." });
      },
      onError: (e: any) => toast({ title: e?.message ?? "Failed", variant: "destructive" }),
    },
  });

  const filtered = filterByCompany(notes).filter(n =>
    !search ||
    n.honNumber.toLowerCase().includes(search.toLowerCase()) ||
    n.clientName.toLowerCase().includes(search.toLowerCase()) ||
    ((n as any).projectRef ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const selectedNote = notes.find(n => n.id === detailId);

  const openDetail = (id: number) => {
    const n = notes.find(x => x.id === id);
    if (!n) return;
    setDetailId(id);
    setEditMode(false);
    const rawItems = (n as any).itemsHandedOver;
    let items: HandoverItem[] = [];
    try {
      items = typeof rawItems === "string" ? JSON.parse(rawItems) : (rawItems ?? []);
    } catch { items = []; }
    setForm({
      handoverDate: (n as any).handoverDate ?? "",
      projectDescription: (n as any).projectDescription ?? "",
      receivedByName: (n as any).receivedByName ?? "",
      receivedByDesignation: (n as any).receivedByDesignation ?? "",
      clientRepresentative: (n as any).clientRepresentative ?? "",
      status: n.status ?? "draft",
      notes: (n as any).notes ?? "",
      items: items.length > 0 ? items : [EMPTY_ITEM()],
    });
  };

  const handleSave = () => {
    if (!detailId) return;
    const validItems = form.items.filter(i => i.description.trim());
    updateMutation.mutate({
      id: detailId,
      data: { ...form, itemsHandedOver: validItems } as any,
    });
  };

  const updateItem = (idx: number, field: keyof HandoverItem, value: string | number) =>
    setForm(p => ({ ...p, items: p.items.map((it, i) => i === idx ? { ...it, [field]: value } : it) }));

  const addItem = () => setForm(p => ({ ...p, items: [...p.items, EMPTY_ITEM()] }));
  const removeItem = (idx: number) => setForm(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));

  const draft = notes.filter(n => n.status === "draft").length;

  return (
    <div className="space-y-4">
      <AccountsPageHeader
        title="Handover Notes"
        breadcrumb="Accounts"
        subtitle="Project handover documents issued at project completion — auto-created on LPO registration."
        right={
          <>
            {draft > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-lg text-orange-700 text-sm">
                <PackageCheck className="w-4 h-4" /> {draft} draft{draft !== 1 ? "s" : ""}
              </div>
            )}
            <ExportMenu
              data={filtered}
              columns={[
                { header: "HON Number", key: "honNumber" },
                { header: "Client", key: "clientName" },
                { header: "Project Ref", key: "projectRef" },
                { header: "LPO Number", key: "lpoNumber" },
                { header: "Handover Date", key: "handoverDate" },
                { header: "Received By", key: "receivedByName" },
                { header: "Status", key: "status" },
              ]}
              filename="handover-notes"
              title="Handover Notes"
              size="sm"
            />
          </>
        }
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by HON no., client, project..."
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
              <TableHead>HON Number</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>LPO Number</TableHead>
              <TableHead>Handover Date</TableHead>
              <TableHead>Received By</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No handover notes found. They are created automatically when an LPO is registered.</TableCell></TableRow>
            ) : filtered.map(n => (
              <TableRow
                key={n.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => openDetail(n.id)}
              >
                <TableCell>
                  {(n as any).projectRef ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-[#0f2d5a] text-white border border-blue-300/30 tracking-wide whitespace-nowrap">
                      {(n as any).projectRef}
                    </span>
                  ) : <span className="text-muted-foreground text-xs">—</span>}
                </TableCell>
                <TableCell className="font-medium font-mono text-sm text-primary">{n.honNumber}</TableCell>
                <TableCell className="font-medium">{n.clientName}</TableCell>
                <TableCell className="font-mono text-xs">{(n as any).lpoNumber || "—"}</TableCell>
                <TableCell>{(n as any).handoverDate || "—"}</TableCell>
                <TableCell>{(n as any).receivedByName || "—"}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className={STATUS_COLORS[n.status] ?? ""}>
                    {n.status}
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
                {selectedNote?.honNumber ?? "Handover Note"}
              </DialogTitle>
              <div className="flex items-center gap-2">
                {!editMode && (
                  <Button size="sm" variant="outline" onClick={() => setEditMode(true)}>
                    <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
                  </Button>
                )}
                <Badge variant="secondary" className={STATUS_COLORS[selectedNote?.status ?? "draft"] ?? ""}>
                  {selectedNote?.status}
                </Badge>
              </div>
            </div>
          </DialogHeader>

          {selectedNote && !editMode && (() => {
            const rawItems = (selectedNote as any).itemsHandedOver;
            let items: HandoverItem[] = [];
            try { items = typeof rawItems === "string" ? JSON.parse(rawItems) : (rawItems ?? []); } catch { items = []; }
            return (
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Client:</span> <span className="font-medium ml-1">{selectedNote.clientName}</span></div>
                  <div><span className="text-muted-foreground">LPO No.:</span> <span className="font-medium ml-1">{(selectedNote as any).lpoNumber || "—"}</span></div>
                  <div><span className="text-muted-foreground">Project:</span> <span className="font-medium ml-1">{(selectedNote as any).projectRef || "—"}</span></div>
                  <div><span className="text-muted-foreground">Handover Date:</span> <span className="font-medium ml-1">{(selectedNote as any).handoverDate || "—"}</span></div>
                  <div><span className="text-muted-foreground">Received By:</span> <span className="font-medium ml-1">{(selectedNote as any).receivedByName || "—"}</span></div>
                  <div><span className="text-muted-foreground">Designation:</span> <span className="font-medium ml-1">{(selectedNote as any).receivedByDesignation || "—"}</span></div>
                  <div className="col-span-2"><span className="text-muted-foreground">Client Rep.:</span> <span className="font-medium ml-1">{(selectedNote as any).clientRepresentative || "—"}</span></div>
                </div>
                {(selectedNote as any).projectDescription && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Project Description</p>
                    <p className="text-sm whitespace-pre-wrap border rounded p-3 bg-muted/30">{(selectedNote as any).projectDescription}</p>
                  </div>
                )}
                {items.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Items Handed Over</p>
                    <table className="w-full text-sm border rounded overflow-hidden">
                      <thead className="bg-[#0f2d5a] text-white">
                        <tr>
                          <th className="text-left px-3 py-2">Description</th>
                          <th className="text-center px-3 py-2 w-20">Qty</th>
                          <th className="text-left px-3 py-2 w-20">Unit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, i) => (
                          <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                            <td className="px-3 py-2">{item.description}</td>
                            <td className="px-3 py-2 text-center">{item.quantity}</td>
                            <td className="px-3 py-2">{item.unit}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {(selectedNote as any).notes && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
                    <p className="text-sm whitespace-pre-wrap border rounded p-3 bg-muted/30">{(selectedNote as any).notes}</p>
                  </div>
                )}
              </div>
            );
          })()}

          {editMode && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Handover Date</Label>
                  <Input type="date" value={form.handoverDate} onChange={e => setForm(p => ({ ...p, handoverDate: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="signed">Signed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Received By (Name)</Label>
                  <Input value={form.receivedByName} onChange={e => setForm(p => ({ ...p, receivedByName: e.target.value }))} placeholder="Client's representative name" />
                </div>
                <div className="space-y-1">
                  <Label>Designation</Label>
                  <Input value={form.receivedByDesignation} onChange={e => setForm(p => ({ ...p, receivedByDesignation: e.target.value }))} placeholder="Site Engineer, Project Manager..." />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label>Client Representative</Label>
                  <Input value={form.clientRepresentative} onChange={e => setForm(p => ({ ...p, clientRepresentative: e.target.value }))} placeholder="Company / authority representative" />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label>Project Description</Label>
                  <Textarea rows={2} value={form.projectDescription} onChange={e => setForm(p => ({ ...p, projectDescription: e.target.value }))} placeholder="Brief description of the project..." />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Items Handed Over</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addItem}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Item
                  </Button>
                </div>
                <div className="border rounded overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-3 py-2">Description *</th>
                        <th className="px-3 py-2 w-20 text-center">Qty</th>
                        <th className="px-3 py-2 w-20 text-left">Unit</th>
                        <th className="px-3 py-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.items.map((item, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="px-2 py-1">
                            <Input
                              value={item.description}
                              onChange={e => updateItem(idx, "description", e.target.value)}
                              placeholder="Item description"
                              className="h-8 text-sm"
                            />
                          </td>
                          <td className="px-2 py-1">
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={e => updateItem(idx, "quantity", parseFloat(e.target.value) || 1)}
                              className="h-8 text-sm text-center"
                              min={1}
                            />
                          </td>
                          <td className="px-2 py-1">
                            <Input
                              value={item.unit}
                              onChange={e => updateItem(idx, "unit", e.target.value)}
                              placeholder="nos"
                              className="h-8 text-sm"
                            />
                          </td>
                          <td className="px-2 py-1">
                            <Button
                              type="button" variant="ghost" size="sm"
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              onClick={() => removeItem(idx)}
                              disabled={form.items.length === 1}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-1">
                <Label>Notes</Label>
                <Textarea rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Any additional notes..." />
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
