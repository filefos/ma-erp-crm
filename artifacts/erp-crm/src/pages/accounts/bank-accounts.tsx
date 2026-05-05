import { useState } from "react";
import { useListBankAccounts, useCreateBankAccount, useListCompanies } from "@workspace/api-client-react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CompanyField } from "@/components/CompanyField";
import { Landmark, Plus } from "lucide-react";
import { ExportMenu } from "@/components/ExportMenu";
import { useQueryClient } from "@tanstack/react-query";
import { AccountsPageHeader } from "@/components/accounts-page-header";

const CURRENCIES = ["AED","USD","EUR","GBP","SAR","INR"];

export function BankAccountsList() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    bankName: "", accountName: "", accountNumber: "", iban: "",
    swiftCode: "", currency: "AED", companyId: "", branch: "",
  });
  const queryClient = useQueryClient();
  const { data: accounts, isLoading } = useListBankAccounts();
  const { data: companies } = useListCompanies();
  const { filterByCompany, companyName } = useActiveCompany();
  const filtered = filterByCompany(accounts ?? []);
  const create = useCreateBankAccount({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/bank-accounts"] });
        setOpen(false);
        setForm({ bankName: "", accountName: "", accountNumber: "", iban: "", swiftCode: "", currency: "AED", companyId: "", branch: "" });
      },
    },
  });

  const getCompanyName = (companyId: number | null) => companies?.find(c => c.id === companyId)?.name ?? "-";
  const getCompanyShortName = (companyId: number | null) => companies?.find(c => c.id === companyId)?.shortName ?? "-";

  return (
    <div className="space-y-4">
      {/* Cheque-favor notice — pinned above the page so it is unmissable */}
      <div className="rounded-xl border-2 border-[#0f2d5a] bg-gradient-to-r from-[#0f2d5a]/5 to-[#1e6ab0]/5 px-4 py-3 shadow-sm" data-testid="banner-cheque-favor">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#0f2d5a] to-[#1e6ab0] text-white">
            <Landmark className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <div className="text-[11px] font-bold uppercase tracking-wide text-[#0f2d5a]">Important — Cheque Instructions</div>
            <div className="text-sm font-semibold text-[#0f2d5a] dark:text-white">
              All cheques shall be prepared in favor of "{(companyName ?? "").toUpperCase()}".
            </div>
          </div>
        </div>
      </div>

      <AccountsPageHeader
        title="Bank Accounts"
        breadcrumb="Accounts"
        subtitle="Company bank account details for both entities."
        right={
          <>
          <ExportMenu
            data={filtered}
            columns={[
              { header: "Bank Name", key: "bankName" },
              { header: "Account Name", key: "accountName" },
              { header: "Account No.", key: "accountNumber" },
              { header: "IBAN", key: "iban" },
              { header: "SWIFT", key: "swiftCode" },
              { header: "Currency", key: "currency" },
              { header: "Branch", key: "branch" },
            ]}
            filename="bank-accounts"
            title="Bank Accounts"
          />
          <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#0f2d5a] hover:bg-[#1e6ab0]"><Plus className="w-4 h-4 mr-2" />Add Bank Account</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Add Bank Account</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="space-y-1 col-span-2"><Label>Bank Name *</Label><Input value={form.bankName} onChange={e => setForm(p => ({...p, bankName: e.target.value}))} placeholder="Emirates NBD, Mashreq, ADCB..." /></div>
              <div className="space-y-1 col-span-2"><Label>Account Name *</Label><Input value={form.accountName} onChange={e => setForm(p => ({...p, accountName: e.target.value}))} placeholder="PRIME MAX PREFAB HOUSES IND. LLC." /></div>
              <div className="space-y-1"><Label>Account Number *</Label><Input value={form.accountNumber} onChange={e => setForm(p => ({...p, accountNumber: e.target.value}))} /></div>
              <div className="space-y-1"><Label>Currency</Label>
                <Select value={form.currency} onValueChange={v => setForm(p => ({...p, currency: v}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1 col-span-2"><Label>IBAN</Label><Input value={form.iban} onChange={e => setForm(p => ({...p, iban: e.target.value}))} placeholder="AE070331234567890123456" /></div>
              <div className="space-y-1"><Label>SWIFT Code</Label><Input value={form.swiftCode} onChange={e => setForm(p => ({...p, swiftCode: e.target.value}))} placeholder="EBILAEAD" /></div>
              <div className="space-y-1"><Label>Branch</Label><Input value={form.branch} onChange={e => setForm(p => ({...p, branch: e.target.value}))} placeholder="Main Branch" /></div>
              <div className="space-y-1 col-span-2"><Label>Company *</Label>
                <CompanyField value={form.companyId} onChange={v => setForm(p => ({...p, companyId: v}))} />
              </div>
            </div>
            <Button
              className="mt-4 bg-[#0f2d5a] hover:bg-[#1e6ab0]"
              onClick={() => create.mutate({ data: { ...form, companyId: parseInt(form.companyId, 10) } as any })}
              disabled={!form.bankName || !form.accountName || !form.accountNumber || !form.companyId || create.isPending}
            >
              {create.isPending ? "Saving..." : "Add Bank Account"}
            </Button>
          </DialogContent>
        </Dialog>
          </>
        }
      />

      {isLoading ? <div className="text-muted-foreground">Loading...</div> :
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map(acc => (
          <Card key={acc.id} className="relative overflow-hidden hover:shadow-md transition-shadow">
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Landmark className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">{acc.bankName}</CardTitle>
                  <p className="text-xs text-muted-foreground">{getCompanyShortName(acc.companyId)}</p>
                </div>
              </div>
              <Badge variant="secondary" className={acc.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}>
                {acc.isActive ? "Active" : "Inactive"}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <div>
                <div className="text-xs text-muted-foreground">Account Name</div>
                <div className="text-sm font-medium">{acc.accountName}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Account Number</div>
                <div className="text-sm font-mono">{acc.accountNumber}</div>
              </div>
              {acc.iban && <div>
                <div className="text-xs text-muted-foreground">IBAN</div>
                <div className="text-xs font-mono break-all text-muted-foreground">{acc.iban}</div>
              </div>}
              {acc.swiftCode && <div>
                <div className="text-xs text-muted-foreground">SWIFT</div>
                <div className="text-sm font-mono">{acc.swiftCode}</div>
              </div>}
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-muted-foreground">Currency</span>
                <Badge variant="outline" className="font-mono">{acc.currency}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-3 text-center py-16 text-muted-foreground">
            <Landmark className="w-12 h-12 mx-auto mb-3 opacity-20" />
            No bank accounts found. Add your first account.
          </div>
        )}
      </div>}
    </div>
  );
}
