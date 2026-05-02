import { useState } from "react";
import { useListEmployees, useCreateEmployee } from "@workspace/api-client-react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListCompanies } from "@workspace/api-client-react";
import { Search, Plus } from "lucide-react";
import { ExportMenu } from "@/components/ExportMenu";
import { useQueryClient } from "@tanstack/react-query";
import { getListEmployeesQueryKey } from "@workspace/api-client-react";

export function EmployeesList() {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", type: "staff", designation: "", companyId: "", phone: "", email: "", nationality: "", siteLocation: "", joiningDate: "" });
  const queryClient = useQueryClient();
  const { data: employees, isLoading } = useListEmployees({ type: type === "all" ? undefined : type, search: search || undefined });
  const { filterByCompany } = useActiveCompany();
  const filtered = filterByCompany(employees ?? []);
  const { data: companies } = useListCompanies();
  const create = useCreateEmployee({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() }); setOpen(false); } } });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Employees & Labour</h1>
          <p className="text-muted-foreground">Manage staff and labour workforce directory.</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu
            data={filtered as Record<string, unknown>[]}
            columns={[
              { header: "Emp. No.", key: "employeeNumber" },
              { header: "Name", key: "name" },
              { header: "Type", key: "type" },
              { header: "Designation", key: "designation" },
              { header: "Phone", key: "phone" },
              { header: "Nationality", key: "nationality" },
              { header: "Site", key: "siteLocation" },
              { header: "Joining Date", key: "joiningDate" },
            ]}
            filename="employees"
            title="Employees & Labour"
          />
          <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="bg-[#0f2d5a] hover:bg-[#1e6ab0]"><Plus className="w-4 h-4 mr-2" />Add Employee</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Employee / Labour</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-1 col-span-2"><Label>Full Name *</Label><Input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} /></div>
              <div className="space-y-1"><Label>Type *</Label>
                <Select value={form.type} onValueChange={v => setForm(p => ({...p, type: v}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="staff">Staff</SelectItem><SelectItem value="labor">Labour</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Company *</Label>
                <Select value={form.companyId} onValueChange={v => setForm(p => ({...p, companyId: v}))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{companies?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.shortName}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Designation</Label><Input value={form.designation} onChange={e => setForm(p => ({...p, designation: e.target.value}))} /></div>
              <div className="space-y-1"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(p => ({...p, phone: e.target.value}))} /></div>
              <div className="space-y-1"><Label>Nationality</Label><Input value={form.nationality} onChange={e => setForm(p => ({...p, nationality: e.target.value}))} /></div>
              <div className="space-y-1"><Label>Site / Location</Label><Input value={form.siteLocation} onChange={e => setForm(p => ({...p, siteLocation: e.target.value}))} /></div>
              <div className="space-y-1"><Label>Joining Date</Label><Input type="date" value={form.joiningDate} onChange={e => setForm(p => ({...p, joiningDate: e.target.value}))} /></div>
            </div>
            <Button className="mt-4" onClick={() => create.mutate({ data: { ...form, companyId: parseInt(form.companyId,10) } as any })} disabled={!form.name || !form.companyId || create.isPending}>
              {create.isPending ? "Saving..." : "Add Employee"}
            </Button>
          </DialogContent>
        </Dialog>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search employees..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="staff">Staff</SelectItem>
            <SelectItem value="labor">Labour</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Emp ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Designation</TableHead>
              <TableHead>Nationality</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Site</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow> :
            filtered.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No employees found.</TableCell></TableRow> :
            filtered.map(e => (
              <TableRow key={e.id}>
                <TableCell className="font-mono text-xs text-primary">{e.employeeId}</TableCell>
                <TableCell className="font-medium">{e.name}</TableCell>
                <TableCell><Badge variant="secondary" className={e.type === "staff" ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"}>{e.type}</Badge></TableCell>
                <TableCell>{e.designation || "-"}</TableCell>
                <TableCell>{e.nationality || "-"}</TableCell>
                <TableCell>{e.phone || "-"}</TableCell>
                <TableCell>{e.siteLocation || "-"}</TableCell>
                <TableCell><Badge variant="secondary" className={e.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>{e.isActive ? "Active" : "Inactive"}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
