import { useState } from "react";
import { useListLpos, useCreateLpo, useListCompanies } from "@workspace/api-client-react";
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

export function LposList() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    lpoNumber: "", clientName: "", lpoDate: "", lpoValue: "",
    paymentTerms: "30 days", projectRef: "", companyId: "",
  });
  const queryClient = useQueryClient();
  const { data: lpos, isLoading } = useListLpos();
  const { data: companies } = useListCompanies();
  const create = useCreateLpo({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/lpos"] });
        setOpen(false);
        setForm({ lpoNumber: "", clientName: "", lpoDate: "", lpoValue: "", paymentTerms: "30 days", projectRef: "", companyId: "" });
      },
    },
  });

  const filtered = lpos?.filter(l =>
    !search ||
    l.lpoNumber.toLowerCase().includes(search.toLowerCase()) ||
    l.clientName.toLowerCase().includes(search.toLowerCase())
  );

  const totalValue = filtered?.reduce((s, l) => s + (l.lpoValue ?? 0), 0) ?? 0;
  const activeCount = lpos?.filter(l => l.status === "active").length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Local Purchase Orders (LPO)</h1>
          <p className="text-muted-foreground">LPOs received from clients for confirmed orders.</p>
        </div>
        <div className="flex items-center gap-3">
          <ExportMenu
            data={(lpos ?? []) as Record<string, unknown>[]}
            columns={[
              { header: "LPO Number", key: "lpoNumber" },
              { header: "Client", key: "clientName" },
              { header: "Project", key: "projectName" },
              { header: "Total (AED)", key: "total", format: v => Number(v ?? 0).toFixed(2) },
              { header: "Status", key: "status" },
              { header: "LPO Date", key: "lpoDate" },
              { header: "Validity Date", key: "validityDate" },
            ]}
            filename="lpos"
            title="Local Purchase Orders (LPO)"
            size="sm"
          />
          {activeCount > 0 && (
            <div className="text-sm text-muted-foreground"><span className="font-semibold text-foreground">{activeCount}</span> active LPOs</div>
          )}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#0f2d5a] hover:bg-[#1e6ab0]"><Plus className="w-4 h-4 mr-2" />Register LPO</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Register LPO</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="space-y-1 col-span-2"><Label>Client Name *</Label><Input value={form.clientName} onChange={e => setForm(p => ({...p, clientName: e.target.value}))} /></div>
                <div className="space-y-1"><Label>LPO Number *</Label><Input value={form.lpoNumber} onChange={e => setForm(p => ({...p, lpoNumber: e.target.value}))} placeholder="Client's LPO reference" /></div>
                <div className="space-y-1"><Label>LPO Date</Label><Input type="date" value={form.lpoDate} onChange={e => setForm(p => ({...p, lpoDate: e.target.value}))} /></div>
                <div className="space-y-1"><Label>LPO Value (AED) *</Label><Input type="number" value={form.lpoValue} onChange={e => setForm(p => ({...p, lpoValue: e.target.value}))} /></div>
                <div className="space-y-1"><Label>Payment Terms</Label>
                  <Select value={form.paymentTerms} onValueChange={v => setForm(p => ({...p, paymentTerms: v}))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="immediate">Immediate / Cash</SelectItem>
                      <SelectItem value="15 days">Net 15 Days</SelectItem>
                      <SelectItem value="30 days">Net 30 Days</SelectItem>
                      <SelectItem value="45 days">Net 45 Days</SelectItem>
                      <SelectItem value="60 days">Net 60 Days</SelectItem>
                      <SelectItem value="advance">100% Advance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Project Reference</Label><Input value={form.projectRef} onChange={e => setForm(p => ({...p, projectRef: e.target.value}))} /></div>
                <div className="space-y-1"><Label>Company *</Label>
                  <Select value={form.companyId} onValueChange={v => setForm(p => ({...p, companyId: v}))}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{companies?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.shortName}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                className="mt-4 bg-[#0f2d5a] hover:bg-[#1e6ab0]"
                onClick={() => create.mutate({ data: { ...form, lpoValue: parseFloat(form.lpoValue) || 0, companyId: parseInt(form.companyId, 10) } as any })}
                disabled={!form.clientName || !form.lpoNumber || !form.lpoValue || !form.companyId || create.isPending}
              >
                {create.isPending ? "Saving..." : "Register LPO"}
              </Button>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search LPOs..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="text-sm text-muted-foreground">
          Total value: <span className="font-semibold text-foreground">AED {totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>LPO Number</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>LPO Date</TableHead>
              <TableHead className="text-right">LPO Value (AED)</TableHead>
              <TableHead>Payment Terms</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow> :
            filtered?.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No LPOs found.</TableCell></TableRow> :
            filtered?.map(l => (
              <TableRow key={l.id}>
                <TableCell className="font-medium text-primary font-mono text-sm">{l.lpoNumber}</TableCell>
                <TableCell className="font-medium">{l.clientName}</TableCell>
                <TableCell>{l.lpoDate || "-"}</TableCell>
                <TableCell className="text-right font-medium">AED {(l.lpoValue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                <TableCell>{l.paymentTerms || "-"}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className={l.status === "active" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-gray-100 text-gray-700"}>
                    {l.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
