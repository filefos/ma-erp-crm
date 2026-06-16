import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { SignatureStampPreview } from "@/components/signature-stamp-preview";
import { canSignDocuments } from "@/lib/permissions";
import {
  useGetQuotation, useUpdateQuotation, useListCompanies,
  getGetQuotationQueryKey, getListQuotationsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Plus, Trash2, ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  SPEC_TYPE_OPTIONS,
  DEFAULT_SPEC_TYPE,
  getSpecTemplate,
  parseTechSpecs,
  serializeTechSpecs,
  type SpecTypeKey,
  type TechSpecSection,
} from "@/lib/tech-spec-templates";
import { TechSpecEditor } from "@/components/tech-spec-editor";
import { TCEditor, parseTCString, serializeTCSections, type TCSection } from "@/components/tc-editor";
import { STANDARD_TC } from "@/lib/tc-templates";
import { PaymentTermsBuilder } from "@/components/payment-terms-builder";
import { AdditionalItemsTable, type AdditionalItem } from "@/components/additional-items-table";
import { ProjectItemsTable, emptyProjectItem, type ProjectItem } from "@/components/project-items-table";

const BANK_DETAILS: Record<number, {
  bankName: string; accountTitle: string; accountNumber: string;
  iban: string; swift: string; currency: string;
}> = {
  1: {
    bankName: "Abu Dhabi Commercial Bank (ADCB)",
    accountTitle: "PRIME MAX PREFAB HOUSES IND. LLC. SP.",
    accountNumber: "14498851920002",
    iban: "AE300030014498851920002",
    swift: "ADCBAEAA",
    currency: "AED",
  },
  2: {
    bankName: "Abu Dhabi Commercial Bank (ADCB)",
    accountTitle: "ELITE PRE FABRICATED HOUSES TRADING CO. LLC",
    accountNumber: "13438011920001",
    iban: "AE320030013438011920001",
    swift: "ADCBAEAAXXX",
    currency: "AED",
  },
};


const DEFAULT_ADDITIONAL_ITEMS: AdditionalItem[] = [
  { description: "Transportation including RTA Permit", status: "Included", price: 0, quantity: 1, amount: 0 },
  { description: "Brand New SUPER GENERAL SPLIT AC UNIT", status: "Excluded", price: 0, quantity: 1, amount: 0 },
  { description: "Foundation Detail", status: "Excluded", price: 0, quantity: 1, amount: 0 },
  { description: "Staircase", status: "Excluded", price: 0, quantity: 1, amount: 0 },
  { description: "Additional Commercial Item", status: "Excluded", price: 0, quantity: 1, amount: 0 },
];

function bumpRevision(num: string): string {
  const match = num.match(/^(.*-R)(\d+)$/i);
  if (match) {
    const next = parseInt(match[2], 10) + 1;
    return match[1].toUpperCase() + String(next).padStart(2, "0");
  }
  return num + "-R01";
}

interface Props { id: string }

export function QuotationEdit({ id }: Props) {
  const { activeCompanyId } = useActiveCompany();
  const qid = parseInt(id, 10);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: q, isLoading } = useGetQuotation(qid, {
    query: { queryKey: getGetQuotationQueryKey(qid), enabled: !!qid },
  });
  const { data: companies } = useListCompanies();

  const update = useUpdateQuotation({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getGetQuotationQueryKey(qid) });
        queryClient.invalidateQueries({ queryKey: getListQuotationsQueryKey() });
        toast({ title: "Quotation updated!", description: `Saved as ${(data as any).quotationNumber}` });
        navigate(`/sales/quotations/${qid}`);
      },
      onError: (e: any) => toast({
        title: "Failed to save.",
        description: e?.data?.error ?? e?.data?.message ?? e?.message ?? "Unexpected error",
        variant: "destructive",
      }),
    },
  });

  const [initialised, setInitialised] = useState(false);
  const [form, setForm] = useState({
    companyId: "",
    clientName: "",
    clientContactPerson: "",
    clientEmail: "",
    clientPhone: "",
    clientDesignation: "",
    clientAddress: "",
    customerTrn: "",
    projectName: "",
    projectLocation: "",
    status: "draft",
    vatPercent: 5,
    discount: 0,
    paymentTerms: "",
    validity: "30 days",
    leadTime: "",
    termsConditions: "",
    techSpecs: "",
    quotationNumber: "",
    preparedByName: "",
    creatorName: "",
    creatorPhone: "",
    creatorEmail: "",
    creatorDesignation: "",
  });
  const [items, setItems] = useState<ProjectItem[]>([emptyProjectItem()]);
  const [additionalItems, setAdditionalItems] = useState<AdditionalItem[]>(DEFAULT_ADDITIONAL_ITEMS);
  const [specType, setSpecType] = useState<SpecTypeKey>(DEFAULT_SPEC_TYPE);
  const [techSpecSections, setTechSpecSections] = useState<TechSpecSection[]>([]);
  const [tcSections, setTcSections] = useState<TCSection[]>([]);
  const [showTechSpecs, setShowTechSpecs] = useState(false);
  const [showTC, setShowTC] = useState(false);
  const [bumpRev, setBumpRev] = useState(false);

  const [customSections, setCustomSections] = useState<{ title: string; content: string }[]>([]);

  const handleSpecTypeChange = (key: SpecTypeKey) => {
    setSpecType(key);
    setTechSpecSections(parseTechSpecs(getSpecTemplate(key)));
  };

  useEffect(() => {
    if (!q || initialised) return;
    const raw = (q as any);
    const loadedItems: ProjectItem[] = ((raw.items ?? []) as any[]).map((i: any) => ({
      description: i.description ?? "",
      quantity: Number(i.quantity ?? 1),
      sizeStatus: i.sizeStatus ?? i.unit ?? "",
      rate: Number(i.rate ?? 0),
      amount: Number(i.amount ?? 0),
      discount: Number(i.discount ?? 0),
    }));
    let loadedAdditional: AdditionalItem[] = DEFAULT_ADDITIONAL_ITEMS;
    try {
      if (raw.additionalItems) loadedAdditional = JSON.parse(raw.additionalItems);
    } catch { /* keep default */ }

    setForm({
      companyId: String(q.companyId ?? ""),
      clientName: q.clientName ?? "",
      clientContactPerson: raw.clientContactPerson ?? "",
      clientEmail: q.clientEmail ?? "",
      clientPhone: q.clientPhone ?? "",
      clientDesignation: raw.clientDesignation ?? "",
      clientAddress: raw.clientAddress ?? "",
      customerTrn: raw.customerTrn ?? "",
      projectName: q.projectName ?? "",
      projectLocation: q.projectLocation ?? "",
      status: q.status ?? "draft",
      vatPercent: Number(q.vatPercent ?? 5),
      discount: Number(q.discount ?? 0),
      paymentTerms: q.paymentTerms ?? "",
      validity: q.validity ?? "30 days",
      leadTime: (raw as any).leadTime ?? "",
      termsConditions: q.termsConditions ?? "",
      techSpecs: raw.techSpecs ?? "",
      quotationNumber: q.quotationNumber ?? "",
      preparedByName: raw.preparedByName ?? "",
      creatorName: raw.creatorName ?? "",
      creatorPhone: raw.creatorPhone ?? "",
      creatorEmail: raw.creatorEmail ?? "",
      creatorDesignation: raw.creatorDesignation ?? "",
    });
    setTechSpecSections(parseTechSpecs(raw.techSpecs ?? ""));
    setTcSections(parseTCString(q.termsConditions ?? ""));
    setItems(loadedItems.length > 0 ? loadedItems : [emptyProjectItem()]);
    setAdditionalItems(loadedAdditional);
    try {
      if (raw.customSections) setCustomSections(JSON.parse(raw.customSections));
    } catch { /* keep empty */ }
    setInitialised(true);
  }, [q, initialised]);




  const company = companies?.find(c => c.id === Number(form.companyId));
  const isPrime = /prime/i.test(company?.name ?? "") || /prime/i.test(company?.shortName ?? "");
  const brand = {
    header:      isPrime ? "#1E0040" : "#0D0D0D",
    headerHover: isPrime ? "#8B008B" : "#1E1E1E",
    border:      isPrime ? "#8B008B" : "#8B0000",
    rowBg:       isPrime ? "#f3e8ff" : "#F3F3F3",
    rowHover:    isPrime ? "#ead5fb" : "#E8E8E8",
    lightBg:     isPrime ? "#faf0ff" : "#F8F8F8",
    lightHover:  isPrime ? "#f5e8ff" : "#EEEEEE",
  };
  const projectItemsTotal = items.reduce((s, it) => s + (it.amount || 0), 0);
  const discountedProjectTotal = projectItemsTotal * (1 - (form.discount || 0) / 100);
  const additionalTotal = additionalItems.reduce((s, ai) => s + (ai.status === "Included" ? (ai.amount || 0) : 0), 0);
  const combinedSubtotal = discountedProjectTotal + additionalTotal;
  const vatAmount = +(combinedSubtotal * (form.vatPercent || 0) / 100).toFixed(2);
  const grandTotal = +(combinedSubtotal + vatAmount).toFixed(2);

  const handleSave = (status: string) => {
    if (!form.companyId || !form.clientName) return;
    const quotationNumber = bumpRev ? bumpRevision(form.quotationNumber) : form.quotationNumber;
    update.mutate({
      id: qid,
      data: {
        ...form,
        techSpecs: serializeTechSpecs(techSpecSections),
        termsConditions: serializeTCSections(tcSections),
        quotationNumber,
        status,
        companyId: parseInt(form.companyId, 10),
        items,
        additionalItems: JSON.stringify(additionalItems),
        customSections: JSON.stringify(customSections),
      } as any,
    });
  };

  if (isLoading || !initialised) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading quotation…</div>;
  }
  if (!q) return <div className="text-muted-foreground p-8">Quotation not found.</div>;

  const nextRevNum = bumpRevision(form.quotationNumber);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap gap-3 items-start">
        <div className="flex items-center gap-3 flex-wrap flex-1 min-w-0">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/sales/quotations/${qid}`}><ArrowLeft className="w-4 h-4 mr-1" />Back</Link>
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Edit Quotation</h1>
            <p className="text-sm text-muted-foreground font-mono">{form.quotationNumber}</p>
          </div>
          <Badge className="capitalize bg-gray-100 text-gray-700">{q.status}</Badge>
        </div>

        {/* Revision bump toggle */}
        <div className="flex items-center gap-2 border rounded-lg px-3 py-2 bg-orange-50 border-orange-200 shrink-0">
          <RotateCcw className="w-4 h-4 text-orange-600 flex-shrink-0" />
          <div className="text-sm">
            <span className="text-orange-800 font-medium">Bump revision: </span>
            <span className="text-orange-700 font-mono text-xs">{form.quotationNumber} → {nextRevNum}</span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={bumpRev}
            onClick={() => setBumpRev(v => !v)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0
              ${bumpRev ? "bg-orange-500" : "bg-gray-300"}`}
          >
            <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform
              ${bumpRev ? "translate-x-4" : "translate-x-1"}`} />
          </button>
        </div>
      </div>

      {/* Client & Project Details */}
      <Card>
        <CardHeader><CardTitle>Company Detail &amp; Client Detail</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1 sm:col-span-1">
            <Label>Our Company *</Label>
            <Select value={form.companyId} onValueChange={v => setForm(p => ({ ...p, companyId: v }))}>
              <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
              <SelectContent>
                {companies?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Client Company *</Label>
            <Input value={form.clientName} onChange={e => setForm(p => ({ ...p, clientName: e.target.value }))} placeholder="e.g. IMDAAD" />
          </div>
          <div className="space-y-1">
            <Label>Client Contact Person</Label>
            <Input value={form.clientContactPerson} onChange={e => setForm(p => ({ ...p, clientContactPerson: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>Client Phone</Label>
            <Input value={form.clientPhone} onChange={e => setForm(p => ({ ...p, clientPhone: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>Client Email</Label>
            <Input type="email" value={form.clientEmail} onChange={e => setForm(p => ({ ...p, clientEmail: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>Client Designation</Label>
            <Input value={form.clientDesignation} onChange={e => setForm(p => ({ ...p, clientDesignation: e.target.value }))} placeholder="e.g. Project Manager" />
          </div>
          <div className="space-y-1">
            <Label>Customer TRN</Label>
            <Input value={form.customerTrn} onChange={e => setForm(p => ({ ...p, customerTrn: e.target.value }))} placeholder="Optional" />
          </div>
          <div className="space-y-1">
            <Label>Project Name / Ref</Label>
            <Input value={form.projectName} onChange={e => setForm(p => ({ ...p, projectName: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>Project Location / Site</Label>
            <Input value={form.projectLocation} onChange={e => setForm(p => ({ ...p, projectLocation: e.target.value }))} />
          </div>
          <div className="space-y-1 col-span-2">
            <Label>Client Company Office Address</Label>
            <Textarea
              value={form.clientAddress}
              onChange={e => setForm(p => ({ ...p, clientAddress: e.target.value }))}
              placeholder="e.g. Office 301, Al Bateen Business Centre, Abu Dhabi, UAE"
              rows={2}
              className="resize-none"
            />
          </div>
          <div className="space-y-1">
            <Label>Quotation Validity</Label>
            <Input value={form.validity} onChange={e => setForm(p => ({ ...p, validity: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>Lead Time for Delivery <span className="text-red-500">*</span></Label>
            <Input
              value={form.leadTime}
              onChange={e => setForm(p => ({ ...p, leadTime: e.target.value }))}
              placeholder="e.g. 45–60 working days"
            />
          </div>
          <div className="space-y-1 col-span-2">
            <Label>Payment Terms</Label>
            <PaymentTermsBuilder
              value={form.paymentTerms}
              onChange={(v) => setForm(p => ({ ...p, paymentTerms: v }))}
              grandTotal={grandTotal}
            />
          </div>
          <div className="space-y-1">
            <Label>Prepared By</Label>
            <Input value={form.preparedByName} onChange={e => setForm(p => ({ ...p, preparedByName: e.target.value }))} placeholder="e.g. ASIF LATIF" />
          </div>
          <div className="col-span-2 border-t pt-3 mt-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Company Contact / Sales Person (shown on document)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Contact Person Name</Label>
                <Input value={form.creatorName} onChange={e => setForm(p => ({ ...p, creatorName: e.target.value }))} placeholder="e.g. Asif Latif" />
              </div>
              <div className="space-y-1">
                <Label>Contact Phone</Label>
                <Input value={form.creatorPhone} onChange={e => setForm(p => ({ ...p, creatorPhone: e.target.value }))} placeholder="e.g. +971-50-100-0001" />
              </div>
              <div className="space-y-1">
                <Label>Contact Email</Label>
                <Input type="email" value={form.creatorEmail} onChange={e => setForm(p => ({ ...p, creatorEmail: e.target.value }))} placeholder="e.g. sales@primemaxprefab.com" />
              </div>
              <div className="space-y-1">
                <Label>Designation</Label>
                <Input value={form.creatorDesignation} onChange={e => setForm(p => ({ ...p, creatorDesignation: e.target.value }))} placeholder="e.g. Sales Manager" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <ProjectItemsTable brand={brand} items={items} onChange={setItems} />

      {/* Additional Commercial Items */}
      <div style={{ margin: "10px" }}>
        <AdditionalItemsTable
          items={additionalItems}
          onChange={setAdditionalItems}
        />
      </div>

      {/* Totals */}
      <Card>
        <CardHeader><CardTitle>Totals</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            {BANK_DETAILS[Number(form.companyId)] && (
              <div className="flex-1 w-full border rounded-lg p-4 bg-muted/40">
                <div className="text-xs font-bold uppercase tracking-wide text-[#1E0040] mb-2">Bank Details</div>
                <table className="text-xs w-full">
                  <tbody>
                    {[
                      ["Bank Name", BANK_DETAILS[Number(form.companyId)].bankName],
                      ["Account Title", BANK_DETAILS[Number(form.companyId)].accountTitle],
                      ["Account Number", BANK_DETAILS[Number(form.companyId)].accountNumber],
                      ["IBAN", BANK_DETAILS[Number(form.companyId)].iban],
                      ["Swift Code", BANK_DETAILS[Number(form.companyId)].swift],
                      ["Currency", BANK_DETAILS[Number(form.companyId)].currency],
                    ].map(([label, value]) => (
                      <tr key={label}>
                        <td className="text-muted-foreground pr-3 py-0.5 whitespace-nowrap">{label}</td>
                        <td className="font-medium">{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="w-full lg:w-96 lg:flex-shrink-0 space-y-2">
              {/* Project Items row */}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Project Items Subtotal (Excl. VAT)</span>
                <span className="font-medium">AED {projectItemsTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              {/* Discount */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">Discount (%)</span>
                <Input
                  type="number"
                  className="w-20 h-7 text-right text-sm"
                  value={form.discount}
                  onChange={e => setForm(p => ({ ...p, discount: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              {/* Additional Commercial Items row — always visible */}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Additional Commercial Items Subtotal (Excl. VAT)</span>
                <span className="font-medium">AED {additionalTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              {/* Combined */}
              <div className="flex justify-between text-sm font-semibold border-t pt-2 mt-1">
                <span>Total Amount (Excl. VAT)</span>
                <span>AED {combinedSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              {/* VAT */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">VAT (%)</span>
                <Input
                  type="number"
                  className="w-20 h-7 text-right text-sm"
                  value={form.vatPercent}
                  onChange={e => setForm(p => ({ ...p, vatPercent: parseFloat(e.target.value) || 5 }))}
                />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">VAT {form.vatPercent ?? 5}% Amount</span>
                <span>AED {vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold text-lg pt-1">
                <span>Grand Total (Incl. VAT)</span>
                <span className="text-primary">AED {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Technical Specifications */}
      <Card>
        <CardHeader
          className="flex flex-row items-center justify-between cursor-pointer py-3"
          onClick={() => setShowTechSpecs(s => !s)}
        >
          <CardTitle className="text-base">Technical Specifications (Page 2 of Print)</CardTitle>
          {showTechSpecs ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </CardHeader>
        {showTechSpecs && (
          <CardContent>
            <div className="space-y-2 mb-3">
              <Label className="text-xs font-medium">Specification Type</Label>
              <Select value={specType} onValueChange={(v) => handleSpecTypeChange(v as SpecTypeKey)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SPEC_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.key} value={opt.key}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Switching the type replaces the editor content with that template. You can edit the text afterwards. Printed as page 2.
              </p>
            </div>
            <TechSpecEditor
              sections={techSpecSections}
              onChange={setTechSpecSections}
            brand={brand} />
          </CardContent>
        )}
      </Card>

      {/* Terms & Conditions */}
      <Card>
        <CardHeader
          className="flex flex-row items-center justify-between cursor-pointer py-3"
          onClick={() => setShowTC(s => !s)}
        >
          <CardTitle className="text-base">Terms &amp; Conditions (Page 3 of Print)</CardTitle>
          {showTC ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </CardHeader>
        {showTC && (
          <CardContent>
            <p className="text-xs text-muted-foreground mb-2">
              Edit T&amp;C sections below — each section prints with a navy header and numbered items. Changes are saved with the quotation.
            </p>
            <TCEditor
              sections={tcSections}
              onChange={setTcSections}
              onReset={() => setTcSections(parseTCString(STANDARD_TC))}
            brand={brand} />
          </CardContent>
        )}
      </Card>

      {/* Custom Sections */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <div>
            <CardTitle className="text-base">Custom Sections</CardTitle>
            <p className="text-[11px] text-muted-foreground mt-0.5">Each section prints on its own page after T&amp;C.</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setCustomSections(s => [...s, { title: "", content: "" }])}
          >
            <Plus className="w-4 h-4 mr-1" /> Add Section
          </Button>
        </CardHeader>
        {customSections.length > 0 && (
          <CardContent className="space-y-4">
            {customSections.map((sec, i) => (
              <div key={i} className="border rounded-lg p-3 space-y-2 bg-muted/20">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-mono w-6 flex-shrink-0">{i + 1}.</span>
                  <Input
                    className="flex-1 h-8 text-sm font-semibold"
                    placeholder="Section Title (e.g. Warranty, Scope of Work…)"
                    value={sec.title}
                    onChange={e => setCustomSections(prev => prev.map((s, idx) => idx === i ? { ...s, title: e.target.value } : s))}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-red-600 flex-shrink-0"
                    onClick={() => setCustomSections(prev => prev.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <Textarea
                  rows={5}
                  placeholder="Section content (multi-line text, printed as-is in the PDF)"
                  value={sec.content}
                  onChange={e => setCustomSections(prev => prev.map((s, idx) => idx === i ? { ...s, content: e.target.value } : s))}
                  className="text-sm font-mono"
                />
              </div>
            ))}
          </CardContent>
        )}
      </Card>

      {canSignDocuments((user as any)?.permissionLevel) && (
        <SignatureStampPreview
          signatureUrl={(user as any)?.signatureUrl ?? undefined}
          stampUrl={companies?.find(c => c.id === Number(form.companyId))?.stamp ?? undefined}
          stampWidthPct={companies?.find(c => c.id === Number(form.companyId))?.stampWidthPct ?? undefined}
        />
      )}

      {/* Save Actions */}
      <div className="flex gap-3 justify-end items-center flex-wrap pb-8">
        {bumpRev && (
          <p className="text-xs text-orange-600 mr-auto">
            Revision will be saved as <span className="font-mono font-bold">{nextRevNum}</span>
          </p>
        )}
        <Button variant="outline" asChild>
          <Link href={`/sales/quotations/${qid}`}>Cancel</Link>
        </Button>
        <Button
          variant="outline"
          onClick={() => handleSave("draft")}
          disabled={update.isPending || !form.companyId || !form.clientName}
        >
          Save as Draft
        </Button>
        <Button
          className="btn-brand"
          onClick={() => handleSave("sent")}
          disabled={update.isPending || !form.companyId || !form.clientName}
        >
          {update.isPending ? "Saving…" : bumpRev ? `Save Revision (${nextRevNum})` : "Save & Mark Sent"}
        </Button>
      </div>
    </div>
  );
}
