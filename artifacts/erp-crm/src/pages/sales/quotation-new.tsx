import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { SignatureStampPreview } from "@/components/signature-stamp-preview";
import { canSignDocuments } from "@/lib/permissions";
import { useCreateQuotation, useListCompanies, useGetLead, getGetLeadQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Plus, Trash2, ChevronDown, ChevronUp, Eye, EyeOff } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListQuotationsQueryKey } from "@workspace/api-client-react";
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

const BANK_DETAILS: Record<number, { bankName: string; accountTitle: string; accountNumber: string; iban: string; swift: string; currency: string }> = {
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
  unit: string;
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

const emptyItem = (): Item => ({ description: "", quantity: 1, unit: "", rate: 0, amount: 0, discount: 0 });

const DESCRIPTION_PRESETS = [
  { value: "fire_rated",      label: "Fire Rated Portacabin",    text: "Supply and delivery of prefabricated fire rated portacabin following detail;\n• " },
  { value: "site_office",     label: "Site Office",              text: "Supply and delivery of prefabricated site office following detail;\n• " },
  { value: "security_cabin",  label: "Security Cabin",           text: "Supply and delivery of prefabricated security cabin following detail;\n• " },
  { value: "standard_cabin",  label: "Standard Cabin",           text: "Supply and delivery of prefabricated standard cabin following detail;\n• " },
  { value: "container",       label: "Modified Container",       text: "Supply and delivery of modified container following detail;\n• " },
  { value: "aluminium",       label: "Aluminium Cladded Cabin",  text: "Supply and delivery of Aluminium cladded cabin following detail;\n• " },
  { value: "sandwich",        label: "Sandwich Panel Cabin",     text: "Supply and delivery of Sandwich panel type cabin following detail;\n• " },
  { value: "fencing",         label: "Fencing",                  text: "Supply and delivery of fencing following detail;\n• " },
  { value: "parking_shade",   label: "Parking Shade",            text: "Supply and delivery of Parking shade following detail;\n• " },
  { value: "furniture",       label: "Furniture Installation",   text: "Supply and delivery of Furniture installation following detail;\n• " },
  { value: "custom",          label: "Custom (type below)",      text: "" },
];

const DEFAULT_ADDITIONAL_ITEMS: AdditionalItem[] = [
  { description: "Transportation including RTA Permit", status: "Included", price: 0, quantity: 1, amount: 0 },
  { description: "Brand New SUPER GENERAL SPLIT AC UNIT", status: "Excluded", price: 0, quantity: 1, amount: 0 },
  { description: "Foundation Detail", status: "Excluded", price: 0, quantity: 1, amount: 0 },
  { description: "Staircase", status: "Excluded", price: 0, quantity: 1, amount: 0 },
  { description: "Additional Commercial Item", status: "Excluded", price: 0, quantity: 1, amount: 0 },
];

const DEFAULT_TECH_SPECS = getSpecTemplate(DEFAULT_SPEC_TYPE);


export function QuotationNew() {
  const [location, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: companies } = useListCompanies();

  // ?leadId=N → prefill the form from the lead.
  const leadIdParam = (() => {
    const m = (typeof window !== "undefined" ? window.location.search : "").match(/[?&]leadId=(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  })();
  const { data: leadForPrefill } = useGetLead(leadIdParam ?? 0, {
    query: { queryKey: getGetLeadQueryKey(leadIdParam ?? 0), enabled: !!leadIdParam },
  });
  const create = useCreateQuotation({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListQuotationsQueryKey() });
        navigate(`/sales/quotations/${data.id}`);
      },
    },
  });

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
    termsConditions: STANDARD_TC,
    techSpecs: DEFAULT_TECH_SPECS,
  });
  const [items, setItems] = useState<Item[]>([emptyItem()]);
  const [additionalItems, setAdditionalItems] = useState<AdditionalItem[]>(DEFAULT_ADDITIONAL_ITEMS);
  const [specType, setSpecType] = useState<SpecTypeKey>(DEFAULT_SPEC_TYPE);
  const [techSpecSections, setTechSpecSections] = useState<TechSpecSection[]>(() =>
    parseTechSpecs(getSpecTemplate(DEFAULT_SPEC_TYPE))
  );
  const [tcSections, setTcSections] = useState<TCSection[]>(() => parseTCString(STANDARD_TC));
  const [showTechSpecs, setShowTechSpecs] = useState(false);
  const [showTC, setShowTC] = useState(false);
  const [customSections, setCustomSections] = useState<{ title: string; content: string }[]>([]);

  // When opened via ?delegated=1 the admin has hidden contact details from the salesperson.
  const isDelegated = (typeof window !== "undefined" ? window.location.search : "").includes("delegated=1");

  // Prefill form once the lead is loaded. Field names mirror leads schema.
  useEffect(() => {
    if (!leadForPrefill) return;
    const l = leadForPrefill as any;
    setForm(p => ({
      ...p,
      companyId: l.companyId ? String(l.companyId) : p.companyId,
      // Contact fields are hidden when this form is opened from a delegated task
      clientName: isDelegated ? p.clientName : (l.companyName ?? l.leadName ?? p.clientName),
      clientContactPerson: isDelegated ? p.clientContactPerson : (l.leadName ?? p.clientContactPerson),
      clientEmail: isDelegated ? p.clientEmail : (l.email ?? p.clientEmail),
      clientPhone: isDelegated ? p.clientPhone : (l.phone ?? p.clientPhone),
      // Project fields are always pre-filled
      customerTrn: l.trnNumber ?? p.customerTrn,
      projectName: l.requirementType ?? p.projectName,
      projectLocation: l.officeAddress ?? l.location ?? p.projectLocation,
    }));
  }, [leadForPrefill]);

  const handleSpecTypeChange = (key: SpecTypeKey) => {
    setSpecType(key);
    setTechSpecSections(parseTechSpecs(getSpecTemplate(key)));
  };

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

  const [previewItems, setPreviewItems] = useState<Set<number>>(new Set());

  const renderDescriptionPreview = (text: string) =>
    text.split("\n").map((line, idx) =>
      line.startsWith("• ") ? (
        <div key={idx} className="flex gap-2 items-start text-sm text-[#1a3d6e]">
          <span className="mt-0.5 shrink-0 font-bold">•</span>
          <span>{line.slice(2)}</span>
        </div>
      ) : line ? (
        <div key={idx} className="text-sm text-[#1a3d6e]">{line}</div>
      ) : (
        <div key={idx} className="h-2" />
      )
    );

  const handleDescriptionKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, i: number) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const ta = e.currentTarget;
    const pos = ta.selectionStart;
    const newVal = ta.value.slice(0, pos) + "\n• " + ta.value.slice(ta.selectionEnd);
    updateItem(i, "description", newVal);
    requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = pos + 3; });
  };

  const updateAdditionalItem = (i: number, field: keyof AdditionalItem, val: string | number) => {
    setAdditionalItems(prev => {
      const next = [...prev];
      const updated = { ...next[i], [field]: val };
      const p = field === "price" ? Number(val) : updated.price;
      const q = field === "quantity" ? Number(val) : updated.quantity;
      updated.amount = updated.status === "Included" ? p * q : 0;
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

  const handleSubmit = (status: string) => {
    if (!form.companyId || !form.clientName) return;
    const lead = leadForPrefill as any;
    create.mutate({
      data: {
        ...form,
        techSpecs: serializeTechSpecs(techSpecSections),
        termsConditions: serializeTCSections(tcSections),
        status,
        companyId: parseInt(form.companyId, 10),
        items,
        additionalItems: JSON.stringify(additionalItems),
        customSections: JSON.stringify(customSections),
        ...(leadIdParam ? { leadId: leadIdParam } : {}),
        ...(lead?.clientCode ? { clientCode: lead.clientCode } : {}),
      } as any,
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/sales/quotations"><ArrowLeft className="w-4 h-4 mr-1" />Back</Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">New Quotation</h1>
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
            <Input value={form.clientContactPerson} onChange={e => setForm(p => ({ ...p, clientContactPerson: e.target.value }))} placeholder="e.g. Santosh Gowtham" />
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
            <Input
              value={form.paymentTerms}
              onChange={e => setForm(p => ({ ...p, paymentTerms: e.target.value }))}
              placeholder="e.g. 75% Advance upon LPO, 25% Before Delivery"
            />
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
                    <td className="p-1 border border-[#6fa3d8] border-t-0 align-top">
                      <div className="flex gap-1 mb-1">
                        <Select
                          value=""
                          onValueChange={v => {
                            const preset = DESCRIPTION_PRESETS.find(p => p.value === v);
                            if (preset && preset.value !== "custom") updateItem(i, "description", preset.text);
                            else if (preset?.value === "custom") updateItem(i, "description", "");
                          }}
                        >
                          <SelectTrigger className="h-7 text-xs flex-1 bg-[#1a3d6e] text-white border-[#1a3d6e] hover:bg-[#2d5a9e] [&>svg]:text-white">
                            <SelectValue placeholder="▾ Select template..." />
                          </SelectTrigger>
                          <SelectContent>
                            {DESCRIPTION_PRESETS.map(p => (
                              <SelectItem key={p.value} value={p.value} className="text-xs">{p.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <button
                          type="button"
                          title={previewItems.has(i) ? "Edit" : "Preview"}
                          onClick={() => setPreviewItems(prev => {
                            const next = new Set(prev);
                            next.has(i) ? next.delete(i) : next.add(i);
                            return next;
                          })}
                          className="h-7 w-7 shrink-0 flex items-center justify-center rounded border border-[#6fa3d8] bg-white hover:bg-[#e8f1fb] text-[#1a3d6e]"
                        >
                          {previewItems.has(i) ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                      {previewItems.has(i) ? (
                        <div className="min-h-[120px] w-full rounded border border-[#6fa3d8] bg-[#eaf3fb] p-2 space-y-0.5">
                          {item.description ? renderDescriptionPreview(item.description) : (
                            <span className="text-xs text-muted-foreground italic">No content yet…</span>
                          )}
                        </div>
                      ) : (
                        <Textarea
                          value={item.description}
                          onChange={e => updateItem(i, "description", e.target.value)}
                          onKeyDown={e => handleDescriptionKeyDown(e, i)}
                          className="text-sm w-full min-h-[120px] resize-y bg-transparent border-[#6fa3d8] focus:border-[#1a3d6e]"
                          placeholder="Select a template above or type freely..."
                        />
                      )}
                    </td>
                    <td className="p-0 border border-[#6fa3d8] border-t-0">
                      <Input
                        value={item.unit}
                        onChange={e => updateItem(i, "unit", e.target.value)}
                        className="h-full w-full min-h-[156px] rounded-none text-sm bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                        placeholder="e.g. 12X6X2.4M"
                      />
                    </td>
                    <td className="p-0 border border-[#6fa3d8] border-t-0">
                      <Input
                        type="number"
                        value={item.rate}
                        onChange={e => updateItem(i, "rate", e.target.value)}
                        className="h-full w-full min-h-[156px] rounded-none text-right text-sm bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                    </td>
                    <td className="p-0 border border-[#6fa3d8] border-t-0">
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={e => updateItem(i, "quantity", e.target.value)}
                        className="h-full w-full min-h-[156px] rounded-none text-right text-sm bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                    </td>
                    <td className="p-0 border border-[#6fa3d8] border-t-0">
                      <Input
                        type="number"
                        value={item.discount}
                        onChange={e => updateItem(i, "discount", e.target.value)}
                        className="h-full w-full min-h-[156px] rounded-none text-right text-sm bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
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

          {/* Project Items Subtotal */}
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
      <Card style={{ margin: "50px 50px" }}>
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
                    <Select
                      value={ai.status}
                      onValueChange={v => updateAdditionalItem(i, "status", v)}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Included">Included</SelectItem>
                        <SelectItem value="Excluded">Excluded</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="py-1.5 px-2 text-right text-sm font-medium">
                    {ai.status === "Included"
                      ? `AED ${ai.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
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
          {/* Additional Commercial Items Subtotal */}
          <div className="flex justify-end items-baseline gap-4 mt-4 pt-3 border-t">
            <span className="text-sm text-muted-foreground">Additional Commercial Items Subtotal (Excl. VAT)</span>
            <span className="text-base font-bold text-[#0f2d5a]">
              AED {additionalTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Totals */}
      <Card>
        <CardHeader><CardTitle>Totals</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-6 items-start">
            {/* Bank Details */}
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

            {/* Totals */}
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
                Choosing a type loads the matching template into the editor below — you can still edit it before saving. This prints as page 2 of the quotation.
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
              Edit T&amp;C sections below — each section prints with a navy header and numbered items. Printed as page 3 of the quotation.
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

      {canSignDocuments((user as any)?.permissionLevel) && (
        <SignatureStampPreview
          signatureUrl={(user as any)?.signatureUrl ?? undefined}
          stampUrl={companies?.find(c => c.id === form.companyId)?.stamp ?? undefined}
          stampWidthPct={companies?.find(c => c.id === form.companyId)?.stampWidthPct ?? undefined}
        />
      )}

      <div className="flex gap-3 justify-end">
        <Button variant="outline" asChild><Link href="/sales/quotations">Cancel</Link></Button>
        <Button
          variant="outline"
          onClick={() => handleSubmit("draft")}
          disabled={create.isPending || !form.companyId || !form.clientName}
        >
          Save as Draft
        </Button>
        <Button
          onClick={() => handleSubmit("sent")}
          disabled={create.isPending || !form.companyId || !form.clientName}
        >
          {create.isPending ? "Creating..." : "Create & Send"}
        </Button>
      </div>
    </div>
  );
}
