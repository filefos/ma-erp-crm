import { useState } from "react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { useListDepartments, useCreateDepartment, useUpdateDepartment, getListDepartmentsQueryKey } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export function DepartmentsAdmin() {
  const { activeCompanyId } = useActiveCompany();
  const isElite = activeCompanyId === 2;
  const primeBtnCls = isElite ? "bg-[#0D0D0D] hover:bg-[#8B0000]" : "bg-[#0f2d5a] hover:bg-[#1e6ab0]";
  const { data: depts, isLoading } = useListDepartments();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListDepartmentsQueryKey() });

  const create = useCreateDepartment({
    mutation: { onSuccess: () => { invalidate(); setOpen(false); setForm({ name: "", description: "" }); } },
  });
  const update = useUpdateDepartment({
    mutation: { onSuccess: () => { invalidate(); setEditId(null); setForm({ name: "", description: "" }); } },
  });

  const openEdit = (d: { id: number; name: string; description?: string | null }) => {
    setForm({ name: d.name, description: d.description ?? "" });
    setEditId(d.id);
  };

  const submit = () => {
    if (editId) update.mutate({ id: editId, data: form });
    else create.mutate({ data: form });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Departments</h1>
          <p className="text-muted-foreground text-sm">Organisational departments shared across both companies.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className={primeBtnCls}><Plus className="w-4 h-4 mr-2" />Add Department</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Department</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <div className="space-y-1"><Label>Name *</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Description</Label><Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
            </div>
            <Button className={`mt-3 ${primeBtnCls}`} onClick={submit} disabled={!form.name || create.isPending}>
              {create.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : depts?.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No departments.</TableCell></TableRow>
            ) : depts?.map(d => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{d.description ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className={d.isActive ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}>
                    {d.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(d)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={editId !== null} onOpenChange={(o) => !o && setEditId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Department</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1"><Label>Name</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Description</Label><Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
          </div>
          <Button className={`mt-3 ${primeBtnCls}`} onClick={submit} disabled={!form.name || update.isPending}>
            {update.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
