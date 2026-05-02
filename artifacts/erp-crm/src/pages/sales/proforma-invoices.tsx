import { useState } from "react";
import { useListProformaInvoices, useCreateProformaInvoice, useListCompanies } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

export function ProformaInvoicesList() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    clientName: "", clientEmail: "", clientPhone: "",
    projectName: "", projectLocation: "", total: "",
    vatPercent: "5", validityDate: "", paymentTerms: "50% advance, 50% on delivery",
    companyId: "", notes: "",
  });
  const queryClient = useQueryClient();
  const { data: invoices, isLoading } = useListProformaInvoices();
  const { data: companies } = useListCompanies();
  const create = useCreateProformaInvoice({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/proforma-invoices"] });
        setOpen(false);
        setForm({ clientName: "", clientEmail: "", clientPhone: "", projectName: "", projectLocation: "", total: "", vatPercent: "5", validityDate: "", paymentTerms: "50% advance, 50% on delivery", companyId: "", notes: "" });
      },
    },
  });

  const filtered = invoices?.filter(i =>
    !search ||
    i.piNumber.toLowerCase().includes(search.toLowerCase()) ||
    i.clientName.toLowerCase().includes(search.toLowerCase())
  );

  const totalValue = filtered?.reduce((s, i) => s + (i.total ?? 0), 0) ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Proforma Invoices</h1>
          <p className="text-muted-foreground">Pre-shipment invoices sent to clients.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#0f2d5a] hover:bg-[#1e6ab0]"><Plus className="w-4 h-4 mr-2" />New Proforma</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>New Proforma Invoice</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3 pt-2 max-h-[70vh] overflow-y-auto pr-1">
              <div className="space-y-1 col-span-2"><Label>Client Name *</Label><Input value={form.clientName} onChange={e => setForm(p => ({...p, clientName: e.target.value}))} /></div>
              <div className="space-y-1"><Label>Client Email</Label><Input type="email" value={form.clientEmail} onChange={e => setForm(p => ({...p, clientEmail: e.target.value}))} /></div>
              <div className="space-y-1"><Label>Client Phone</Label><Input value={form.clientPhone} onChange={e => setForm(p => ({...p, clientPhone: e.target.value}))} /></div>
              <div className="space-y-1"><Label>Project Name</Label><Input value={form.projectName} onChange={e => setForm(p => ({...p, projectName: e.target.value}))} /></div>
              <div className="space-y-1"><Label>Project Location</Label><Input value={form.projectLocation} onChange={e => setForm(p => ({...p, projectLocation: e.target.value}))} /></div>
              <div className="space-y-1"><Label>Total Amount (AED) *</Label><Input type="number" value={form.total} onChange={e => setForm(p => ({...p, total: e.target.value}))} /></div>
              <div className="space-y-1"><Label>VAT %</Label>
                <Select value={form.vatPercent} onValueChange={v => setForm(p => ({...p, vatPercent: v}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0% (Exempt)</SelectItem>
                    <SelectItem value="5">5% (Standard)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Validity Date</Label><Input type="date" value={form.validityDate} onChange={e => setForm(p => ({...p, validityDate: e.target.value}))} /></div>
              <div className="space-y-1"><Label>Company *</Label>
                <Select value={form.companyId} onValueChange={v => setForm(p => ({...p, companyId: v}))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{companies?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.shortName}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1 col-span-2"><Label>Payment Terms</Label><Input value={form.paymentTerms} onChange={e => setForm(p => ({...p, paymentTerms: e.target.value}))} /></div>
            </div>
            <Button
              className="mt-4 bg-[#0f2d5a] hover:bg-[#1e6ab0]"
              onClick={() => create.mutate({ data: { ...form, total: parseFloat(form.total) || 0, vatPercent: parseFloat(form.vatPercent), companyId: parseInt(form.companyId, 10) } as any })}
              disabled={!form.clientName || !form.total || !form.companyId || create.isPending}
            >
              {create.isPending ? "Creating..." : "Create Proforma"}
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center justify-between">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search proforma invoices..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="text-sm text-muted-foreground">
          Total: <span className="font-semibold text-foreground">AED {totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PI Number</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Project</TableHead>
              <TableHead className="text-right">Total (AED)</TableHead>
              <TableHead>Valid Until</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow> :
            filtered?.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No proforma invoices found.</TableCell></TableRow> :
            filtered?.map(inv => (
              <TableRow key={inv.id}>
                <TableCell className="font-medium text-primary font-mono text-sm">{inv.piNumber}</TableCell>
                <TableCell className="font-medium">{inv.clientName}</TableCell>
                <TableCell>{inv.projectName || "-"}</TableCell>
                <TableCell className="text-right font-medium">AED {(inv.total ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                <TableCell>{inv.validityDate || "-"}</TableCell>
                <TableCell><Badge variant="secondary" className={statusColors[inv.status] ?? ""}>{inv.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
