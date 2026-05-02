import { useState } from "react";
import { useListPurchaseRequests, useCreatePurchaseRequest, useListCompanies } from "@workspace/api-client-react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Search, Plus } from "lucide-react";
import { ExportMenu } from "@/components/ExportMenu";
import { useQueryClient } from "@tanstack/react-query";

const priorityColors: Record<string, string> = {
  low: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  normal: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  urgent: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const statusColors: Record<string, string> = {
  pending: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  ordered: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
};

export function PurchaseRequestsList() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    description: "", priority: "normal", requiredDate: "", companyId: "",
    projectRef: "", estimatedCost: "", notes: "",
  });
  const queryClient = useQueryClient();
  const { data: requests, isLoading } = useListPurchaseRequests({ status: status === "all" ? undefined : status });
  const { data: companies } = useListCompanies();
  const create = useCreatePurchaseRequest({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/purchase-requests"] });
        setOpen(false);
        setForm({ description: "", priority: "normal", requiredDate: "", companyId: "", projectRef: "", estimatedCost: "", notes: "" });
      },
    },
  });

  const { filterByCompany } = useActiveCompany();
  const filtered = filterByCompany(requests ?? []).filter(r =>
    !search ||
    r.prNumber.toLowerCase().includes(search.toLowerCase()) ||
    (r.description ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const pendingCount = requests?.filter(r => r.status === "pending").length ?? 0;
  const urgentCount = requests?.filter(r => r.priority === "urgent").length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Purchase Requests</h1>
          <p className="text-muted-foreground">Internal material and service purchase requests.</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu
            data={(requests ?? [])}
            columns={[
              { header: "PR Number", key: "prNumber" },
              { header: "Title", key: "title" },
              { header: "Priority", key: "priority" },
              { header: "Est. Cost (AED)", key: "estimatedCost", format: v => Number(v ?? 0).toFixed(2) },
              { header: "Status", key: "status" },
              { header: "Required By", key: "requiredDate" },
            ]}
            filename="purchase-requests"
            title="Purchase Requests"
          />
          <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#0f2d5a] hover:bg-[#1e6ab0]">
              <Plus className="w-4 h-4 mr-2" />New PR
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>New Purchase Request</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <div className="space-y-1"><Label>Description *</Label><Textarea value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} rows={2} placeholder="What materials or services are needed?" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Priority</Label>
                  <Select value={form.priority} onValueChange={v => setForm(p => ({...p, priority: v}))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">🚨 Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Required Date</Label><Input type="date" value={form.requiredDate} onChange={e => setForm(p => ({...p, requiredDate: e.target.value}))} /></div>
                <div className="space-y-1"><Label>Company *</Label>
                  <Select value={form.companyId} onValueChange={v => setForm(p => ({...p, companyId: v}))}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{companies?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.shortName}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Project Reference</Label><Input value={form.projectRef} onChange={e => setForm(p => ({...p, projectRef: e.target.value}))} placeholder="PRJ-xxx" /></div>
                <div className="space-y-1 col-span-2"><Label>Estimated Cost (AED)</Label><Input type="number" value={form.estimatedCost} onChange={e => setForm(p => ({...p, estimatedCost: e.target.value}))} /></div>
              </div>
              <div className="space-y-1"><Label>Notes</Label><Input value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} /></div>
            </div>
            <Button
              className="mt-4 bg-[#0f2d5a] hover:bg-[#1e6ab0]"
              onClick={() => create.mutate({ data: { ...form, companyId: parseInt(form.companyId, 10), estimatedCost: form.estimatedCost ? parseFloat(form.estimatedCost) : undefined } as any })}
              disabled={!form.description || !form.companyId || create.isPending}
            >
              {create.isPending ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {(pendingCount > 0 || urgentCount > 0) && (
        <div className="flex gap-3">
          {pendingCount > 0 && <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg text-orange-700 text-sm dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-400"><span className="font-semibold">{pendingCount}</span> awaiting approval</div>}
          {urgentCount > 0 && <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">🚨 <span className="font-semibold">{urgentCount}</span> urgent requests</div>}
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search PRs..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {["pending","approved","rejected","ordered"].map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PR Number</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Requested By</TableHead>
              <TableHead>Required Date</TableHead>
              <TableHead>Est. Cost</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow> :
            filtered?.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No purchase requests found.</TableCell></TableRow> :
            filtered?.map(pr => (
              <TableRow key={pr.id}>
                <TableCell className="font-medium text-primary font-mono text-sm">{pr.prNumber}</TableCell>
                <TableCell className="max-w-xs truncate">{pr.description}</TableCell>
                <TableCell className="text-sm">{(pr as any).requestedByName || "-"}</TableCell>
                <TableCell className="text-sm">{pr.requiredDate || "-"}</TableCell>
                <TableCell className="text-sm">{(pr as any).estimatedCost ? `AED ${parseFloat((pr as any).estimatedCost).toLocaleString()}` : "-"}</TableCell>
                <TableCell><Badge variant="secondary" className={priorityColors[pr.priority ?? "normal"] ?? ""}>{pr.priority}</Badge></TableCell>
                <TableCell><Badge variant="secondary" className={statusColors[pr.status] ?? ""}>{pr.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
