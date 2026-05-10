import { useState } from "react";
import { useListAssets, useCreateAsset } from "@workspace/api-client-react";
import type { CreateAssetBody } from "@workspace/api-client-react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CompanyField } from "@/components/CompanyField";
import { useListCompanies } from "@workspace/api-client-react";
import { Search, Plus } from "lucide-react";
import { ExportMenu } from "@/components/ExportMenu";
import { useQueryClient } from "@tanstack/react-query";
import { getListAssetsQueryKey } from "@workspace/api-client-react";

const CATEGORIES = ["Vehicles & Equipment","Machinery","Furniture & Fixtures","IT Equipment","Tools","Other"];
const CONDITIONS = ["excellent","good","fair","poor","out_of_service"];
const conditionColors: Record<string, string> = {
  excellent: "bg-green-100 text-green-800", good: "bg-blue-100 text-blue-800",
  fair: "bg-orange-100 text-orange-800", poor: "bg-orange-100 text-orange-800", out_of_service: "bg-red-100 text-red-800",
};

export function AssetsList() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", category: "Machinery", purchaseDate: "", purchaseValue: "", currentLocation: "", assignedTo: "", condition: "good", companyId: "", notes: "" });
  const queryClient = useQueryClient();
  const { data: assets, isLoading } = useListAssets({ search: search || undefined });
  const { filterByCompany, activeCompanyId } = useActiveCompany();
  const isElite = activeCompanyId === 2;
  const primeBtnCls = isElite ? "bg-[#0D0D0D] hover:bg-[#8B0000]" : "bg-[#0f2d5a] hover:bg-[#1e6ab0]";
  const filtered = filterByCompany(assets ?? []);
  const { data: companies } = useListCompanies();
  const create = useCreateAsset({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListAssetsQueryKey() }); setOpen(false); } } });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Asset Register</h1>
          <p className="text-muted-foreground">Track all company assets — vehicles, machinery, equipment.</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu
            data={filtered}
            columns={[
              { header: "Asset Name", key: "name" },
              { header: "Category", key: "category" },
              { header: "Purchase Date", key: "purchaseDate" },
              { header: "Purchase Value (AED)", key: "purchaseValue", format: v => Number(v ?? 0).toFixed(2) },
              { header: "Location", key: "currentLocation" },
              { header: "Assigned To", key: "assignedTo" },
              { header: "Condition", key: "condition" },
            ]}
            filename="assets"
            title="Asset Register"
          />
          <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className={primeBtnCls}><Plus className="w-4 h-4 mr-2" />Add Asset</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Asset</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-1 col-span-2"><Label>Asset Name *</Label><Input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} /></div>
              <div className="space-y-1"><Label>Company *</Label>
                <CompanyField value={form.companyId} onChange={v => setForm(p => ({...p, companyId: v}))} />
              </div>
              <div className="space-y-1"><Label>Category *</Label>
                <Select value={form.category} onValueChange={v => setForm(p => ({...p, category: v}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Purchase Date</Label><Input type="date" value={form.purchaseDate} onChange={e => setForm(p => ({...p, purchaseDate: e.target.value}))} /></div>
              <div className="space-y-1"><Label>Purchase Value (AED)</Label><Input type="number" value={form.purchaseValue} onChange={e => setForm(p => ({...p, purchaseValue: e.target.value}))} /></div>
              <div className="space-y-1"><Label>Current Location</Label><Input value={form.currentLocation} onChange={e => setForm(p => ({...p, currentLocation: e.target.value}))} /></div>
              <div className="space-y-1"><Label>Assigned To</Label><Input value={form.assignedTo} onChange={e => setForm(p => ({...p, assignedTo: e.target.value}))} /></div>
              <div className="space-y-1"><Label>Condition</Label>
                <Select value={form.condition} onValueChange={v => setForm(p => ({...p, condition: v}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CONDITIONS.map(c => <SelectItem key={c} value={c} className="capitalize">{c.replace("_"," ")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <Button
              className="mt-4"
              onClick={() => {
                const body: CreateAssetBody = {
                  name: form.name,
                  category: form.category,
                  purchaseDate: form.purchaseDate || undefined,
                  purchaseValue: parseFloat(form.purchaseValue) || 0,
                  currentLocation: form.currentLocation || undefined,
                  assignedTo: form.assignedTo || undefined,
                  condition: form.condition || undefined,
                  companyId: parseInt(form.companyId, 10),
                  notes: form.notes || undefined,
                };
                create.mutate({ data: body });
              }}
              disabled={!form.name || !form.companyId || create.isPending}
            >
              {create.isPending ? "Saving..." : "Add Asset"}
            </Button>
          </DialogContent>
        </Dialog>
        </div>
      </div>
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search assets..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asset ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead className="text-right">Value (AED)</TableHead>
              <TableHead>Condition</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow> :
            filtered.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No assets found.</TableCell></TableRow> :
            filtered.map(a => (
              <TableRow key={a.id}>
                <TableCell className="font-mono text-xs text-primary">{a.assetId}</TableCell>
                <TableCell className="font-medium">{a.name}</TableCell>
                <TableCell>{a.category}</TableCell>
                <TableCell>{a.currentLocation || "-"}</TableCell>
                <TableCell>{a.assignedTo || "-"}</TableCell>
                <TableCell className="text-right">AED {a.purchaseValue?.toLocaleString()}</TableCell>
                <TableCell><Badge variant="secondary" className={conditionColors[a.condition ?? "good"] ?? ""}>{a.condition?.replace("_"," ")}</Badge></TableCell>
                <TableCell><Badge variant="secondary" className={a.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"}>{a.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
