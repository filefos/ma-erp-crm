import { useState } from "react";
import { useListDeliveryNotes, useCreateDeliveryNote, useListCompanies } from "@workspace/api-client-react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CompanyField } from "@/components/CompanyField";
import { Search, Plus, Truck } from "lucide-react";
import { ExportMenu } from "@/components/ExportMenu";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { DelegateTaskButton } from "@/components/delegate-task-button";
import { AccountsPageHeader } from "@/components/accounts-page-header";

const statusColors: Record<string, string> = {
  pending: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
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

  const { filterByCompany, activeCompanyId } = useActiveCompany();
  const isElite = activeCompanyId === 2;
  const primeBtnCls = isElite ? "bg-[#0D0D0D] hover:bg-[#8B0000]" : "bg-[#0f2d5a] hover:bg-[#1e6ab0]";
  const filtered = filterByCompany(notes ?? []).filter(n =>
    !search ||
    n.dnNumber.toLowerCase().includes(search.toLowerCase()) ||
    n.clientName.toLowerCase().includes(search.toLowerCase())
  );

  const pending = notes?.filter(n => n.status === "pending").length ?? 0;

  return (
    <div className="space-y-4">
      <AccountsPageHeader
        title="Delivery Notes"
        breadcrumb="Accounts"
        subtitle="Track deliveries to client sites."
        right={
          <>
          <ExportMenu
            data={(notes ?? [])}
            columns={[
              { header: "DN Number", key: "dnNumber" },
              { header: "Client", key: "clientName" },
              { header: "Project", key: "projectName" },
              { header: "Delivery Date", key: "deliveryDate" },
              { header: "Status", key: "status" },
              { header: "Driver", key: "driverName" },
            ]}
            filename="delivery-notes"
            title="Delivery Notes"
            size="sm"
          />
          {pending > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-lg text-orange-700 text-sm dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-400">
              <Truck className="w-4 h-4" />{pending} pending
            </div>
          )}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className={primeBtnCls}><Plus className="w-4 h-4 mr-2" />New Delivery Note</Button>
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
                  <CompanyField value={form.companyId} onChange={v => setForm(p => ({...p, companyId: v}))} />
                </div>
              </div>
              <Button
                className={`mt-4 ${primeBtnCls}`}
                onClick={() => create.mutate({ data: { ...form, companyId: parseInt(form.companyId, 10) } as any })}
                disabled={!form.clientName || !form.companyId || create.isPending}
              >
                {create.isPending ? "Creating..." : "Create Delivery Note"}
              </Button>
            </DialogContent>
          </Dialog>
          </>
        }
      />
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by Project ID, DN no. or client..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project ID</TableHead>
              <TableHead>DN Number</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Delivery Date</TableHead>
              <TableHead>Driver</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow> :
            filtered?.length === 0 ? <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No delivery notes found.</TableCell></TableRow> :
            filtered?.map(n => (
              <TableRow key={n.id}>
                <TableCell>
                  {(n as any).projectRef ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-[#0f2d5a] text-white border border-blue-300/30 tracking-wide whitespace-nowrap">
                      {(n as any).projectRef}
                    </span>
                  ) : <span className="text-muted-foreground text-xs">—</span>}
                </TableCell>
                <TableCell className="font-medium font-mono text-sm">
                  <Link href={`/accounts/delivery-notes/${n.id}`} className="text-primary hover:underline">{n.dnNumber}</Link>
                </TableCell>
                <TableCell className="font-medium">{n.clientName}</TableCell>
                <TableCell>{n.projectName || "-"}</TableCell>
                <TableCell>{n.deliveryDate || "-"}</TableCell>
                <TableCell>{n.driverName || "-"}</TableCell>
                <TableCell className="font-mono text-xs">{(n as any).vehicleNumber || "-"}</TableCell>
                <TableCell><Badge variant="secondary" className={statusColors[n.status] ?? ""}>{n.status}</Badge></TableCell>
                <TableCell>
                  <DelegateTaskButton
                    taskType="delivery_note"
                    taskLabel={`Process Delivery Note ${n.dnNumber} — ${n.clientName}`}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
