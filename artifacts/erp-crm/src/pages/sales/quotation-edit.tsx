import { useState, useEffect } from "react";
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
import { PAYMENT_TERMS_PRESETS, getPresetByKey } from "@/lib/payment-terms";

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
};

interface Item {
  description: string;
  quantity: number;
  sizeStatus: string;
  rate: number;
  amount: number;
  discount: number;
}

interface AdditionalItem {
  description: string;
  status: string;
  price: number;
  quantity: number;
  amount: number;
}

const emptyItem = (): Item => ({ description: "", quantity: 1, sizeStatus: "", rate: 0, amount: 0, discount: 0 });

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
  const qid = parseInt(id, 10);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
      onError: () => toast({ title: "Failed to save.", variant: "destructive" }),
    },
  });

  const [initialised, setInitialised] = useState(false);
  const [form, setForm] = useState({
    companyId: "",
    clientName: "",
    clientContactPerson: "",
    clientEmail: "",
    clientPhone: "",
    customerTrn: "",
    projectName: "",
    projectLocation: "",
    status: "draft",
    vatPercent: 5,
    discount: 0,
    paymentTerms: "",
    validity: "30 days",
    termsConditions: "",
    techSpecs: "",
    quotationNumber: "",
    preparedByName: "",
  });
  const [items, setItems] = useState<Item[]>([emptyItem()]);
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
    const loadedItems: Item[] = ((raw.items ?? []) as any[]).map((i: any) => ({
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
      customerTrn: raw.customerTrn ?? "",
      projectName: q.projectName ?? "",
      projectLocation: q.projectLocation ?? "",
      status: q.status ?? "draft",
      vatPercent: Number(q.vatPercent ?? 5),
      discount: Number(q.discount ?? 0),
      paymentTerms: q.paymentTerms ?? "",
      validity: q.validity ?? "30 days",
      termsConditions: q.termsConditions ?? "",
      techSpecs: raw.techSpecs ?? "",
      quotationNumber: q.quotationNumber ?? "",
      preparedByName: raw.preparedByName ?? "",
    });
    setTechSpecSections(parseTechSpecs(raw.techSpecs ?? ""));
    setTcSections(parseTCString(q.termsConditions ?? ""));
    setItems(loadedItems.length > 0 ? loadedItems : [emptyItem()]);
    setAdditionalItems(loadedAdditional);
    try {
      if (raw.customSections) setCustomSections(JSON.parse(raw.customSections));
    } catch { /* keep empty */ }
    setInitialised(true);
  }, [q, initialised]);

  const updateItem = (i: number, field: keyof Item, val: string | number) => {
    setItems(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: val };
      const qty = field === "quantity" ? Number(val) : next[i].quantity;
      const rate = field === "rate" ? Number(val) : next[i].rate;
      const disc = field === "discount" ? Number(val) : next[i].discount;
      next[i].amount = qty * rate * (1 - disc / 100);
      return next;
    });
  };

  const updateAdditionalItem = (i: number, field: keyof AdditionalItem, val: string | number) => {
    setAdditionalItems(prev => {
      const next = [...prev];
      const updated = { ...next[i], [field]: val };
      const p = field === "price" ? Number(val) : updated.price;
      const qty = field === "quantity" ? Number(val) : updated.quantity;
      updated.amount = updated.status === "Included" ? p * qty : 0;
      next[i] = updated;
      return next;
    });
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
      <div className="flex items-center gap-4 flex-wrap">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/sales/quotations/${qid}`}><ArrowLeft className="w-4 h-4 mr-1" />Back</Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Edit Quotation</h1>
          <p className="text-sm text-muted-foreground font-mono">{form.quotationNumber}</p>
        </div>
        <Badge className="capitalize bg-gray-100 text-gray-700">{q.status}</Badge>

        {/* Revision bump toggle */}
        <div className="ml-auto flex items-center gap-2 border rounded-lg px-3 py-2 bg-orange-50 border-orange-200">
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
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1 col-span-2 sm:col-span-1">
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
          <div className="space-y-1">
            <Label>Validity</Label>
            <Input value={form.validity} onChange={e => setForm(p => ({ ...p, validity: e.target.value }))} />
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
            <Input value={form.paymentTerms} onChange={e => setForm(p => ({ ...p, paymentTerms: e.target.value }))} placeholder="e.g. 75% Advance upon LPO, 25% Before Delivery" />
          </div>
          <div className="space-y-1">
            <Label>Prepared By</Label>
            <Input value={form.preparedByName} onChange={e => setForm(p => ({ ...p, preparedByName: e.target.value }))} placeholder="e.g. ASIF LATIF" />
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Project Items</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setItems(p => [...p, emptyItem()])}>
            <Plus className="w-4 h-4 mr-1" />Add Row
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded border border-[#1a3d6e]">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#1a3d6e] text-white">
                  <th className="text-center py-2 px-2 font-semibold w-12 border border-[#2d5a9e] border-t-0 border-l-0">S#</th>
                  <th className="text-center py-2 px-2 font-semibold border border-[#2d5a9e] border-t-0">Description</th>
                  <th className="text-center py-2 px-2 font-semibold w-32 border border-[#2d5a9e] border-t-0">Size / Status</th>
                  <th className="text-center py-2 px-2 font-semibold w-28 border border-[#2d5a9e] border-t-0">Price (AED)</th>
                  <th className="text-center py-2 px-2 font-semibold w-16 border border-[#2d5a9e] border-t-0">Qty.</th>
                  <th className="text-center py-2 px-2 font-semibold w-24 border border-[#2d5a9e] border-t-0">Discount %</th>
                  <th className="text-center py-2 px-2 font-semibold w-32 border border-[#2d5a9e] border-t-0 border-r-0">Total (AED)</th>
                  <th className="w-8 bg-[#1a3d6e] border-0"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i} className="bg-[#d6e8f7] hover:bg-[#c5ddf3]">
                    <td className="px-2 text-center font-semibold text-[#1a3d6e] border border-[#6fa3d8] border-t-0 border-l-0 align-middle">
                      {String(i + 1).padStart(2, "0")}
                    </td>
                    <td className="p-1 border border-[#6fa3d8] border-t-0" style={{ height: "1px" }}>
                      <Textarea
                        value={item.description}
                        onChange={e => updateItem(i, "description", e.target.value)}
                        className="text-sm min-h-[72px] h-full resize-y bg-transparent border-[#6fa3d8] focus:border-[#1a3d6e]"
                        placeholder="Describe prefab cabin details..."
                      />
                    </td>
                    <td className="p-1 border border-[#6fa3d8] border-t-0" style={{ height: "1px" }}>
                      <Input
                        value={item.sizeStatus}
                        onChange={e => updateItem(i, "sizeStatus", e.target.value)}
                        className="h-full min-h-[72px] text-sm bg-transparent border-[#6fa3d8] focus:border-[#1a3d6e]"
                        placeholder="e.g. 12X6X2.4M"
                      />
                    </td>
                    <td className="p-1 border border-[#6fa3d8] border-t-0" style={{ height: "1px" }}>
                      <Input
                        type="number"
                        value={item.rate}
                        onChange={e => updateItem(i, "rate", e.target.value)}
                        className="h-full min-h-[72px] text-right w-full text-sm bg-transparent border-[#6fa3d8] focus:border-[#1a3d6e]"
                      />
                    </td>
                    <td className="p-1 border border-[#6fa3d8] border-t-0" style={{ height: "1px" }}>
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={e => updateItem(i, "quantity", e.target.value)}
                        className="h-full min-h-[72px] text-right w-full text-sm bg-transparent border-[#6fa3d8] focus:border-[#1a3d6e]"
                      />
                    </td>
                    <td className="p-1 border border-[#6fa3d8] border-t-0" style={{ height: "1px" }}>
                      <Input
                        type="number"
                        value={item.discount}
                        onChange={e => updateItem(i, "discount", e.target.value)}
                        className="h-full min-h-[72px] text-right w-full text-sm bg-transparent border-[#6fa3d8] focus:border-[#1a3d6e]"
                        min={0} max={100}
                      />
                    </td>
                    <td className="px-2 text-right font-semibold text-[#1a3d6e] border border-[#6fa3d8] border-t-0 border-r-0 align-middle">
                      AED {item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-1 border-0 align-middle">
                      {items.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => setItems(p => p.filter((_, j) => j !== i))}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex justify-end">
            <div className="w-80 space-y-2 text-sm">
              <div className="flex justify-between font-semibold border-t pt-2">
                <span className="text-muted-foreground">Project Items Subtotal (Excl. VAT)</span>
                <span>AED {projectItemsTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Additional Commercial Items */}
      <Card>
        <CardHeader><CardTitle>Additional Commercial Items</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left pb-2 pt-1 font-semibold pl-2">Item</th>
                <th className="text-right pb-2 pt-1 font-semibold w-32">Price (AED)</th>
                <th className="text-right pb-2 pt-1 font-semibold w-16">Qty</th>
                <th className="text-center pb-2 pt-1 font-semibold w-36">Status</th>
                <th className="text-right pb-2 pt-1 font-semibold w-36 pr-2">Total (AED)</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {additionalItems.map((ai, i) => (
                <tr key={i} className="border-b last:border-0 align-middle">
                  <td className="py-1.5 pl-2">
                    <Input
                      value={ai.description}
                      onChange={e => updateAdditionalItem(i, "description", e.target.value)}
                      className="h-8 text-sm"
                    />
                  </td>
                  <td className="py-1.5 px-1">
                    <Input
                      type="number"
                      value={ai.price ?? 0}
                      onChange={e => updateAdditionalItem(i, "price", parseFloat(e.target.value) || 0)}
                      className="h-8 text-right text-sm"
                      disabled={ai.status === "Excluded"}
                    />
                  </td>
                  <td className="py-1.5 px-1">
                    <Input
                      type="number"
                      value={ai.quantity ?? 1}
                      onChange={e => updateAdditionalItem(i, "quantity", parseFloat(e.target.value) || 1)}
                      className="h-8 text-right text-sm"
                      disabled={ai.status === "Excluded"}
                    />
                  </td>
                  <td className="py-1.5 px-2">
                    <Select value={ai.status} onValueChange={v => updateAdditionalItem(i, "status", v)}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Included">Included</SelectItem>
                        <SelectItem value="Excluded">Excluded</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="py-1.5 px-2 text-right text-sm font-medium">
                    {ai.status === "Included"
                      ? `AED ${(ai.amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="py-1.5 pl-1">
                    {additionalItems.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => setAdditionalItems(p => p.filter((_, j) => j !== i))}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => setAdditionalItems(p => [...p, { description: "", status: "Excluded", price: 0, quantity: 1, amount: 0 }])}
          >
            <Plus className="w-4 h-4 mr-1" />Add Row
          </Button>
        </CardContent>
      </Card>

      {/* Totals */}
      <Card>
        <CardHeader><CardTitle>Totals</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-6 items-start">
            {BANK_DETAILS[Number(form.companyId)] && (
              <div className="flex-1 border rounded-lg p-4 bg-muted/40">
                <div className="text-xs font-bold uppercase tracking-wide text-[#0f2d5a] mb-2">Bank Details</div>
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
            <div className="w-80 flex-shrink-0 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal (Project Items)</span>
                <span>AED {projectItemsTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">Discount (%)</span>
                <Input
                  type="number"
                  className="w-20 h-7 text-right text-sm"
                  value={form.discount}
                  onChange={e => setForm(p => ({ ...p, discount: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              {additionalTotal > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Additional Commercial Items</span>
                  <span>AED {additionalTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              {additionalTotal > 0 && (
                <div className="flex justify-between text-sm font-medium border-t pt-2">
                  <span className="text-muted-foreground">Combined Subtotal (Excl. VAT)</span>
                  <span>AED {combinedSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              )}
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
                <span className="text-muted-foreground">VAT Amount</span>
                <span>AED {vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold text-lg">
                <span>Grand Total</span>
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
            />
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
            />
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
          className="bg-[#0f2d5a] hover:bg-[#1e6ab0]"
          onClick={() => handleSave("sent")}
          disabled={update.isPending || !form.companyId || !form.clientName}
        >
          {update.isPending ? "Saving…" : bumpRev ? `Save Revision (${nextRevNum})` : "Save & Mark Sent"}
        </Button>
      </div>
    </div>
  );
}
