import { useEffect, useState } from "react";
import {
  useGetProformaInvoice,
  useUpdateProformaInvoice,
  getGetProformaInvoiceQueryKey,
  getListProformaInvoicesQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Save } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { PAYMENT_TERMS_PRESETS, getPresetByKey } from "@/lib/payment-terms";

interface Props { id: string }

interface FormState {
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientTrn: string;
  companyTrn: string;
  projectName: string;
  projectLocation: string;
  subtotal: number;
  vatPercent: number;
  vatAmount: number;
  total: number;
  paymentTerms: string;
  validityDate: string;
  status: string;
  notes: string;
}

export function ProformaInvoiceEdit({ id }: Props) {
  const pid = parseInt(id, 10);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: pi, isLoading } = useGetProformaInvoice(pid, {
    query: { queryKey: getGetProformaInvoiceQueryKey(pid), enabled: !!pid },
  });

  const [form, setForm] = useState<FormState>({
    clientName: "", clientEmail: "", clientPhone: "",
    clientTrn: "", companyTrn: "",
    projectName: "", projectLocation: "",
    subtotal: 0, vatPercent: 5, vatAmount: 0, total: 0,
    paymentTerms: "", validityDate: "", status: "draft", notes: "",
  });

  useEffect(() => {
    if (!pi) return;
    setForm({
      clientName: pi.clientName ?? "",
      clientEmail: (pi as any).clientEmail ?? "",
      clientPhone: (pi as any).clientPhone ?? "",
      clientTrn: (pi as any).clientTrn ?? "",
      companyTrn: (pi as any).companyTrn ?? "",
      projectName: pi.projectName ?? "",
      projectLocation: (pi as any).projectLocation ?? "",
      subtotal: (pi as any).subtotal ?? 0,
      vatPercent: (pi as any).vatPercent ?? 5,
      vatAmount: (pi as any).vatAmount ?? 0,
      total: pi.total ?? 0,
      paymentTerms: pi.paymentTerms ?? "",
      validityDate: pi.validityDate ?? "",
      status: pi.status ?? "draft",
      notes: (pi as any).notes ?? "",
    });
  }, [pi]);

  // Auto-recalc VAT and total when subtotal or VAT% change
  useEffect(() => {
    const vatAmount = +(form.subtotal * form.vatPercent / 100).toFixed(2);
    const total = +(form.subtotal + vatAmount).toFixed(2);
    setForm(p => (p.vatAmount === vatAmount && p.total === total ? p : { ...p, vatAmount, total }));
  }, [form.subtotal, form.vatPercent]);

  const update = useUpdateProformaInvoice({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetProformaInvoiceQueryKey(pid) });
        queryClient.invalidateQueries({ queryKey: getListProformaInvoicesQueryKey() });
        toast({ title: "Proforma Invoice updated." });
        navigate("/sales/proforma-invoices/" + pid);
      },
      onError: () => toast({ title: "Failed to update.", variant: "destructive" }),
    },
  });

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading…</div>;
  if (!pi) return <div className="text-muted-foreground p-8">Proforma Invoice not found.</div>;

  const handleSave = () => {
    if (!pi.companyId) return;
    update.mutate({
      id: pid,
      data: {
        companyId: pi.companyId,
        clientName: form.clientName,
        projectName: form.projectName || undefined,
        quotationId: (pi as any).quotationId,
        subtotal: form.subtotal,
        vatAmount: form.vatAmount,
        total: form.total,
        paymentTerms: form.paymentTerms || undefined,
        validityDate: form.validityDate || undefined,
        status: form.status,
        // Pass extra editable fields not in the typed body — the server stores them via spread.
        ...({
          vatPercent: form.vatPercent,
          clientEmail: form.clientEmail || null,
          clientPhone: form.clientPhone || null,
          clientTrn: form.clientTrn || null,
          companyTrn: form.companyTrn || null,
          projectLocation: form.projectLocation || null,
          notes: form.notes || null,
        } as Record<string, unknown>),
      },
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/sales/proforma-invoices/${pid}`}><ArrowLeft className="w-4 h-4 mr-1" />Back</Link>
        </Button>
        <h1 className="text-xl font-semibold">Edit Proforma Invoice — {pi.piNumber}</h1>
        <div className="ml-auto">
          <Button onClick={handleSave} disabled={update.isPending} className="bg-[#0f2d5a] hover:bg-[#1e6ab0]">
            <Save className="w-4 h-4 mr-1" />{update.isPending ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Client & Project</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Client Name</Label>
            <Input value={form.clientName} onChange={e => setForm(p => ({ ...p, clientName: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>Client Email</Label>
            <Input value={form.clientEmail} onChange={e => setForm(p => ({ ...p, clientEmail: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>Client Phone</Label>
            <Input value={form.clientPhone} onChange={e => setForm(p => ({ ...p, clientPhone: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>Client TRN</Label>
            <Input value={form.clientTrn} onChange={e => setForm(p => ({ ...p, clientTrn: e.target.value }))} placeholder="e.g. 100123456700003" data-testid="input-client-trn" />
          </div>
          <div className="space-y-1">
            <Label>Company TRN</Label>
            <Input value={form.companyTrn} onChange={e => setForm(p => ({ ...p, companyTrn: e.target.value }))} placeholder="e.g. 105383255400003" data-testid="input-company-trn" />
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm(p => ({ ...p, status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Project Name</Label>
            <Input value={form.projectName} onChange={e => setForm(p => ({ ...p, projectName: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>Project Location</Label>
            <Input value={form.projectLocation} onChange={e => setForm(p => ({ ...p, projectLocation: e.target.value }))} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Amounts</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label>Subtotal</Label>
            <Input type="number" value={form.subtotal} onChange={e => setForm(p => ({ ...p, subtotal: parseFloat(e.target.value) || 0 }))} />
          </div>
          <div className="space-y-1">
            <Label>VAT %</Label>
            <Input type="number" value={form.vatPercent} onChange={e => setForm(p => ({ ...p, vatPercent: parseFloat(e.target.value) || 0 }))} />
          </div>
          <div className="space-y-1">
            <Label>VAT Amount</Label>
            <Input type="number" value={form.vatAmount} readOnly className="bg-muted" />
          </div>
          <div className="space-y-1">
            <Label>Grand Total</Label>
            <Input type="number" value={form.total} readOnly className="bg-muted font-semibold" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Terms</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Validity Date</Label>
            <Input value={form.validityDate} onChange={e => setForm(p => ({ ...p, validityDate: e.target.value }))} placeholder="e.g. 30 days" />
          </div>
          <div className="space-y-1">
            <Label>Payment Terms</Label>
            <Select
              onValueChange={(key) => {
                const preset = getPresetByKey(key);
                if (preset) setForm(p => ({ ...p, paymentTerms: preset.text }));
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Pick a standard preset…" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_TERMS_PRESETS.map(p => (
                  <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input value={form.paymentTerms} onChange={e => setForm(p => ({ ...p, paymentTerms: e.target.value }))} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Notes</Label>
            <Textarea rows={3} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
