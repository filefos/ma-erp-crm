import { useState } from "react";
import { useListDeliveryNotes, useCreateDeliveryNote, useListCompanies } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Truck } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  delivered: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export function DeliveryNotesList() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    clientName: "", projectName: "", deliveryLocation: "",
    deliveryDate: "", driverName: "", vehicleNumber: "", companyId: "",
  });
  const queryClient = useQueryClient();
  const { data: notes, isLoading } = useListDeliveryNotes();
  const { data: companies } = useListCompanies();
  const create = useCreateDeliveryNote({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/delivery-notes"] });
        setOpen(false);
        setForm({ clientName: "", projectName: "", deliveryLocation: "", deliveryDate: "", driverName: "", vehicleNumber: "", companyId: "" });
      },
    },
  });

  const filtered = notes?.filter(n =>
    !search ||
    n.dnNumber.toLowerCase().includes(search.toLowerCase()) ||
    n.clientName.toLowerCase().includes(search.toLowerCase())
  );

  const pending = notes?.filter(n => n.status === "pending").length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Delivery Notes</h1>
          <p className="text-muted-foreground">Track deliveries to client sites.</p>
        </div>
        <div className="flex items-center gap-3">
          {pending > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400">
              <Truck className="w-4 h-4" />{pending} pending
            </div>
          )}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#0f2d5a] hover:bg-[#1e6ab0]"><Plus className="w-4 h-4 mr-2" />New Delivery Note</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Create Delivery Note</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="space-y-1 col-span-2"><Label>Client Name *</Label><Input value={form.clientName} onChange={e => setForm(p => ({...p, clientName: e.target.value}))} /></div>
                <div className="space-y-1"><Label>Project Name</Label><Input value={form.projectName} onChange={e => setForm(p => ({...p, projectName: e.target.value}))} /></div>
                <div className="space-y-1"><Label>Delivery Date</Label><Input type="date" value={form.deliveryDate} onChange={e => setForm(p => ({...p, deliveryDate: e.target.value}))} /></div>
                <div className="space-y-1 col-span-2"><Label>Delivery Location / Site Address</Label><Input value={form.deliveryLocation} onChange={e => setForm(p => ({...p, deliveryLocation: e.target.value}))} placeholder="Site address or area" /></div>
                <div className="space-y-1"><Label>Driver Name</Label><Input value={form.driverName} onChange={e => setForm(p => ({...p, driverName: e.target.value}))} /></div>
                <div className="space-y-1"><Label>Vehicle No.</Label><Input value={form.vehicleNumber} onChange={e => setForm(p => ({...p, vehicleNumber: e.target.value}))} placeholder="Dubai A 12345" /></div>
                <div className="space-y-1 col-span-2"><Label>Company *</Label>
                  <Select value={form.companyId} onValueChange={v => setForm(p => ({...p, companyId: v}))}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{companies?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.shortName}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                className="mt-4 bg-[#0f2d5a] hover:bg-[#1e6ab0]"
                onClick={() => create.mutate({ data: { ...form, companyId: parseInt(form.companyId, 10) } as any })}
                disabled={!form.clientName || !form.companyId || create.isPending}
              >
                {create.isPending ? "Creating..." : "Create Delivery Note"}
              </Button>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search delivery notes..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>DN Number</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Delivery Location</TableHead>
              <TableHead>Delivery Date</TableHead>
              <TableHead>Driver</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow> :
            filtered?.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No delivery notes found.</TableCell></TableRow> :
            filtered?.map(n => (
              <TableRow key={n.id}>
                <TableCell className="font-medium text-primary font-mono text-sm">{n.dnNumber}</TableCell>
                <TableCell className="font-medium">{n.clientName}</TableCell>
                <TableCell>{n.projectName || "-"}</TableCell>
                <TableCell className="max-w-[160px] truncate">{n.deliveryLocation || "-"}</TableCell>
                <TableCell>{n.deliveryDate || "-"}</TableCell>
                <TableCell>{n.driverName || "-"}</TableCell>
                <TableCell className="font-mono text-xs">{(n as any).vehicleNumber || "-"}</TableCell>
                <TableCell><Badge variant="secondary" className={statusColors[n.status] ?? ""}>{n.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
