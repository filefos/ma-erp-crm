import { useState } from "react";
import { useListProformaInvoices, useCreateProformaInvoice, useListCompanies } from "@workspace/api-client-react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Plus, Trash2 } from "lucide-react";
import { ExportMenu } from "@/components/ExportMenu";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  pending: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

interface Item { description: string; quantity: number; unit: string; rate: number; amount: number; }
const emptyItem = (): Item => ({ description: "", quantity: 1, unit: "nos", rate: 0, amount: 0 });

const EMPTY_FORM = {
  clientName: "", clientEmail: "", clientPhone: "",
  projectName: "", projectLocation: "",
  vatPercent: 5, validityDate: "", paymentTerms: "50% advance, 50% on delivery",
  companyId: "", notes: "", status: "draft",
};

export function ProformaInvoicesList() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [items, setItems] = useState<Item[]>([emptyItem()]);
  const queryClient = useQueryClient();
  const { data: invoices, isLoading } = useListProformaInvoices();
  const { data: companies } = useListCompanies();

  const updateItem = (i: number, field: keyof Item, val: string | number) => {
    setItems(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: val };
      const qty = field === "quantity" ? Number(val) : next[i].quantity;
      const rate = field === "rate" ? Number(val) : next[i].rate;
      next[i].amount = qty * rate;
      return next;
    });
  };

  const subtotal = items.reduce((s, it) => s + it.amount, 0);
  const vatAmount = subtotal * form.vatPercent / 100;
  const grandTotal = subtotal + vatAmount;

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setItems([emptyItem()]);
  };

  const create = useCreateProformaInvoice({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/proforma-invoices"] });
        setOpen(false);
        resetForm();
      },
    },
  });

  const handleCreate = () => {
    if (!form.clientName || !form.companyId) return;
    create.mutate({ data: {
      ...form,
      companyId: parseInt(form.companyId, 10),
      vatPercent: form.vatPercent,
      subtotal,
      vatAmount,
      total: grandTotal,
      items,
    } as any });
  };

  const { filterByCompany } = useActiveCompany();
  const filtered = filterByCompany(invoices ?? []).filter(i =>
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
        <div className="flex items-center gap-2">
          <ExportMenu
            data={(invoices ?? []) as Record<string, unknown>[]}
            columns={[
              { header: "PI Number", key: "piNumber" },
              { header: "Client", key: "clientName" },
              { header: "Project", key: "projectName" },
              { header: "Total (AED)", key: "grandTotal", format: v => Number(v ?? 0).toFixed(2) },
              { header: "VAT (AED)", key: "vatAmount", format: v => Number(v ?? 0).toFixed(2) },
              { header: "Status", key: "status" },
              { header: "Validity Date", key: "validityDate" },
            ]}
            filename="proforma-invoices"
            title="Proforma Invoices"
          />
          <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-[#0f2d5a] hover:bg-[#1e6ab0]"><Plus className="w-4 h-4 mr-2" />New Proforma</Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>New Proforma Invoice</DialogTitle></DialogHeader>

            <div className="space-y-4 pt-2">
              {/* Client Details */}
              <Card>
                <CardHeader className="py-3"><CardTitle className="text-base">Client &amp; Project Details</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-3">
                  <div className="space-y-1 col-span-2 sm:col-span-1">
                    <Label>Company *</Label>
                    <Select value={form.companyId} onValueChange={v => setForm(p => ({...p, companyId: v}))}>
                      <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
                      <SelectContent>{companies?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1"><Label>Client Name *</Label><Input value={form.clientName} onChange={e => setForm(p => ({...p, clientName: e.target.value}))} /></div>
                  <div className="space-y-1"><Label>Client Email</Label><Input type="email" value={form.clientEmail} onChange={e => setForm(p => ({...p, clientEmail: e.target.value}))} /></div>
                  <div className="space-y-1"><Label>Client Phone</Label><Input value={form.clientPhone} onChange={e => setForm(p => ({...p, clientPhone: e.target.value}))} /></div>
                  <div className="space-y-1"><Label>Project Name</Label><Input value={form.projectName} onChange={e => setForm(p => ({...p, projectName: e.target.value}))} /></div>
                  <div className="space-y-1"><Label>Project Location</Label><Input value={form.projectLocation} onChange={e => setForm(p => ({...p, projectLocation: e.target.value}))} /></div>
                  <div className="space-y-1"><Label>Validity Date</Label><Input type="date" value={form.validityDate} onChange={e => setForm(p => ({...p, validityDate: e.target.value}))} /></div>
                  <div className="space-y-1"><Label>Payment Terms</Label><Input value={form.paymentTerms} onChange={e => setForm(p => ({...p, paymentTerms: e.target.value}))} /></div>
                </CardContent>
              </Card>

              {/* Line Items */}
              <Card>
                <CardHeader className="py-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Line Items</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => setItems(p => [...p, emptyItem()])}>
                    <Plus className="w-4 h-4 mr-1" />Add Row
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b">
                        <th className="text-left pb-2 font-semibold">Description</th>
                        <th className="text-right pb-2 font-semibold w-20">Qty</th>
                        <th className="text-left pb-2 font-semibold w-20 pl-2">Unit</th>
                        <th className="text-right pb-2 font-semibold w-28">Rate (AED)</th>
                        <th className="text-right pb-2 font-semibold w-32">Amount (AED)</th>
                        <th className="w-8"></th>
                      </tr></thead>
                      <tbody>
                        {items.map((item, i) => (
                          <tr key={i} className="border-b last:border-0">
                            <td className="py-1 pr-2"><Input value={item.description} onChange={e => updateItem(i, "description", e.target.value)} className="h-8" /></td>
                            <td className="py-1 px-1"><Input type="number" value={item.quantity} onChange={e => updateItem(i, "quantity", e.target.value)} className="h-8 text-right w-full" /></td>
                            <td className="py-1 px-1"><Input value={item.unit} onChange={e => updateItem(i, "unit", e.target.value)} className="h-8" /></td>
                            <td className="py-1 px-1"><Input type="number" value={item.rate} onChange={e => updateItem(i, "rate", e.target.value)} className="h-8 text-right w-full" /></td>
                            <td className="py-1 pl-1 text-right font-medium">AED {item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            <td className="py-1 pl-1">
                              {items.length > 1 && <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setItems(p => p.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" /></Button>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <div className="w-72 space-y-2">
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>AED {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-muted-foreground">VAT (%)</span>
                        <Select value={String(form.vatPercent)} onValueChange={v => setForm(p => ({...p, vatPercent: parseFloat(v)}))}>
                          <SelectTrigger className="w-24 h-7"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">0% (Exempt)</SelectItem>
                            <SelectItem value="5">5% (Standard)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">VAT Amount</span><span>AED {vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                      <Separator />
                      <div className="flex justify-between font-bold text-lg"><span>Grand Total</span><span className="text-primary">AED {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex gap-3 justify-end pt-2">
                <Button variant="outline" onClick={() => { setOpen(false); resetForm(); }}>Cancel</Button>
                <Button
                  className="bg-[#0f2d5a] hover:bg-[#1e6ab0]"
                  onClick={handleCreate}
                  disabled={!form.clientName || !form.companyId || create.isPending}
                >
                  {create.isPending ? "Creating..." : "Create Proforma Invoice"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        </div>
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
                <TableCell className="font-medium font-mono text-sm">
                  <Link href={`/sales/proforma-invoices/${inv.id}`} className="text-primary hover:underline">{inv.piNumber}</Link>
                </TableCell>
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
