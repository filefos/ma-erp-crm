import { useState } from "react";
import { useListSuppliers, useCreateSupplier } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Plus, MessageCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListSuppliersQueryKey } from "@workspace/api-client-react";

export function SuppliersList() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", contactPerson: "", email: "", phone: "", address: "", trn: "", category: "", paymentTerms: "" });
  const queryClient = useQueryClient();
  const { data: suppliers, isLoading } = useListSuppliers({ search: search || undefined });
  const create = useCreateSupplier({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListSuppliersQueryKey() }); setOpen(false); } } });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Suppliers</h1>
          <p className="text-muted-foreground">Manage your vendor and supplier directory.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Add Supplier</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Supplier</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-4 pt-2">
              {([["name","Company Name *"],["contactPerson","Contact Person"],["email","Email"],["phone","Phone"],["address","Address"],["trn","TRN"],["category","Category"],["paymentTerms","Payment Terms"]] as const).map(([k,l]) => (
                <div key={k} className="space-y-1">
                  <Label>{l}</Label>
                  <Input value={(form as any)[k]} onChange={e => setForm(p => ({...p,[k]:e.target.value}))} />
                </div>
              ))}
            </div>
            <Button className="mt-4" onClick={() => create.mutate({ data: form as any })} disabled={!form.name || create.isPending}>
              {create.isPending ? "Saving..." : "Save Supplier"}
            </Button>
          </DialogContent>
        </Dialog>
      </div>
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search suppliers..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Supplier Name</TableHead>
              <TableHead>Contact Person</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Payment Terms</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow> :
            suppliers?.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No suppliers found.</TableCell></TableRow> :
            suppliers?.map(s => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{s.contactPerson || "-"}</TableCell>
                <TableCell>{s.category || "-"}</TableCell>
                <TableCell>{s.phone || "-"}</TableCell>
                <TableCell>{s.paymentTerms || "-"}</TableCell>
                <TableCell><Badge variant="secondary" className={s.isActive ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-800"}>{s.isActive ? "Active" : "Inactive"}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
