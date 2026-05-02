import { useState } from "react";
import { useListQuotations, useApproveQuotation } from "@workspace/api-client-react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";
import { Search, Plus, Check } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListQuotationsQueryKey } from "@workspace/api-client-react";
import { ExportMenu } from "@/components/ExportMenu";

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  expired: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
};

export function QuotationsList() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const queryClient = useQueryClient();
  const { data: quotations, isLoading } = useListQuotations({ status: status === "all" ? undefined : status, search: search || undefined });
  const approve = useApproveQuotation({ mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListQuotationsQueryKey() }) } });
  const { filterByCompany } = useActiveCompany();
  const filtered = filterByCompany(quotations ?? []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quotations</h1>
          <p className="text-muted-foreground">Manage quotations for both companies.</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu
            data={filtered as Record<string, unknown>[]}
            columns={[
              { header: "Quotation No.", key: "quotationNumber" },
              { header: "Client", key: "clientName" },
              { header: "Project", key: "projectName" },
              { header: "Total (AED)", key: "grandTotal", format: v => Number(v ?? 0).toFixed(2) },
              { header: "VAT (AED)", key: "vatAmount", format: v => Number(v ?? 0).toFixed(2) },
              { header: "Status", key: "status" },
              { header: "Validity", key: "validityDate" },
            ]}
            filename="quotations"
            title="Quotations"
          />
          <Button asChild className="bg-[#0f2d5a] hover:bg-[#1e6ab0]">
            <Link href="/sales/quotations/new"><Plus className="w-4 h-4 mr-2" />New Quotation</Link>
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search quotations..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {["draft","sent","approved","rejected","expired"].map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quotation No.</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Grand Total (AED)</TableHead>
              <TableHead>VAT (AED)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow> :
            filtered.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No quotations found.</TableCell></TableRow> :
            filtered.map(q => (
              <TableRow key={q.id}>
                <TableCell className="font-medium">
                  <Link href={`/sales/quotations/${q.id}`} className="text-primary hover:underline">{q.quotationNumber}</Link>
                </TableCell>
                <TableCell>{q.clientName}</TableCell>
                <TableCell>{q.projectName || "-"}</TableCell>
                <TableCell className="font-medium">AED {q.grandTotal?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                <TableCell>AED {q.vatAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                <TableCell><Badge variant="secondary" className={statusColors[q.status] ?? ""}>{q.status}</Badge></TableCell>
                <TableCell>
                  {q.status === "sent" && (
                    <Button size="sm" variant="outline" className="text-green-600 border-green-600 hover:bg-green-50"
                      onClick={() => approve.mutate({ id: q.id })}>
                      <Check className="w-3 h-3 mr-1" />Approve
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
