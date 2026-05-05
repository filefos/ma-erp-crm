import { useState } from "react";
import { useListTaxInvoices } from "@workspace/api-client-react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";
import { Search } from "lucide-react";
import { ExportMenu } from "@/components/ExportMenu";
import { WhatsAppQuickIcon } from "@/components/whatsapp-button";
import { AccountsPageHeader } from "@/components/accounts-page-header";

const paymentStatusColors: Record<string, string> = {
  paid: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  partial: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  unpaid: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export function TaxInvoicesList() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const { data: invoices, isLoading } = useListTaxInvoices({ search: search || undefined });
  const { filterByCompany } = useActiveCompany();
  const filtered = filterByCompany(invoices ?? []).filter(i => status === "all" || i.paymentStatus === status);

  const totalOutstanding = filtered?.reduce((s, i) => s + (i.balance ?? 0), 0) ?? 0;

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
