import { useState, useEffect } from "react";
import { useGetCheque, useListBankAccounts, useListCompanies, getListChequesQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Pencil, Check, X, Printer, Download } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { numberToWords } from "@/lib/number-to-words";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  approved: "bg-blue-100 text-blue-800",
  printed: "bg-purple-100 text-purple-800",
  issued: "bg-orange-100 text-orange-800",
  cleared: "bg-green-100 text-green-800",
  bounced: "bg-red-100 text-red-800",
  cancelled: "bg-red-100 text-red-800",
};
const STATUSES = ["draft", "approved", "printed", "issued", "cleared", "bounced", "cancelled"];

function exportCSV(c: any) {
  const rows = [
    ["Cheque Number", c.chequeNumber],
    ["Payee", c.payeeName],
    ["Amount (AED)", c.amount],
    ["Amount in Words", c.amountInWords ?? ""],
    ["Date", c.chequeDate],
    ["Status", c.status],
    ["Bank", c.bankName ?? ""],
    ["Memo", c.voucherReference ?? ""],
  ];
  const csv = rows.map(r => r.map(String).map(v => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
  a.download = `Cheque-${c.chequeNumber}.csv`;
  a.click();
}

interface Props { id: string }

export function ChequeDetail({ id }: Props) {
  const cid = parseInt(id, 10);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const token = localStorage.getItem("erp_token");

  const { data: cheque, isLoading, refetch } = useGetCheque(cid);
  const { data: bankAccounts } = useListBankAccounts();
  const { data: companies } = useListCompanies();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    payeeName: "", chequeNumber: "", chequeDate: "", amount: "",
    bankAccountId: "", voucherReference: "", status: "draft", companyId: "",
  });

  useEffect(() => {
    if (cheque) {
      setForm({
        payeeName: (cheque as any).payeeName ?? "",
        chequeNumber: (cheque as any).chequeNumber ?? "",
        chequeDate: (cheque as any).chequeDate ?? "",
        amount: String((cheque as any).amount ?? ""),
        bankAccountId: String((cheque as any).bankAccountId ?? ""),
        voucherReference: (cheque as any).voucherReference ?? "",
        status: (cheque as any).status ?? "draft",
        companyId: String((cheque as any).companyId ?? ""),
      });
    }
  }, [cheque]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`/api/cheques/${cid}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...form,
          amount: parseFloat(form.amount) || 0,
          bankAccountId: parseInt(form.bankAccountId, 10),
          companyId: parseInt(form.companyId, 10),
          amountInWords: numberToWords(parseFloat(form.amount) || 0) + " UAE Dirhams Only",
        }),
      });
      await refetch();
      queryClient.invalidateQueries({ queryKey: getListChequesQueryKey() });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <div className="py-20 text-center text-muted-foreground">Loading cheque...</div>;
  if (!cheque) return <div className="py-20 text-center text-muted-foreground">Cheque not found.</div>;

  const c = cheque as any;
  const bank = bankAccounts?.find(b => b.id === c.bankAccountId);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/accounts/cheques"><ArrowLeft className="w-4 h-4 mr-1" />Back</Link>
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight font-mono">Cheque #{c.chequeNumber}</h1>
          <p className="text-sm text-muted-foreground">Cheque Detail</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className={STATUS_COLORS[c.status] ?? ""}>{c.status}</Badge>
          {!editing ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Pencil className="w-3.5 h-3.5 mr-1" />Edit</Button>
              <Button variant="outline" size="sm" onClick={() => exportCSV({ ...c, bankName: bank?.bankName })}><Download className="w-3.5 h-3.5 mr-1" />CSV</Button>
              <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="w-3.5 h-3.5 mr-1" />Print</Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditing(false)}><X className="w-3.5 h-3.5 mr-1" />Cancel</Button>
              <Button size="sm" className="bg-[#0f2d5a] hover:bg-[#1e6ab0]" onClick={handleSave} disabled={saving}>
                <Check className="w-3.5 h-3.5 mr-1" />{saving ? "Saving..." : "Save Changes"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Cheque visual */}
      <div className="border-2 border-gray-300 rounded-lg p-6 bg-gradient-to-br from-blue-50 to-white print:block">
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Bank</div>
            <div className="font-bold text-lg">{bank?.bankName ?? "—"}</div>
            <div className="text-sm text-muted-foreground">{bank?.accountName ?? ""}</div>
            <div className="text-xs font-mono text-muted-foreground">{bank?.accountNumber ?? ""}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Date</div>
            <div className="font-mono font-semibold">{c.chequeDate}</div>
            <div className="text-xs text-muted-foreground mt-2">Cheque No.</div>
            <div className="font-mono font-bold">{c.chequeNumber}</div>
          </div>
        </div>
        <div className="border-b border-dashed border-gray-300 mb-4" />
        <div className="mb-3">
          <div className="text-xs text-muted-foreground font-semibold">Pay to the order of</div>
          <div className="text-xl font-bold border-b border-gray-400 pb-1 mt-1">{c.payeeName}</div>
        </div>
        <div className="flex justify-between items-end">
          <div>
            <div className="text-xs text-muted-foreground">Amount in words</div>
            <div className="font-medium italic">{c.amountInWords ?? (numberToWords(c.amount ?? 0) + " UAE Dirhams Only")}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Amount (AED)</div>
            <div className="text-3xl font-bold text-[#0f2d5a]">{(c.amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>
        </div>
        {c.voucherReference && (
          <div className="mt-3 text-xs text-muted-foreground">Memo: {c.voucherReference}</div>
        )}
      </div>

      {/* Edit / Details form */}
      <Card>
        <CardHeader><CardTitle>Cheque Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          {editing ? (
            <>
              <div className="space-y-1 col-span-2"><Label>Payee Name *</Label><Input value={form.payeeName} onChange={e => setForm(p => ({...p, payeeName: e.target.value}))} /></div>
              <div className="space-y-1"><Label>Cheque Number *</Label><Input value={form.chequeNumber} onChange={e => setForm(p => ({...p, chequeNumber: e.target.value}))} /></div>
              <div className="space-y-1"><Label>Date *</Label><Input type="date" value={form.chequeDate} onChange={e => setForm(p => ({...p, chequeDate: e.target.value}))} /></div>
              <div className="space-y-1"><Label>Amount (AED) *</Label><Input type="number" value={form.amount} onChange={e => setForm(p => ({...p, amount: e.target.value}))} /></div>
              <div className="space-y-1"><Label>Bank Account</Label>
                <Select value={form.bankAccountId} onValueChange={v => setForm(p => ({...p, bankAccountId: v}))}>
                  <SelectTrigger><SelectValue placeholder="Select bank" /></SelectTrigger>
                  <SelectContent>{bankAccounts?.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.bankName} — {b.accountNumber}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(p => ({...p, status: v}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Company</Label>
                <Select value={form.companyId} onValueChange={v => setForm(p => ({...p, companyId: v}))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{companies?.map(co => <SelectItem key={co.id} value={String(co.id)}>{co.shortName}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1 col-span-2"><Label>Memo / Voucher Reference</Label><Input value={form.voucherReference} onChange={e => setForm(p => ({...p, voucherReference: e.target.value}))} /></div>
            </>
          ) : (
            <>
              <div><p className="text-xs text-muted-foreground">Payee</p><p className="font-medium">{c.payeeName}</p></div>
              <div><p className="text-xs text-muted-foreground">Amount</p><p className="font-bold text-lg">AED {(c.amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></div>
              <div><p className="text-xs text-muted-foreground">Cheque Date</p><p className="font-medium">{c.chequeDate}</p></div>
              <div><p className="text-xs text-muted-foreground">Bank Account</p><p className="font-medium">{bank?.bankName ?? "—"} — {bank?.accountNumber ?? ""}</p></div>
              <div><p className="text-xs text-muted-foreground">Status</p><Badge variant="secondary" className={STATUS_COLORS[c.status] ?? ""}>{c.status}</Badge></div>
              <div><p className="text-xs text-muted-foreground">Company</p><p className="font-medium">{companies?.find(co => co.id === c.companyId)?.name ?? "—"}</p></div>
              {c.voucherReference && <div className="col-span-2"><p className="text-xs text-muted-foreground">Memo</p><p className="font-medium">{c.voucherReference}</p></div>}
              <div className="col-span-2"><p className="text-xs text-muted-foreground">Created</p><p className="font-medium">{new Date(c.createdAt).toLocaleDateString()}</p></div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
