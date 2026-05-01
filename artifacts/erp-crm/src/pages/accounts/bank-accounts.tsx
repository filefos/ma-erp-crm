import { useListBankAccounts, useListCompanies } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Landmark } from "lucide-react";

export function BankAccountsList() {
  const { data: accounts, isLoading } = useListBankAccounts();
  const { data: companies } = useListCompanies();

  const getCompanyName = (companyId: number | null) => companies?.find(c => c.id === companyId)?.name ?? "-";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Bank Accounts</h1>
        <p className="text-muted-foreground">Company bank account details for both entities.</p>
      </div>
      {isLoading ? <div className="text-muted-foreground">Loading...</div> :
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {accounts?.map(acc => (
          <Card key={acc.id} className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Landmark className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">{acc.bankName}</CardTitle>
                  <p className="text-xs text-muted-foreground">{getCompanyName(acc.companyId)}</p>
                </div>
              </div>
              <Badge variant="secondary" className={acc.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}>{acc.isActive ? "Active" : "Inactive"}</Badge>
            </CardHeader>
            <CardContent className="space-y-2">
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
                <div className="text-sm font-mono break-all">{acc.iban}</div>
              </div>}
              {acc.swiftCode && <div>
                <div className="text-xs text-muted-foreground">SWIFT</div>
                <div className="text-sm font-mono">{acc.swiftCode}</div>
              </div>}
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-muted-foreground">Currency</span>
                <Badge variant="outline">{acc.currency}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
        {accounts?.length === 0 && <div className="col-span-3 text-center py-16 text-muted-foreground">No bank accounts found.</div>}
      </div>}
    </div>
  );
}
