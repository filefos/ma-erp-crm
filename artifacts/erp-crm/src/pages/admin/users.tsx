import { useState } from "react";
import { useListUsers, useCreateUser } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListCompanies } from "@workspace/api-client-react";
import { Search, Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListUsersQueryKey } from "@workspace/api-client-react";

const ROLES = ["super_admin","admin","sales","accounts","finance","procurement","store","hr","production","management"];
const roleColors: Record<string, string> = {
  super_admin: "bg-red-100 text-red-800", admin: "bg-purple-100 text-purple-800", sales: "bg-blue-100 text-blue-800",
  accounts: "bg-green-100 text-green-800", finance: "bg-teal-100 text-teal-800", procurement: "bg-amber-100 text-amber-800",
  store: "bg-orange-100 text-orange-800", hr: "bg-indigo-100 text-indigo-800", production: "bg-cyan-100 text-cyan-800", management: "bg-violet-100 text-violet-800",
};

export function UsersList() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", role: "sales", companyId: "all" });
  const queryClient = useQueryClient();
  const { data: users, isLoading } = useListUsers();
  const { data: companies } = useListCompanies();
  const create = useCreateUser({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() }); setOpen(false); } } });

  const filtered = users?.filter(u => !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground">Manage system users and their access roles.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Add User</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New User</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-1 col-span-2"><Label>Full Name *</Label><Input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} /></div>
              <div className="space-y-1"><Label>Email *</Label><Input type="email" value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} /></div>
              <div className="space-y-1"><Label>Password *</Label><Input type="password" value={form.password} onChange={e => setForm(p => ({...p, password: e.target.value}))} /></div>
              <div className="space-y-1"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(p => ({...p, phone: e.target.value}))} /></div>
              <div className="space-y-1"><Label>Role *</Label>
                <Select value={form.role} onValueChange={v => setForm(p => ({...p, role: v}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r} className="capitalize">{r.replace("_"," ")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Company</Label>
                <Select value={form.companyId} onValueChange={v => setForm(p => ({...p, companyId: v}))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent><SelectItem value="all">Both Companies</SelectItem>{companies?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.shortName}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <Button className="mt-4" onClick={() => create.mutate({ data: { ...form, companyId: form.companyId && form.companyId !== "all" ? parseInt(form.companyId,10) : undefined } as any })} disabled={!form.name || !form.email || !form.password || create.isPending}>
              {create.isPending ? "Creating..." : "Create User"}
            </Button>
          </DialogContent>
        </Dialog>
      </div>
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search users..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow> :
            filtered?.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No users found.</TableCell></TableRow> :
            filtered?.map(u => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell><Badge variant="secondary" className={`${roleColors[u.role] ?? ""} capitalize`}>{u.role.replace("_"," ")}</Badge></TableCell>
                <TableCell>{(u as any).companyName || "All Companies"}</TableCell>
                <TableCell><Badge variant="secondary" className={u.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>{u.isActive ? "Active" : "Inactive"}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
