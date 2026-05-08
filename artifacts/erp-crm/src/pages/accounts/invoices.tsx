import { useState } from "react";
import { useListTaxInvoices, useCreateTaxInvoice, getListTaxInvoicesQueryKey } from "@workspace/api-client-react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Link } from "wouter";
import { Search, Plus, Trash2 } from "lucide-react";
import { ExportMenu } from "@/components/ExportMenu";
import { WhatsAppQuickIcon } from "@/components/whatsapp-button";
import { AccountsPageHeader } from "@/components/accounts-page-header";
import { CompanyField } from "@/components/CompanyField";
import { useQueryClient } from "@tanstack/react-query";
import { DelegateTaskButton } from "@/components/delegate-task-button";

const paymentStatusColors: Record<string, string> = {
  paid: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  partial: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  unpaid: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

interface Item { description: string; quantity: number; unit: string; rate: number; amount: number; }
const emptyItem = (): Item => ({ description: "", quantity: 1, unit: "nos", rate: 0, amount: 0 });

const EMPTY_FORM = {
  companyId: "",
  clientName: "",
  clientTrn: "",
  projectName: "",
  projectRef: "",
  invoiceDate: new Date().toISOString().slice(0, 10),
  supplyDate: "",
  vatPercent: 5,
  paymentStatus: "unpaid",
};

export function TaxInvoicesList() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [items, setItems] = useState<Item[]>([emptyItem()]);
  const queryClient = useQueryClient();

  const { data: invoices, isLoading } = useListTaxInvoices({ search: search || undefined });
  const { filterByCompany } = useActiveCompany();
  const filtered = filterByCompany(invoices ?? []).filter(i => status === "all" || i.paymentStatus === status);
  const totalOutstanding = filtered?.reduce((s, i) => s + (i.balance ?? 0), 0) ?? 0;

  const subtotal = items.reduce((s, i) => s + i.amount, 0);
  const vatAmount = subtotal * (form.vatPercent / 100);
  const grandTotal = subtotal + vatAmount;

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

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setItems([emptyItem()]);
  };

  const create = useCreateTaxInvoice({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTaxInvoicesQueryKey() });
        setOpen(false);
        resetForm();
      },
    },
  });

  const handleCreate = () => {
    create.mutate({
      data: {
        companyId: parseInt(form.companyId, 10),
        clientName: form.clientName,
        clientTrn: form.clientTrn || undefined,
        projectName: form.projectName || undefined,
        projectRef: form.projectRef || undefined,
        invoiceDate: form.invoiceDate || undefined,
        supplyDate: form.supplyDate || undefined,
        subtotal,
        vatPercent: form.vatPercent,
        vatAmount,
        grandTotal,
        paymentStatus: form.paymentStatus,
      },
    });
  };

  return (
    <div className="space-y-4">
      <AccountsPageHeader
        title="Tax Invoices"
        subtitle="UAE VAT-compliant tax invoices."
        right={
          <>
            <ExportMenu
              data={filtered ?? []}
              columns={[
                { header: "Invoice No.", key: "invoiceNumber" },
                { header: "Client", key: "clientName" },
                { header: "Total (AED)", key: "total", format: v => Number(v ?? 0).toFixed(2) },
                { header: "VAT (AED)", key: "vatAmount", format: v => Number(v ?? 0).toFixed(2) },
                { header: "Paid (AED)", key: "amountPaid", format: v => Number(v ?? 0).toFixed(2) },
                { header: "Balance (AED)", key: "balance", format: v => Number(v ?? 0).toFixed(2) },
                { header: "Status", key: "paymentStatus" },
                { header: "Due Date", key: "dueDate" },
              ]}
              filename="tax-invoices"
              title="Tax Invoices"
              size="sm"
            />
            <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) resetForm(); }}>
              <DialogTrigger asChild>
                <Button className="bg-[#0f2d5a] hover:bg-[#1e6ab0]"><Plus className="w-4 h-4 mr-2" />New Tax Invoice</Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>New Tax Invoice</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <Card>
                    <CardHeader className="py-3"><CardTitle className="text-base">Client &amp; Project Details</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-2 gap-3">
                      <div className="space-y-1 col-span-2 sm:col-span-1">
                        <Label>Company *</Label>
                        <CompanyField value={form.companyId} onChange={v => setForm(p => ({ ...p, companyId: v }))} />
                      </div>
                      <div className="space-y-1"><Label>Client Name *</Label><Input value={form.clientName} onChange={e => setForm(p => ({ ...p, clientName: e.target.value }))} /></div>
                      <div className="space-y-1"><Label>Client TRN</Label><Input value={form.clientTrn} onChange={e => setForm(p => ({ ...p, clientTrn: e.target.value }))} placeholder="e.g. 100123456700003" /></div>
                      <div className="space-y-1"><Label>Project Name</Label><Input value={form.projectName} onChange={e => setForm(p => ({ ...p, projectName: e.target.value }))} /></div>
                      <div className="space-y-1"><Label>Project Ref / ID</Label><Input value={form.projectRef} onChange={e => setForm(p => ({ ...p, projectRef: e.target.value }))} /></div>
                      <div className="space-y-1"><Label>Invoice Date</Label><Input type="date" value={form.invoiceDate} onChange={e => setForm(p => ({ ...p, invoiceDate: e.target.value }))} /></div>
                      <div className="space-y-1"><Label>Supply Date</Label><Input type="date" value={form.supplyDate} onChange={e => setForm(p => ({ ...p, supplyDate: e.target.value }))} /></div>
                      <div className="space-y-1">
                        <Label>Payment Status</Label>
                        <Select value={form.paymentStatus} onValueChange={v => setForm(p => ({ ...p, paymentStatus: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unpaid">Unpaid</SelectItem>
                            <SelectItem value="partial">Partial</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>

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
                            <Select value={String(form.vatPercent)} onValueChange={v => setForm(p => ({ ...p, vatPercent: parseFloat(v) }))}>
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
                      {create.isPending ? "Creating..." : "Create Tax Invoice"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <div className="text-right border-l pl-3 ml-1">
              <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">Total Outstanding</div>
              <div className="text-base font-bold text-red-700">AED {totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            </div>
          </>
        }
      />
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by Project ID, invoice no. or client..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {["paid","partial","unpaid"].map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project ID</TableHead>
              <TableHead>Invoice No.</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Grand Total</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow> :
            filtered?.length === 0 ? <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No invoices found.</TableCell></TableRow> :
            filtered?.map(inv => {
              const today = new Date().toISOString().slice(0, 10);
              const hasBalance = inv.paymentStatus !== "paid" && Number(inv.balance ?? 0) > 0;
              const isOverdue = hasBalance && Boolean(inv.dueDate && inv.dueDate < today);
              return (
                <TableRow key={inv.id}>
                  <TableCell>
                    {(inv as any).projectRef ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-[#0f2d5a] text-white border border-blue-300/30 tracking-wide whitespace-nowrap">
                        {(inv as any).projectRef}
                      </span>
                    ) : <span className="text-muted-foreground text-xs">—</span>}
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link href={`/accounts/invoices/${inv.id}`} className="text-primary hover:underline">{inv.invoiceNumber}</Link>
                  </TableCell>
                  <TableCell>{inv.clientName}</TableCell>
                  <TableCell>{inv.invoiceDate || "-"}</TableCell>
                  <TableCell className="text-right font-medium">AED {inv.grandTotal?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right text-green-600">AED {inv.amountPaid?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right font-medium text-red-600">AED {inv.balance?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell><Badge variant="secondary" className={paymentStatusColors[inv.paymentStatus] ?? ""}>{inv.paymentStatus}</Badge></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {inv.clientPhone && (
                        <WhatsAppQuickIcon
                          phone={inv.clientPhone}
                          context="invoice"
                          defaultTemplateId={isOverdue ? "payment_reminder" : "invoice_sent"}
                          vars={{
                            name: inv.clientName,
                            companyName: inv.clientName,
                            number: inv.invoiceNumber,
                            amount: isOverdue
                              ? Number(inv.balance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })
                              : Number(inv.grandTotal ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 }),
                            dueDate: inv.dueDate,
                          }}
                          className="h-7 w-7"
                          testId={`button-wa-invoice-${inv.id}`}
                        />
                      )}
                      <DelegateTaskButton
                        taskType="tax_invoice"
                        taskLabel={`Follow up Invoice ${inv.invoiceNumber} — ${inv.clientName}`}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
