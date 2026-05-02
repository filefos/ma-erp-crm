import { useState } from "react";
import { useListDeals, useCreateDeal } from "@workspace/api-client-react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus } from "lucide-react";
import { ExportMenu } from "@/components/ExportMenu";
import { useQueryClient } from "@tanstack/react-query";
import { getListDealsQueryKey } from "@workspace/api-client-react";

const STAGES = ["new","qualification","proposal","negotiation","won","lost"];

const stageColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  qualification: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  proposal: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  negotiation: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  won: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  lost: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export function DealsList() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", clientName: "", value: "", stage: "new", probability: "0", expectedCloseDate: "" });
  const queryClient = useQueryClient();
  const { data: deals, isLoading } = useListDeals();
  const create = useCreateDeal({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListDealsQueryKey() }); setOpen(false); } } });

  const { filterByCompany } = useActiveCompany();
  const filtered = filterByCompany(deals ?? []).filter(d => !search || d.title.toLowerCase().includes(search.toLowerCase()) || d.clientName?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Deals</h1>
          <p className="text-muted-foreground">Track and manage your active deals.</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu
            data={(deals ?? []) as Record<string, unknown>[]}
            columns={[
              { header: "Title", key: "title" },
              { header: "Client", key: "clientName" },
              { header: "Value (AED)", key: "value", format: v => Number(v ?? 0).toFixed(2) },
              { header: "Probability (%)", key: "probability" },
              { header: "Stage", key: "stage" },
              { header: "Expected Close", key: "expectedCloseDate" },
            ]}
            filename="deals"
            title="Deals"
          />
          <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#0f2d5a] hover:bg-[#1e6ab0]"><Plus className="w-4 h-4 mr-2" />Add Deal</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Deal</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><Label>Title *</Label><Input value={form.title} onChange={e => setForm(p => ({...p, title: e.target.value}))} /></div>
                <div className="space-y-1"><Label>Client Name</Label><Input value={form.clientName} onChange={e => setForm(p => ({...p, clientName: e.target.value}))} /></div>
                <div className="space-y-1"><Label>Value (AED)</Label><Input type="number" value={form.value} onChange={e => setForm(p => ({...p, value: e.target.value}))} /></div>
                <div className="space-y-1"><Label>Probability (%)</Label><Input type="number" value={form.probability} onChange={e => setForm(p => ({...p, probability: e.target.value}))} /></div>
                <div className="space-y-1"><Label>Stage</Label>
                  <Select value={form.stage} onValueChange={v => setForm(p => ({...p, stage: v}))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STAGES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Expected Close Date</Label><Input type="date" value={form.expectedCloseDate} onChange={e => setForm(p => ({...p, expectedCloseDate: e.target.value}))} /></div>
              </div>
              <Button onClick={() => create.mutate({ data: { ...form, value: parseFloat(form.value) || 0, probability: parseFloat(form.probability) || 0 } as any })} disabled={!form.title || create.isPending}>
                {create.isPending ? "Saving..." : "Create Deal"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search deals..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Deal No.</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Value (AED)</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Probability</TableHead>
              <TableHead>Close Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow> :
            filtered?.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No deals found.</TableCell></TableRow> :
            filtered?.map(d => (
              <TableRow key={d.id}>
                <TableCell className="font-medium text-primary">{d.dealNumber}</TableCell>
                <TableCell className="font-medium">{d.title}</TableCell>
                <TableCell>{d.clientName || "-"}</TableCell>
                <TableCell className="font-medium">AED {d.value?.toLocaleString()}</TableCell>
                <TableCell><Badge variant="secondary" className={stageColors[d.stage] ?? ""}>{d.stage}</Badge></TableCell>
                <TableCell>{d.probability}%</TableCell>
                <TableCell>{d.expectedCloseDate || "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
