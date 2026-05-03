import { useState } from "react";
import { useListChartOfAccounts, useCreateChartOfAccount, useUpdateChartOfAccount, useDeleteChartOfAccount, useListCompanies } from "@workspace/api-client-react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CompanyField } from "@/components/CompanyField";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Pencil, Trash2, BookOpen, Library, Loader2 } from "lucide-react";
import { ExportMenu } from "@/components/ExportMenu";
import { useQueryClient } from "@tanstack/react-query";
import { CONSTRUCTION_COA_TEMPLATE, CONSTRUCTION_COA_COUNT } from "@/lib/construction-coa";

const ACCOUNT_TYPES = [
  "Assets", "Liabilities", "Equity", "Income", "Cost of Goods Sold",
  "Expenses", "Bank", "Cash", "VAT Input", "VAT Output",
];

const typeColors: Record<string, string> = {
  "Assets": "bg-blue-100 text-blue-800",
  "Liabilities": "bg-red-100 text-red-800",
  "Equity": "bg-purple-100 text-purple-800",
  "Income": "bg-green-100 text-green-800",
  "Cost of Goods Sold": "bg-orange-100 text-orange-800",
  "Expenses": "bg-orange-100 text-orange-800",
  "Bank": "bg-cyan-100 text-cyan-800",
  "Cash": "bg-teal-100 text-teal-800",
  "VAT Input": "bg-indigo-100 text-indigo-800",
  "VAT Output": "bg-pink-100 text-pink-800",
};

type FormData = {
  companyId: string; accountCode: string; accountName: string; accountType: string;
  openingBalance: string; currency: string; description: string; isActive: boolean;
};

const EMPTY: FormData = {
  companyId: "", accountCode: "", accountName: "", accountType: "Expenses",
  openingBalance: "0", currency: "AED", description: "", isActive: true,
};

export function ChartOfAccountsList() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY);

  const { data: accounts = [], isLoading } = useListChartOfAccounts();
  const { data: companies = [] } = useListCompanies();
  const { filterByCompany, activeCompanyId } = useActiveCompany();

  const invalidate = () => qc.invalidateQueries({
    predicate: q => {
      const k = q.queryKey?.[0];
      return typeof k === "string" && (k === "/chart-of-accounts" || k === "/api/chart-of-accounts");
    },
  });

  const createMutation = useCreateChartOfAccount({ mutation: { onSuccess: () => { invalidate(); setOpen(false); toast({ title: "Account created." }); }, onError: (e: any) => toast({ title: e?.message ?? "Failed", variant: "destructive" }) } });
  const updateMutation = useUpdateChartOfAccount({ mutation: { onSuccess: () => { invalidate(); setOpen(false); toast({ title: "Account updated." }); }, onError: (e: any) => toast({ title: e?.message ?? "Failed", variant: "destructive" }) } });
  const deleteMutation = useDeleteChartOfAccount({ mutation: { onSuccess: () => { invalidate(); toast({ title: "Account deleted." }); }, onError: (e: any) => toast({ title: e?.message ?? "Failed", variant: "destructive" }) } });
  const seedMutation = useCreateChartOfAccount();

  // ── Bulk-seed industry template ────────────────────────────────────────────
  const [seedOpen, setSeedOpen] = useState(false);
  const [seedCompanyId, setSeedCompanyId] = useState<string>("");
  const [seeding, setSeeding] = useState(false);
  const [seedProgress, setSeedProgress] = useState({ done: 0, skipped: 0, failed: 0 });

  const openSeed = () => {
    setSeedCompanyId(activeCompanyId ? String(activeCompanyId) : (companies[0]?.id ? String(companies[0].id) : ""));
    setSeedProgress({ done: 0, skipped: 0, failed: 0 });
    setSeedOpen(true);
  };

  const handleSeedTemplate = async () => {
    const companyIdNum = parseInt(seedCompanyId, 10);
    if (!companyIdNum) {
      toast({ title: "Pick a company first.", variant: "destructive" });
      return;
    }
    setSeeding(true);
    const existingCodes = new Set(
      accounts.filter(a => a.companyId === companyIdNum).map(a => a.accountCode)
    );

    let done = 0, skipped = 0, failed = 0;
    for (const seed of CONSTRUCTION_COA_TEMPLATE) {
      if (existingCodes.has(seed.accountCode)) {
        skipped += 1;
        setSeedProgress({ done, skipped, failed });
        continue;
      }
      try {
        await seedMutation.mutateAsync({
          data: {
            companyId: companyIdNum,
            accountCode: seed.accountCode,
            accountName: seed.accountName,
            accountType: seed.accountType,
            openingBalance: 0,
            currency: "AED",
            isActive: true,
          } as any,
        });
        existingCodes.add(seed.accountCode); // prevent re-creating on retry within same session
        done += 1;
      } catch {
        failed += 1;
      }
      setSeedProgress({ done, skipped, failed });
    }

    setSeeding(false);
    invalidate();
    toast({
      title: "Industry template loaded",
      description: `Created ${done}, skipped ${skipped} (already existed), failed ${failed}.`,
    });
    setTimeout(() => setSeedOpen(false), 600);
  };

  const filtered = filterByCompany(accounts).filter(a =>
    (typeFilter === "all" || a.accountType === typeFilter) &&
    (!search || a.accountName.toLowerCase().includes(search.toLowerCase()) || a.accountCode.toLowerCase().includes(search.toLowerCase()))
  );

  const openCreate = () => { setEditId(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (a: any) => {
    setEditId(a.id);
    setForm({ companyId: String(a.companyId), accountCode: a.accountCode, accountName: a.accountName, accountType: a.accountType, openingBalance: String(a.openingBalance ?? 0), currency: a.currency ?? "AED", description: a.description ?? "", isActive: a.isActive ?? true });
    setOpen(true);
  };

  const handleSave = () => {
    const payload = { ...form, companyId: parseInt(form.companyId, 10), openingBalance: parseFloat(form.openingBalance) || 0 };
    if (editId) updateMutation.mutate({ id: editId, data: payload as any });
    else createMutation.mutate({ data: payload as any });
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Chart of Accounts</h1>
          <p className="text-muted-foreground">Manage your company's account structure.</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu
            data={filtered}
            columns={[
              { header: "Code", key: "accountCode" },
              { header: "Account Name", key: "accountName" },
              { header: "Type", key: "accountType" },
              { header: "Opening Balance", key: "openingBalance", format: v => Number(v ?? 0).toFixed(2) },
              { header: "Currency", key: "currency" },
              { header: "Active", key: "isActive", format: v => v ? "Yes" : "No" },
            ]}
            filename="chart-of-accounts"
            title="Chart of Accounts"
            size="sm"
          />
          <Button variant="outline" onClick={openSeed} title={`Bulk-load ${CONSTRUCTION_COA_COUNT} construction industry accounts`}>
            <Library className="w-4 h-4 mr-2" />Load Industry Template
          </Button>
          <Button className="bg-[#0f2d5a] hover:bg-[#1e6ab0]" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />Add Account
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search accounts..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {ACCOUNT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{filtered.length} accounts</span>
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Account Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Opening Balance</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <BookOpen className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-muted-foreground">No accounts yet. Start by adding your chart of accounts.</p>
                </TableCell>
              </TableRow>
            ) : filtered.map(a => (
              <TableRow key={a.id} className="hover:bg-muted/40">
                <TableCell className="font-mono text-sm font-medium text-primary">{a.accountCode}</TableCell>
                <TableCell className="font-medium">{a.accountName}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className={typeColors[a.accountType] ?? "bg-gray-100 text-gray-700"}>
                    {a.accountType}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono">{(a.openingBalance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                <TableCell className="text-sm">{a.currency ?? "AED"}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className={a.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}>
                    {a.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 justify-end">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(a)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => { if (confirm("Delete this account?")) deleteMutation.mutate({ id: a.id }); }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={seedOpen} onOpenChange={(v) => { if (!seeding) setSeedOpen(v); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Load Construction Industry Chart of Accounts</DialogTitle>
            <DialogDescription>
              This will create {CONSTRUCTION_COA_COUNT} pre-defined accounts (Assets, Liabilities, Equity, Revenue, Cost of Sales, and Operating Expenses) tailored for prefab manufacturing & construction services. Existing account codes will be skipped.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="space-y-1">
              <Label>Target Company *</Label>
              <Select value={seedCompanyId} onValueChange={setSeedCompanyId} disabled={seeding}>
                <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
                <SelectContent>{companies.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {seeding || seedProgress.done + seedProgress.skipped + seedProgress.failed > 0 ? (
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs space-y-1">
                <div>Created: <span className="font-medium text-green-700">{seedProgress.done}</span></div>
                <div>Skipped (already exists): <span className="font-medium text-orange-700">{seedProgress.skipped}</span></div>
                <div>Failed: <span className="font-medium text-red-700">{seedProgress.failed}</span></div>
                <div className="text-muted-foreground pt-1">
                  Progress: {seedProgress.done + seedProgress.skipped + seedProgress.failed} / {CONSTRUCTION_COA_COUNT}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Tip: After loading, use the <span className="font-medium">Add Account</span> button to create your own custom accounts on top of this template.
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => setSeedOpen(false)} disabled={seeding}>
              {seeding ? "Working…" : "Close"}
            </Button>
            <Button className="bg-[#0f2d5a] hover:bg-[#1e6ab0]" onClick={handleSeedTemplate} disabled={!seedCompanyId || seeding}>
              {seeding ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Loading…</> : <>Load Template</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editId ? "Edit Account" : "New Account"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1 col-span-2">
              <Label>Company *</Label>
              <CompanyField value={form.companyId} onChange={v => setForm(p => ({ ...p, companyId: v }))} />
            </div>
            <div className="space-y-1">
              <Label>Account Code *</Label>
              <Input value={form.accountCode} onChange={e => setForm(p => ({ ...p, accountCode: e.target.value }))} placeholder="1100" />
            </div>
            <div className="space-y-1">
              <Label>Account Type *</Label>
              <Select value={form.accountType} onValueChange={v => setForm(p => ({ ...p, accountType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ACCOUNT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Account Name *</Label>
              <Input value={form.accountName} onChange={e => setForm(p => ({ ...p, accountName: e.target.value }))} placeholder="e.g. Accounts Receivable" />
            </div>
            <div className="space-y-1">
              <Label>Opening Balance (AED)</Label>
              <Input type="number" value={form.openingBalance} onChange={e => setForm(p => ({ ...p, openingBalance: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Currency</Label>
              <Select value={form.currency} onValueChange={v => setForm(p => ({ ...p, currency: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["AED","USD","EUR","GBP","SAR","INR"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} placeholder="Optional description..." />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input type="checkbox" id="isActive" checked={form.isActive} onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))} className="rounded" />
              <Label htmlFor="isActive" className="cursor-pointer">Active</Label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="bg-[#0f2d5a] hover:bg-[#1e6ab0]" onClick={handleSave} disabled={!form.companyId || !form.accountCode || !form.accountName || isPending}>
              {isPending ? "Saving..." : editId ? "Update" : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
