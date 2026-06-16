import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { SignatureStampPreview } from "@/components/signature-stamp-preview";
import { canSignDocuments } from "@/lib/permissions";
import { useCreateQuotation, useListCompanies, useGetLead, getGetLeadQueryKey, useListContacts, useListLeads } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Plus, Trash2, ChevronDown, ChevronUp, Search, UserCheck } from "lucide-react";
import { toast } from "sonner";
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
import { PaymentTermsBuilder } from "@/components/payment-terms-builder";
import { AdditionalItemsTable, type AdditionalItem } from "@/components/additional-items-table";
import { ProjectItemsTable, emptyProjectItem, type ProjectItem } from "@/components/project-items-table";

const BANK_DETAILS: Record<number, { bankName: string; accountTitle: string; accountNumber: string; iban: string; swift: string; currency: string }> = {
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

  // ?clientName=... → pre-fill client name (used when navigating from a Deal with no linked lead)
  const clientNameParam = (() => {
    if (typeof window === "undefined") return null;
    const m = window.location.search.match(/[?&]clientName=([^&]*)/);
    return m ? decodeURIComponent(m[1]) : null;
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
      onError: (err: any) => {
        const msg = err?.response?.data?.message ?? err?.response?.data?.error ?? err?.message ?? "Failed to create quotation";
        toast.error(msg);
      },
    },
  });

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
    termsConditions: STANDARD_TC,
    techSpecs: DEFAULT_TECH_SPECS,
    creatorName: "",
    creatorPhone: "",
    creatorEmail: "",
    creatorDesignation: "",
  });

  useEffect(() => {
    if (!user) return;
    setForm(p => ({
      ...p,
      creatorName: p.creatorName || (user as any).name || "",
      creatorPhone: p.creatorPhone || (user as any).phone || "",
      creatorEmail: p.creatorEmail || (user as any).email || "",
      creatorDesignation: p.creatorDesignation || (user as any).designation || "",
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // When company changes → load saved contact from localStorage (takes priority over login defaults)
  useEffect(() => {
    if (!form.companyId) return;
    try {
      const saved = localStorage.getItem(`erp_company_contact_${form.companyId}`);
      if (!saved) return;
      const c = JSON.parse(saved) as { creatorName?: string; creatorPhone?: string; creatorEmail?: string; creatorDesignation?: string };
      setForm(p => ({
        ...p,
        creatorName: c.creatorName || p.creatorName,
        creatorPhone: c.creatorPhone || p.creatorPhone,
        creatorEmail: c.creatorEmail || p.creatorEmail,
        creatorDesignation: c.creatorDesignation || p.creatorDesignation,
      }));
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.companyId]);

  // Auto-save company contact to localStorage whenever any contact field changes
  useEffect(() => {
    if (!form.companyId) return;
    if (!form.creatorEmail && !form.creatorName && !form.creatorPhone && !form.creatorDesignation) return;
    try {
      localStorage.setItem(`erp_company_contact_${form.companyId}`, JSON.stringify({
        creatorName: form.creatorName,
        creatorPhone: form.creatorPhone,
        creatorEmail: form.creatorEmail,
        creatorDesignation: form.creatorDesignation,
      }));
    } catch { /* ignore */ }
  }, [form.companyId, form.creatorName, form.creatorPhone, form.creatorEmail, form.creatorDesignation]);


  // Contact / lead search picker
  const { data: allContacts } = useListContacts({});
  const { data: allLeads } = useListLeads({});
  const [clientSearch, setClientSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  type PickerRow = { _type: "contact" | "lead"; id: number; companyName: string; contactPerson: string; phone: string; email: string; designation: string; trn: string; address: string; clientCode?: string };

  const pickerResults = (() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q || q.length < 2) return [] as PickerRow[];
    const rows: PickerRow[] = [];
    (allContacts ?? []).forEach((c: any) => {
      const haystack = `${c.companyName ?? ""} ${c.name ?? ""} ${c.email ?? ""} ${c.phone ?? ""}`.toLowerCase();
      if (haystack.includes(q)) rows.push({ _type: "contact", id: c.id, companyName: c.companyName ?? c.name ?? "", contactPerson: c.name ?? "", phone: c.phone ?? "", email: c.email ?? "", designation: c.designation ?? "", trn: c.trnNumber ?? "", address: c.address ?? "", clientCode: c.clientCode });
    });
    (allLeads ?? []).forEach((l: any) => {
      const haystack = `${l.companyName ?? ""} ${l.leadName ?? ""} ${l.contactPerson ?? ""} ${l.email ?? ""} ${l.phone ?? ""}`.toLowerCase();
      if (haystack.includes(q)) rows.push({ _type: "lead", id: l.id, companyName: l.companyName ?? l.leadName ?? "", contactPerson: l.contactPerson ?? l.leadName ?? "", phone: l.phone ?? "", email: l.email ?? "", designation: l.designation ?? "", trn: l.trnNumber ?? "", address: l.officeAddress ?? "", clientCode: l.clientCode });
    });
    return rows.slice(0, 12);
  })();

  const applyPickerRow = (row: PickerRow) => {
    setForm(p => ({
      ...p,
      clientName: row.companyName || p.clientName,
      clientContactPerson: row.contactPerson || p.clientContactPerson,
      clientPhone: row.phone || p.clientPhone,
      clientEmail: row.email || p.clientEmail,
      clientDesignation: row.designation || p.clientDesignation,
      clientAddress: row.address || p.clientAddress,
      customerTrn: row.trn || p.customerTrn,
      projectLocation: row.address || p.projectLocation,
    }));
    setClientSearch("");
    setPickerOpen(false);
  };
  const [items, setItems] = useState<ProjectItem[]>([emptyProjectItem()]);
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

  // Prefill client name from ?clientName= param (used when creating quotation from a deal with no linked lead)
  useEffect(() => {
    if (!clientNameParam || leadIdParam) return;
    setForm(p => ({ ...p, clientName: clientNameParam }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      clientAddress: l.officeAddress ?? p.clientAddress,
      projectName: l.requirementType ?? p.projectName,
      projectLocation: l.officeAddress ?? l.location ?? p.projectLocation,
    }));
  }, [leadForPrefill]);

  const handleSpecTypeChange = (key: SpecTypeKey) => {
    setSpecType(key);
    setTechSpecSections(parseTechSpecs(getSpecTemplate(key)));
  };




  const company = companies?.find(c => c.id === parseInt(form.companyId || "0", 10));
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
        items: items.map(it => ({ ...it, unit: it.sizeStatus })),
        additionalItems: JSON.stringify(additionalItems),
        customSections: JSON.stringify(customSections),
        ...(leadIdParam ? { leadId: leadIdParam } : {}),
        ...(lead?.clientCode ? { clientCode: lead.clientCode } : {}),
      } as any,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/sales/quotations"><ArrowLeft className="w-4 h-4 mr-1" />Back</Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">New Quotation</h1>
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
          {/* Client search picker */}
          <div className="col-span-2">
            <div ref={pickerRef} className="relative">
              <Label className="flex items-center gap-1.5 mb-1"><Search className="w-3.5 h-3.5 text-muted-foreground" />Search Contact / Lead to auto-fill</Label>
              <Input
                value={clientSearch}
                onChange={e => { setClientSearch(e.target.value); setPickerOpen(true); }}
                onFocus={() => { if (clientSearch.length >= 2) setPickerOpen(true); }}
                placeholder="Type company name, contact person, email or phone…"
              />
              {pickerOpen && pickerResults.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                  {pickerResults.map(row => (
                    <button
                      key={`${row._type}-${row.id}`}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-purple-50 border-b border-gray-100 last:border-0"
                      onClick={() => applyPickerRow(row)}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${row._type === "contact" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"}`}>
                          {row._type === "contact" ? "CONTACT" : "LEAD"}
                        </span>
                        <span className="font-semibold text-sm text-gray-900 truncate">{row.companyName}</span>
                      </div>
                      {row.contactPerson && <div className="text-xs text-gray-500 mt-0.5 ml-0.5">{row.contactPerson}{row.designation ? ` · ${row.designation}` : ""}{row.phone ? ` · ${row.phone}` : ""}</div>}
                    </button>
                  ))}
                </div>
              )}
              {pickerOpen && clientSearch.length >= 2 && pickerResults.length === 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl px-3 py-2 text-sm text-muted-foreground">No contacts or leads match.</div>
              )}
            </div>
            {form.clientName && (
              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-green-700 font-medium">
                <UserCheck className="w-3.5 h-3.5" />{form.clientName} selected — fields filled below. You can still edit them.
              </div>
            )}
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
            {/* Bank Details */}
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

            {/* Totals */}
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
                Choosing a type loads the matching template into the editor below — you can still edit it before saving. This prints as page 2 of the quotation.
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
              Edit T&amp;C sections below — each section prints with a navy header and numbered items. Printed as page 3 of the quotation.
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
