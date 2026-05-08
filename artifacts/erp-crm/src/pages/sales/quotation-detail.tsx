import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { captureElementToPdfBase64 } from "@/lib/print-to-pdf";
import {
  useGetQuotation, useApproveQuotation, useCreateProformaInvoice,
  useCreateTaxInvoice, useCreateDeliveryNote,
  getGetQuotationQueryKey, useListCompanies,
  getListProformaInvoicesQueryKey, getListTaxInvoicesQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, FileText, Receipt, Package, ChevronDown, Pencil, Plus, Trash2, Mail, Loader2 } from "lucide-react";
import { ExportButtons } from "@/components/export-buttons";
import { useEmailCompose } from "@/contexts/email-compose-context";
import { DocumentPrint } from "@/components/document-print";
import type { DocumentData } from "@/components/document-print";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import {
  parsePaymentTerms,
  calculateInstallments,
  totalPercent,
  installmentToTermsText,
  type Installment,
} from "@/lib/payment-terms";

interface Props { id: string }

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

type ConvertTarget = "pi" | "tax";

export function QuotationDetail({ id }: Props) {
  const qid = parseInt(id, 10);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const { openCompose } = useEmailCompose();
  const [converting, setConverting] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [convertOpen, setConvertOpen] = useState<ConvertTarget | null>(null);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [selected, setSelected] = useState<boolean[]>([]);

  const { data: q, isLoading } = useGetQuotation(qid, {
    query: { queryKey: getGetQuotationQueryKey(qid), enabled: !!qid },
  });
  const { data: companies } = useListCompanies();

  const approve = useApproveQuotation({
    mutation: {
      onSuccess: (resp: any) => {
        queryClient.invalidateQueries({ queryKey: getGetQuotationQueryKey(qid) });
        toast({ title: "Quotation approved." });
        if (resp?.createdDeal && resp?.dealId) {
          toast({
            title: "Deal auto-created",
            description: "A new deal has been added to the sales pipeline.",
            action: (
              <ToastAction altText="Open pipeline" onClick={() => navigate("/crm/pipeline")}>
                Open Pipeline
              </ToastAction>
            ),
          });
          queryClient.invalidateQueries({ queryKey: ["/deals"] });
        } else if (resp?.dealId) {
          toast({
            title: "Quotation linked to existing deal",
            description: "The deal value & probability were updated.",
            action: (
              <ToastAction altText="Open pipeline" onClick={() => navigate("/crm/pipeline")}>
                Open Pipeline
              </ToastAction>
            ),
          });
          queryClient.invalidateQueries({ queryKey: ["/deals"] });
        }
        for (const w of (resp?.warnings ?? []) as string[]) {
          toast({ title: "Heads-up", description: w });
        }
      },
    },
  });

  const createPI = useCreateProformaInvoice();
  const createTax = useCreateTaxInvoice();

  const createDN = useCreateDeliveryNote({
    mutation: {
      onSuccess: (dn) => {
        toast({ title: "Delivery Note created!", description: `${dn.dnNumber}` });
        navigate("/accounts/delivery-notes/" + dn.id);
      },
      onError: () => toast({ title: "Failed to create Delivery Note.", variant: "destructive" }),
      onSettled: () => setConverting(null),
    },
  });

  // When opening the dialog, prime installments from quotation's payment terms
  useEffect(() => {
    if (!convertOpen || !q) return;
    const parsed = parsePaymentTerms(q.paymentTerms ?? "");
    const initial: Installment[] = parsed.length > 0
      ? parsed
      : [{ label: "Full Payment", percent: 100 }];
    setInstallments(initial);
    setSelected(initial.map(() => true));
  }, [convertOpen, q]);

  const baseSubtotal = q?.subtotal ?? 0;
  const vatPercent = q?.vatPercent ?? 5;

  // Hook must run on every render — keep it above early returns to satisfy Rules of Hooks.
  const computedInstallments = useMemo(
    () => calculateInstallments(installments, baseSubtotal, vatPercent),
    [installments, baseSubtotal, vatPercent]
  );

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading…</div>;
  if (!q) return <div className="text-muted-foreground p-8">Quotation not found.</div>;

  const items = ((q as any).items ?? []) as {
    description: string; unit?: string; rate?: number; quantity: number; amount?: number;
  }[];

  let additionalItems: import("@/components/document-print").AdditionalCommercialItem[] | undefined;
  try {
    const raw = (q as any).additionalItems;
    if (raw) additionalItems = JSON.parse(raw);
  } catch { /* use default */ }

  let customSections: { title: string; content: string }[] | undefined;
  try {
    const raw = (q as any).customSections;
    if (raw) customSections = JSON.parse(raw);
  } catch { /* skip */ }

  const docData: DocumentData = {
    type: "quotation",
    docNumber: q.quotationNumber,
    companyId: q.companyId,
    companyRef: (q as any).companyRef,
    companyLogo: (companies?.find(c => c.id === q.companyId) as any)?.logo ?? undefined,
    clientName: q.clientName,
    clientContactPerson: (q as any).clientContactPerson,
    clientPhone: q.clientPhone,
    clientEmail: q.clientEmail,
    customerTrn: (q as any).customerTrn,
    projectName: q.projectName,
    projectLocation: q.projectLocation,
    date: q.createdAt ? new Date(q.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : undefined,
    validity: q.validity,
    vatPercent: q.vatPercent ?? 5,
    subtotal: q.subtotal,
    discount: q.discount,
    vatAmount: q.vatAmount,
    grandTotal: q.grandTotal,
    paymentTerms: q.paymentTerms,
    termsConditions: q.termsConditions,
    techSpecs: (q as any).techSpecs,
    additionalItems,
    customSections,
    items: items.map(i => ({
      description: i.description,
      sizeStatus: i.unit,
      unitPrice: i.rate,
      quantity: i.quantity,
      total: i.amount,
    })),
    preparedByName: (q as any).preparedByName,
    printedByUniqueId: (user as any)?.uniqueUserId ?? undefined,
    clientCode: (q as any).clientCode ?? undefined,
  };

  const handleConvertToDN = () => {
    if (converting) return;
    setConverting("dn");
    createDN.mutate({ data: {
      companyId: q.companyId,
      clientName: q.clientName,
      projectName: q.projectName,
      deliveryDate: new Date().toISOString().split("T")[0],
      quotationId: q.id,
      deliveryLocation: q.projectLocation ?? undefined,
      items: items.map(i => ({
        description: i.description,
        quantity: i.quantity,
        unit: i.unit ?? "nos",
      })),
      ...({
        clientCode: (q as any).clientCode,
        clientPhone: q.clientPhone,
        clientEmail: q.clientEmail,
      } as Record<string, unknown>),
    } as any });
  };

  const handleConfirmConvert = async () => {
    if (!convertOpen || converting) return;
    const target = convertOpen;
    const chosen = installments
      .map((inst, i) => ({ inst, i }))
      .filter(({ i }) => selected[i] && installments[i].percent > 0);

    if (chosen.length === 0) {
      toast({ title: "Pick at least one installment.", variant: "destructive" });
      return;
    }

    setConverting(target);
    const computed = calculateInstallments(installments, baseSubtotal, vatPercent);
    const today = new Date().toISOString().split("T")[0];

    const created: { name: string; id: number }[] = [];
    let failures = 0;

    for (const { i } of chosen) {
      const ci = computed[i];
      const termsText = installmentToTermsText(installments[i], i, installments.length);

      try {
        if (target === "pi") {
          const res = await createPI.mutateAsync({ data: {
            companyId: q.companyId,
            clientName: q.clientName,
            projectName: q.projectName,
            quotationId: q.id,
            subtotal: ci.subtotal,
            vatAmount: ci.vatAmount,
            total: ci.total,
            paymentTerms: termsText,
            validityDate: q.validity,
            ...({
              vatPercent,
              clientEmail: q.clientEmail,
              clientPhone: q.clientPhone,
              clientCode: (q as any).clientCode,
              clientContactPerson: (q as any).clientContactPerson,
              customerTrn: (q as any).customerTrn,
              projectLocation: q.projectLocation,
            } as Record<string, unknown>),
          } });
          created.push({ name: res.piNumber, id: res.id });
        } else {
          const res = await createTax.mutateAsync({ data: {
            companyId: q.companyId,
            clientName: q.clientName,
            quotationId: q.id,
            invoiceDate: today,
            supplyDate: today,
            subtotal: ci.subtotal,
            vatPercent,
            vatAmount: ci.vatAmount,
            grandTotal: ci.total,
            paymentStatus: "unpaid",
            ...({
              clientCode: (q as any).clientCode,
              clientTrn: (q as any).customerTrn,
              paymentTerms: termsText,
              clientEmail: q.clientEmail,
              clientPhone: q.clientPhone,
              projectName: q.projectName,
              projectLocation: q.projectLocation,
            } as Record<string, unknown>),
          } });
          created.push({ name: res.invoiceNumber, id: res.id });
        }
      } catch {
        failures += 1;
      }
    }

    setConverting(null);
    setConvertOpen(null);

    // Refresh list caches so newly created invoices show up immediately
    if (target === "pi") {
      queryClient.invalidateQueries({ queryKey: getListProformaInvoicesQueryKey() });
    } else {
      queryClient.invalidateQueries({ queryKey: getListTaxInvoicesQueryKey() });
    }

    if (created.length === 0) {
      toast({ title: "Failed to create invoices.", variant: "destructive" });
      return;
    }

    toast({
      title: `${created.length} ${target === "pi" ? "Proforma Invoice" : "Tax Invoice"}${created.length > 1 ? "s" : ""} created`,
      description: created.map(c => c.name).join(", "),
    });

    if (failures > 0) {
      toast({
        title: `${failures} installment${failures > 1 ? "s" : ""} failed`,
        description: "Other installments were created successfully.",
        variant: "destructive",
      });
    }

    if (created.length === 1) {
      navigate(target === "pi"
        ? "/sales/proforma-invoices/" + created[0].id
        : "/accounts/invoices/" + created[0].id);
    } else {
      navigate(target === "pi" ? "/sales/proforma-invoices" : "/accounts/invoices");
    }
  };

  const updateInst = (i: number, patch: Partial<Installment>) => {
    setInstallments(prev => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  };

  const addInstallment = () => {
    const used = totalPercent(installments);
    const remaining = Math.max(0, 100 - used);
    setInstallments(prev => [...prev, { label: "Payment", percent: remaining }]);
    setSelected(prev => [...prev, true]);
  };

  const removeInstallment = (i: number) => {
    setInstallments(prev => prev.filter((_, idx) => idx !== i));
    setSelected(prev => prev.filter((_, idx) => idx !== i));
  };

  const sumPercent = totalPercent(installments);

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Action Bar */}
      <div className="no-print flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/sales/quotations"><ArrowLeft className="w-4 h-4 mr-1" />Back</Link>
        </Button>
        <Badge className={`capitalize ${STATUS_COLORS[q.status] ?? "bg-gray-100"}`}>{q.status}</Badge>
        {(q as any)?.clientCode && (
          <Badge className="bg-[#0f2d5a] text-[#c9a14a] border border-[#c9a14a]/30 font-mono text-[11px] tracking-wide">
            {(q as any).clientCode}
          </Badge>
        )}
        {(q as any)?.leadId ? (
          <Button size="sm" variant="outline" asChild>
            <Link href={`/crm/leads/${(q as any).leadId}`}>
              <ArrowLeft className="w-4 h-4 mr-1" />Lead
            </Link>
          </Button>
        ) : null}
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" asChild>
            <Link href={`/sales/quotations/${qid}/edit`}>
              <Pencil className="w-4 h-4 mr-1" />Edit / Revise
            </Link>
          </Button>

          {q.status === "sent" && (
            <Button
              size="sm" variant="outline"
              className="text-green-600 border-green-600"
              onClick={() => approve.mutate({ id: qid })}
              disabled={approve.isPending}
            >
              <Check className="w-4 h-4 mr-1" />{approve.isPending ? "Approving…" : "Approve"}
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="bg-[#0f2d5a] hover:bg-[#1e6ab0]" disabled={!!converting}>
                {converting ? "Creating…" : "Convert To"}
                <ChevronDown className="w-3.5 h-3.5 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setConvertOpen("pi")}>
                <FileText className="w-4 h-4 mr-2 text-blue-600" />Proforma Invoice
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setConvertOpen("tax")}>
                <Receipt className="w-4 h-4 mr-2 text-green-600" />Tax Invoice
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleConvertToDN}>
                <Package className="w-4 h-4 mr-2 text-purple-600" />Delivery Note
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            size="sm" variant="outline"
            disabled={generatingPdf}
            onClick={async () => {
              const docEl = document.querySelector<HTMLElement>(".print-doc");
              let attachments: { filename: string; content: string; contentType: string; size: number }[] = [];
              if (docEl) {
                setGeneratingPdf(true);
                try {
                  const filename = `Quotation_${q.quotationNumber ?? q.id ?? "doc"}.pdf`;
                  const { base64 } = await captureElementToPdfBase64(docEl, filename);
                  attachments = [{
                    filename,
                    content: base64,
                    contentType: "application/pdf",
                    size: Math.round(base64.length * 0.75),
                  }];
                } catch {
                  /* fall through — open compose without attachment */
                } finally {
                  setGeneratingPdf(false);
                }
              }
              openCompose({
                toAddress: q.clientEmail ?? "",
                toName: q.clientName ?? "",
                subject: `Quotation ${q.quotationNumber ?? ""} – ${q.projectName ?? q.clientName ?? ""}`,
                body: `Dear ${q.clientName ?? "Sir/Madam"},\n\nPlease find attached our quotation ${q.quotationNumber ?? ""} for ${q.projectName ?? "your project"}.\n\nTotal Value: AED ${Number(q.grandTotal ?? 0).toLocaleString()}\n\nFor any queries, please do not hesitate to contact us.\n\nBest regards,\nPrime Max Prefab`,
                clientName: q.clientName ?? "",
                sourceRef: q.quotationNumber ?? "",
                companyId: q.companyId ?? undefined,
                attachments,
              });
            }}
          >
            {generatingPdf
              ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Preparing PDF…</>
              : <><Mail className="w-4 h-4 mr-1" />Send Email</>}
          </Button>
          <ExportButtons docNumber={q.quotationNumber ?? q.id?.toString() ?? "Quotation"} recipientPhone={q.clientPhone ?? undefined} recipientEmail={q.clientEmail ?? undefined} companyId={q.companyId ?? undefined} docTypeLabel="Quotation" />
        </div>
      </div>

      {/* Document */}
      <DocumentPrint data={docData} />

      {/* Convert Dialog */}
      <Dialog open={convertOpen !== null} onOpenChange={(o) => { if (!o) setConvertOpen(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Create {convertOpen === "pi" ? "Proforma Invoice(s)" : "Tax Invoice(s)"} from Quotation
            </DialogTitle>
            <DialogDescription>
              Payment terms split into installments. Tick the ones you want to issue now —
              one invoice will be created per selected installment.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">
              Quote subtotal: <span className="font-medium text-foreground">AED {baseSubtotal.toLocaleString()}</span>
              {" · "}VAT: <span className="font-medium text-foreground">{vatPercent}%</span>
              {q.paymentTerms ? <> {" · "}Source terms: <span className="italic">"{q.paymentTerms}"</span></> : null}
            </div>

            <div className="rounded border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted text-xs">
                  <tr>
                    <th className="p-2 text-left w-10"></th>
                    <th className="p-2 text-left">Stage Label</th>
                    <th className="p-2 text-right w-20">%</th>
                    <th className="p-2 text-right">Subtotal</th>
                    <th className="p-2 text-right">VAT</th>
                    <th className="p-2 text-right">Total</th>
                    <th className="p-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {installments.map((inst, i) => {
                    const c = computedInstallments[i];
                    return (
                      <tr key={i} className="border-t">
                        <td className="p-2">
                          <Checkbox
                            checked={selected[i] ?? false}
                            onCheckedChange={(v) => {
                              setSelected(prev => prev.map((s, idx) => idx === i ? !!v : s));
                            }}
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            className="h-8 text-xs"
                            value={inst.label}
                            onChange={(e) => updateInst(i, { label: e.target.value })}
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            className="h-8 text-xs text-right"
                            value={inst.percent}
                            onChange={(e) => updateInst(i, { percent: parseFloat(e.target.value) || 0 })}
                          />
                        </td>
                        <td className="p-2 text-right tabular-nums">{c.subtotal.toLocaleString()}</td>
                        <td className="p-2 text-right tabular-nums">{c.vatAmount.toLocaleString()}</td>
                        <td className="p-2 text-right font-medium tabular-nums">{c.total.toLocaleString()}</td>
                        <td className="p-2">
                          <Button
                            size="sm" variant="ghost"
                            className="h-7 w-7 p-0 text-red-600"
                            onClick={() => removeInstallment(i)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t bg-muted/40 text-xs">
                    <td className="p-2"></td>
                    <td className="p-2 font-medium">Total</td>
                    <td className={`p-2 text-right font-medium ${Math.abs(sumPercent - 100) > 0.01 ? "text-orange-600" : ""}`}>
                      {sumPercent}%
                    </td>
                    <td colSpan={4}></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between">
              <Button size="sm" variant="outline" onClick={addInstallment}>
                <Plus className="w-3.5 h-3.5 mr-1" />Add Installment
              </Button>
              {Math.abs(sumPercent - 100) > 0.01 && (
                <p className="text-xs text-orange-600">
                  Installments add up to {sumPercent}% (not 100%). Continue only if intentional.
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertOpen(null)} disabled={!!converting}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmConvert}
              disabled={!!converting}
              className="bg-[#0f2d5a] hover:bg-[#1e6ab0]"
            >
              {converting
                ? "Creating…"
                : `Create ${selected.filter(Boolean).length} Invoice${selected.filter(Boolean).length === 1 ? "" : "s"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
