import { useState } from "react";
import { useCreateQuotation, useListCompanies } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListQuotationsQueryKey } from "@workspace/api-client-react";
import {
  SPEC_TYPE_OPTIONS,
  DEFAULT_SPEC_TYPE,
  getSpecTemplate,
  type SpecTypeKey,
} from "@/lib/tech-spec-templates";
import { PAYMENT_TERMS_PRESETS, getPresetByKey } from "@/lib/payment-terms";

const BANK_DETAILS: Record<number, { bankName: string; accountTitle: string; accountNumber: string; iban: string; swift: string; currency: string }> = {
  1: {
    bankName: "Abu Dhabi Commercial Bank (ADCB)",
    accountTitle: "PRIME MAX PREFAB HOUSES IND LLC",
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

const DEFAULT_ADDITIONAL_ITEMS: AdditionalItem[] = [
  { description: "Transportation including RTA Permit", status: "Included", price: 0, quantity: 1, amount: 0 },
  { description: "Brand New SUPER GENERAL SPLIT AC UNIT", status: "Excluded", price: 0, quantity: 1, amount: 0 },
  { description: "Foundation Detail", status: "Excluded", price: 0, quantity: 1, amount: 0 },
  { description: "Staircase", status: "Excluded", price: 0, quantity: 1, amount: 0 },
  { description: "Additional Commercial Item", status: "Excluded", price: 0, quantity: 1, amount: 0 },
];

const DEFAULT_TECH_SPECS = getSpecTemplate(DEFAULT_SPEC_TYPE);

const DEFAULT_TC = `1. COMMERCIAL BASIS

1. Prices are quoted in accordance with the attached specification and the received project requirements. Any revision, deviation, or additional requirement shall be treated as a variation and priced separately.

2. Unless specifically included in the quotation, the customer shall provide crane support, foundation, safe offloading access, and all site arrangements required for unloading and installation.

3. Commercial basis: Ex-factory.

4. All cheques shall be prepared in favor of "PRIME MAX PREFAB HOUSES IND. LLC."


2. EXCLUSIONS

1. Offloading, excavation, foundation works, and any on-site civil works unless specifically included in the quotation.

2. Expenses related to third-party inspections, testing, statutory approvals, and authority clearances.

3. Window blinds, fire extinguishers, firefighting systems, smoke detectors, fire alarm panel systems, and similar items unless expressly included.

4. Additional third-party certification or testing costs related to welding, painting, lifting eyes, and comparable specialized requirements.

5. Charges for third-party design calculations and certifications, including live load, dead load, wind load, and related engineering assessments.

6. Replaceable items and components subject to normal wear and tear, including ceiling lights, wash basin and shower mixers, shattaf, cistern seat covers, door handles, and locks.


3. PAYMENT TERMS

1. 75% advance payment upon receipt of the LPO and approved drawings.

2. 25% balance payment before delivery.

3. Cheque shall be prepared in favor of "PRIME MAX PREFAB HOUSES IND. LLC."

4. Production and delivery shall proceed in accordance with the approved drawing set, agreed commercial terms, and payment milestone compliance.


4. TECHNICAL & GENERAL NOTES

1. All drawings and designs remain subject to client approval. The attached technical specification shall be considered the governing reference for manufacturing and installation.

2. As part of our quality-control procedures, we reserve the right to introduce, upgrade, or modify materials with equivalent or better performance where required.

3. For any queries or clarifications, please contact our sales team. We shall be pleased to assist you.`;

export function QuotationNew() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { data: companies } = useListCompanies();
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
    termsConditions: DEFAULT_TC,
    techSpecs: DEFAULT_TECH_SPECS,
  });
  const [items, setItems] = useState<Item[]>([emptyItem()]);
  const [additionalItems, setAdditionalItems] = useState<AdditionalItem[]>(DEFAULT_ADDITIONAL_ITEMS);
  const [specType, setSpecType] = useState<SpecTypeKey>(DEFAULT_SPEC_TYPE);
  const [showTechSpecs, setShowTechSpecs] = useState(false);
  const [showTC, setShowTC] = useState(false);
  const [customSpecSection, setCustomSpecSection] = useState("");

  const handleSpecTypeChange = (key: SpecTypeKey) => {
    setSpecType(key);
    setForm(p => ({ ...p, techSpecs: getSpecTemplate(key) }));
  };

  const handleAddSpecSection = () => {
    const name = customSpecSection.trim();
    if (!name) return;
    const heading = name.toUpperCase();
    setForm(p => {
      const sep = p.techSpecs.endsWith("\n") ? "\n" : "\n\n";
      return { ...p, techSpecs: `${p.techSpecs}${sep}${heading}\na. ` };
    });
    setCustomSpecSection("");
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

  const subtotal = items.reduce((s, it) => s + it.amount, 0);
  const discountedSubtotal = subtotal * (1 - form.discount / 100);
  const vatAmount = discountedSubtotal * form.vatPercent / 100;
  const grandTotal = discountedSubtotal + vatAmount;

  const handleSubmit = (status: string) => {
    if (!form.companyId || !form.clientName) return;
    create.mutate({
      data: {
        ...form,
        status,
        companyId: parseInt(form.companyId, 10),
        items,
        additionalItems: JSON.stringify(additionalItems),
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-center pb-2 pt-1 font-semibold w-10">S#</th>
                  <th className="text-left pb-2 pt-1 font-semibold pl-2">Description</th>
                  <th className="text-left pb-2 pt-1 font-semibold w-32 pl-2">Size / Status</th>
                  <th className="text-right pb-2 pt-1 font-semibold w-28">Price (AED)</th>
                  <th className="text-right pb-2 pt-1 font-semibold w-16">Qty.</th>
                  <th className="text-right pb-2 pt-1 font-semibold w-32">Total (AED)</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i} className="border-b last:border-0 align-top">
                    <td className="py-1 text-center text-muted-foreground font-medium pt-2">
                      {String(i + 1).padStart(2, "0")}
                    </td>
                    <td className="py-1 pr-2 pl-2">
                      <Textarea
                        value={item.description}
                        onChange={e => updateItem(i, "description", e.target.value)}
                        className="text-sm min-h-[64px] resize-y"
                        placeholder="Describe prefab cabin details..."
                      />
                    </td>
                    <td className="py-1 px-1">
                      <Input
                        value={item.unit}
                        onChange={e => updateItem(i, "unit", e.target.value)}
                        className="h-8 text-sm"
                        placeholder="e.g. 12X6X2.4M"
                      />
                    </td>
                    <td className="py-1 px-1">
                      <Input
                        type="number"
                        value={item.rate}
                        onChange={e => updateItem(i, "rate", e.target.value)}
                        className="h-8 text-right w-full text-sm"
                      />
                    </td>
                    <td className="py-1 px-1">
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={e => updateItem(i, "quantity", e.target.value)}
                        className="h-8 text-right w-full text-sm"
                      />
                    </td>
                    <td className="py-1 pl-1 text-right font-medium pt-2 text-sm">
                      AED {item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-1 pl-1">
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
                <span>AED {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
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
                <span>AED {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
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
            <Textarea
              value={form.techSpecs}
              onChange={e => setForm(p => ({ ...p, techSpecs: e.target.value }))}
              rows={20}
              className="font-mono text-xs"
            />
            <div className="flex items-end gap-2 mt-3">
              <div className="flex-1 space-y-1">
                <Label className="text-xs font-medium">Add Custom Section</Label>
                <Input
                  value={customSpecSection}
                  onChange={e => setCustomSpecSection(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddSpecSection();
                    }
                  }}
                  placeholder="e.g. Plumbing, HVAC, Painting…"
                  className="h-8 text-xs"
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAddSpecSection}
                disabled={!customSpecSection.trim()}
              >
                <Plus className="w-4 h-4 mr-1" /> Add Section
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Appends a new uppercase section heading and an "a." bullet at the end of the spec — fill in the rest in the editor above.
            </p>
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
              This will print as a separate page 3 in the quotation document.
            </p>
            <Textarea
              value={form.termsConditions}
              onChange={e => setForm(p => ({ ...p, termsConditions: e.target.value }))}
              rows={16}
              className="font-mono text-xs"
            />
          </CardContent>
        )}
      </Card>

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
