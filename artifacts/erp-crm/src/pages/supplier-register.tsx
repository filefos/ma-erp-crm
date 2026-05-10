import { useState, useEffect } from "react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import {
  useListPublicCompanies,
  useListSupplierCategories,
  useSubmitSupplierRegistration,
  useGetSupplierInvite,
  getGetSupplierInviteQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Building2, User, Banknote, Tags, Paperclip, FileText, ClipboardList,
  CheckCircle2, AlertCircle, Loader2, ArrowRight, ArrowLeft, Plus, X, Link2,
} from "lucide-react";

type DocumentType =
  | "trade_licence" | "vat_certificate" | "bank_reference"
  | "signatory_id" | "iso_certificate" | "insurance" | "other";

interface UploadedFile {
  filename: string;
  contentType: string;
  content: string;
  size: number;
  documentType: DocumentType;
}

const DOC_SLOTS: Array<{ id: DocumentType; label: string; required: boolean | "vatOnly"; hint?: string }> = [
  { id: "trade_licence",   label: "Trade Licence",                required: true,      hint: "Valid trade licence (PDF/JPG)" },
  { id: "vat_certificate", label: "VAT Certificate",              required: "vatOnly", hint: "Required if VAT-registered" },
  { id: "bank_reference",  label: "Bank Reference Letter",        required: true,      hint: "Letter from your bank confirming account details" },
  { id: "signatory_id",    label: "Signatory Passport / Emirates ID", required: true,  hint: "ID of authorised signatory" },
  { id: "iso_certificate", label: "ISO 9001 Certificate",         required: false,     hint: "Optional" },
  { id: "insurance",       label: "Insurance Certificate",        required: false,     hint: "Optional" },
];

interface ReferenceClient { name: string; contact: string }

const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-500", "500+"];
const TURNOVER_BANDS = ["< 1M", "1-5M", "5-25M", "25M+"];
const EMIRATES = ["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Umm Al Quwain", "Ras Al Khaimah", "Fujairah"];
const COUNTRIES = [
  "United Arab Emirates", "Saudi Arabia", "Oman", "Qatar", "Kuwait", "Bahrain",
  "India", "Pakistan", "China", "Turkey", "Germany", "United Kingdom", "Other",
];

const STEPS = [
  { id: 1, label: "Company",     icon: Building2 },
  { id: 2, label: "Contact",     icon: User },
  { id: 3, label: "Categories",  icon: Tags },
  { id: 4, label: "Banking",     icon: Banknote },
  { id: 5, label: "Profile",     icon: ClipboardList },
  { id: 6, label: "Documents",   icon: Paperclip },
  { id: 7, label: "Review",      icon: FileText },
];

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_FILES = 6;

export default function SupplierRegisterPage() {
  const { activeCompanyId } = useActiveCompany();
  const isElite = activeCompanyId === 2;
  const primeBtnCls = isElite ? "bg-[#0D0D0D] hover:bg-[#8B0000]" : "bg-[#0f2d5a] hover:bg-[#1e6ab0]";
  const { data: companies } = useListPublicCompanies();
  const { data: categories } = useListSupplierCategories();
  const submit = useSubmitSupplierRegistration();

  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState<{ refNumber: string; companyName: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteBanner, setInviteBanner] = useState<string | null>(null);

  // Parse ?invite=<token> from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tok = params.get("invite");
    if (tok) setInviteToken(tok);
  }, []);

  // Fetch invite metadata when token is present
  const { data: inviteData } = useGetSupplierInvite(inviteToken ?? "", {
    query: {
      queryKey: getGetSupplierInviteQueryKey(inviteToken ?? ""),
      enabled: !!inviteToken,
    },
  });

  const [form, setForm] = useState({
    companyId: 0,
    // Company
    companyName: "",
    tradeName: "",
    tradeLicenseNo: "",
    licenseAuthority: "",
    licenseExpiry: "",
    establishedYear: "",
    companySize: "",
    country: "United Arab Emirates",
    emirate: "",
    city: "",
    poBox: "",
    address: "",
    website: "",
    // Contact
    contactPerson: "",
    designation: "",
    email: "",
    phone: "",
    whatsapp: "",
    tenderContactName: "",
    tenderContactMobile: "",
    tenderContactEmail: "",
    // Tax
    trn: "",
    vatRegistered: false,
    vatCertificateExpiry: "",
    chamberMembership: "",
    // Banking
    bankName: "",
    bankBranch: "",
    bankAccountName: "",
    bankAccountNumber: "",
    iban: "",
    swift: "",
    currency: "AED",
    // Categories + commercial
    categories: [] as string[],
    categoriesOther: "",
    paymentTerms: "",
    deliveryTerms: "",
    // Profile
    yearsExperience: "",
    turnoverBand: "",
    employeeBand: "",
    majorClients: "",
    // Declarations
    agreedTerms: false,
    agreedCodeOfConduct: false,
  });
  const [refClients, setRefClients] = useState<ReferenceClient[]>([{ name: "", contact: "" }]);
  const [files, setFiles] = useState<UploadedFile[]>([]);

  // Pre-fill form when invite data arrives
  useEffect(() => {
    if (!inviteData) return;
    setForm(prev => ({
      ...prev,
      companyId: inviteData.companyId ?? prev.companyId,
      companyName: (inviteData as any).supplierCompanyName ?? prev.companyName,
      email: (inviteData as any).supplierEmail ?? prev.email,
    }));
    const parts: string[] = [];
    if ((inviteData as any).supplierCompanyName) parts.push((inviteData as any).supplierCompanyName);
    if ((inviteData as any).supplierEmail) parts.push((inviteData as any).supplierEmail);
    setInviteBanner(parts.length ? `Invited: ${parts.join(" · ")}` : "You were invited to register as a supplier.");
  }, [inviteData]);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm(p => ({ ...p, [key]: value }));
  }

  function toggleCategory(name: string) {
    setForm(p => ({
      ...p,
      categories: p.categories.includes(name)
        ? p.categories.filter(c => c !== name)
        : [...p.categories, name],
    }));
  }

  async function onSlotFileChange(slot: DocumentType, e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > MAX_FILE_BYTES) { setError(`${f.name} exceeds 5MB limit.`); return; }
    const buf = await f.arrayBuffer();
    const bin = new Uint8Array(buf);
    let raw = "";
    for (let i = 0; i < bin.byteLength; i++) raw += String.fromCharCode(bin[i]);
    const base64 = btoa(raw);
    const upload: UploadedFile = {
      filename: f.name,
      contentType: f.type || "application/octet-stream",
      content: base64,
      size: f.size,
      documentType: slot,
    };
    setFiles(p => {
      const others = p.filter(x => x.documentType !== slot);
      if (others.length + 1 > MAX_FILES) { setError(`Maximum ${MAX_FILES} files allowed.`); return p; }
      return [...others, upload];
    });
    setError(null);
  }

  function removeSlotFile(slot: DocumentType) {
    setFiles(p => p.filter(x => x.documentType !== slot));
  }

  function setRef(idx: number, key: keyof ReferenceClient, value: string) {
    setRefClients(p => p.map((r, i) => i === idx ? { ...r, [key]: value } : r));
  }
  function addRef() { if (refClients.length < 3) setRefClients(p => [...p, { name: "", contact: "" }]); }
  function removeRef(idx: number) {
    setRefClients(p => p.length === 1 ? [{ name: "", contact: "" }] : p.filter((_, i) => i !== idx));
  }

  function validateStep(s: number): string | null {
    if (s === 1) {
      if (!form.companyId) return "Please select the company you are applying to.";
      if (!form.companyName.trim()) return "Legal company name is required.";
      if (!form.tradeName.trim()) return "Trade name (DBA) is required.";
      if (!form.tradeLicenseNo.trim()) return "Trade Licence Number is required.";
      if (!form.licenseAuthority.trim()) return "Trade Licence issuing authority is required.";
      if (!form.licenseExpiry) return "Trade Licence expiry date is required.";
      if (!form.establishedYear.trim()) return "Year established is required.";
      if (!form.companySize.trim()) return "Company size is required.";
      if (!form.country.trim()) return "Country is required.";
      if (!form.city.trim()) return "City is required.";
      if (!form.emirate.trim()) return "Emirate is required.";
      if (!form.poBox.trim()) return "PO Box is required.";
      if (!form.address.trim()) return "Office address is required.";
      if (!form.website.trim()) return "Company website is required.";
    }
    if (s === 2) {
      if (!form.contactPerson.trim()) return "Authorised signatory name is required.";
      if (!form.designation.trim()) return "Signatory designation is required.";
      if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return "A valid contact email is required.";
      if (!form.phone.trim()) return "Phone number is required.";
      if (!form.tenderContactName.trim()) return "Tender / RFQ contact name is required.";
      if (!form.tenderContactMobile.trim()) return "Tender contact mobile number is required.";
      if (!form.tenderContactEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.tenderContactEmail)) return "A valid tender contact email is required.";
      if (form.vatRegistered && !form.trn.trim()) return "VAT TRN is required when VAT-registered.";
    }
    if (s === 3) {
      if (form.categories.length === 0) return "Please select at least one supply category.";
      if (form.categories.includes("Other") && !form.categoriesOther.trim()) return "Please describe the Other category.";
    }
    if (s === 4) {
      if (!form.bankName.trim()) return "Bank name is required.";
      if (!form.bankBranch.trim()) return "Bank branch is required.";
      if (!form.bankAccountName.trim()) return "Account holder name is required.";
      if (!form.bankAccountNumber.trim()) return "Account number is required.";
      if (!form.iban.trim()) return "IBAN is required.";
      if (!form.swift.trim()) return "SWIFT / BIC code is required.";
      if (!form.currency.trim()) return "Account currency is required.";
    }
    if (s === 5) {
      if (!form.yearsExperience.trim()) return "Years of experience is required.";
      if (!form.turnoverBand.trim()) return "Annual turnover band is required.";
      if (!form.employeeBand.trim()) return "Employee count band is required.";
    }
    if (s === 6) {
      const present = new Set(files.map(f => f.documentType));
      const missing = DOC_SLOTS.filter(d =>
        d.required === true || (d.required === "vatOnly" && form.vatRegistered),
      ).filter(d => !present.has(d.id));
      if (missing.length > 0) return `Please upload all required documents: ${missing.map(d => d.label).join(", ")}.`;
    }
    return null;
  }

  function next() {
    const e = validateStep(step);
    if (e) { setError(e); return; }
    setError(null);
    setStep(s => Math.min(STEPS.length, s + 1));
  }

  function back() {
    setError(null);
    setStep(s => Math.max(1, s - 1));
  }

  async function onSubmit() {
    if (!form.agreedTerms) { setError("Please confirm the truth-and-accuracy declaration."); return; }
    if (!form.agreedCodeOfConduct) { setError("Please accept the Code of Conduct & anti-bribery policy."); return; }
    for (let s = 1; s <= 6; s++) {
      const err = validateStep(s);
      if (err) { setStep(s); setError(err); return; }
    }
    setError(null);
    try {
      const cleanRefs = refClients.filter(r => r.name.trim() || r.contact.trim()).slice(0, 3);
      const result = await submit.mutateAsync({
        data: {
          ...form,
          referenceClients: cleanRefs,
          attachments: files.map(f => ({ filename: f.filename, contentType: f.contentType, content: f.content, documentType: f.documentType })),
          ...(inviteToken ? { inviteToken } : {}),
        } as any,
      });
      const co = companies?.find(c => c.id === form.companyId);
      setSubmitted({ refNumber: result.refNumber, companyName: co?.name ?? "Procurement Team" });
    } catch (err: unknown) {
      const e = err as { error?: string; message?: string };
      setError(e?.error ?? e?.message ?? "Submission failed. Please try again.");
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0f2d5a] via-[#13407d] to-[#1e6ab0] flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-card rounded-2xl shadow-2xl p-8 text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-9 h-9 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold mb-1">Thank you!</h1>
            <p className="text-muted-foreground">
              Your supplier application has been received by <strong>{submitted.companyName}</strong>.
            </p>
          </div>
          <div className="bg-muted rounded-xl p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Reference Number</div>
            <div className="text-2xl font-mono font-bold text-[#0f2d5a] dark:text-white">{submitted.refNumber}</div>
          </div>
          <p className="text-sm text-muted-foreground">
            A confirmation has been sent to <strong>{form.email}</strong>. Our procurement team will review your application and respond within 5-7 working days. Please save the reference number for any follow-up.
          </p>
          <Button asChild variant="outline" className="w-full">
            <a href="/login">Back to Login</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="bg-[#0f2d5a] text-white">
        <div className="max-w-4xl mx-auto px-4 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/15 rounded-xl px-4 py-2 backdrop-blur ring-1 ring-white/20">
              <div className="text-xl font-extrabold tracking-widest leading-none">Prime</div>
            </div>
            <div>
              <div className="text-lg font-semibold">Become a Supplier</div>
              <div className="text-xs text-white/70">PRIME ERP SYSTEMS — UAE Procurement</div>
            </div>
          </div>
          <a href="/login" className="text-xs text-white/80 hover:text-white underline">Sign in</a>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {inviteBanner && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            <Link2 className="w-4 h-4 shrink-0 text-blue-600" />
            <span>{inviteBanner}</span>
          </div>
        )}
        <div className="flex items-center justify-between mb-6 overflow-x-auto">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = step === s.id;
            const done = step > s.id;
            return (
              <div key={s.id} className="flex items-center flex-1 min-w-0">
                <div className={`flex flex-col items-center gap-1 ${active ? "text-[#1e6ab0]" : done ? "text-emerald-600" : "text-muted-foreground"}`}>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 ${active ? "border-[#1e6ab0] bg-[#1e6ab0]/10" : done ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20" : "border-muted-foreground/30"}`}>
                    {done ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <div className="text-[10px] font-medium hidden sm:block">{s.label}</div>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 ${done ? "bg-emerald-600" : "bg-muted-foreground/20"}`} />
                )}
              </div>
            );
          })}
        </div>

        <div className="bg-card border rounded-2xl shadow-sm p-6 space-y-5">
          {error && (
            <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/40 rounded-lg p-3 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>{error}</div>
            </div>
          )}

          {/* STEP 1 — Company */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Company Information</h2>

              <div className="space-y-2">
                <Label>Apply to <span className="text-red-500">*</span></Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(companies ?? []).map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => update("companyId", c.id)}
                      className={`text-left border rounded-lg p-3 transition-all ${form.companyId === c.id ? "border-[#1e6ab0] bg-[#1e6ab0]/5 ring-2 ring-[#1e6ab0]/20" : "hover:border-muted-foreground/40"}`}
                    >
                      <div className="font-semibold text-sm">{c.name}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{c.prefix ?? ""}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Legal Company Name" required>
                  <Input value={form.companyName} onChange={e => update("companyName", e.target.value)} />
                </Field>
                <Field label="Trading / Brand Name">
                  <Input value={form.tradeName} onChange={e => update("tradeName", e.target.value)} />
                </Field>
                <Field label="Trade Licence No." required>
                  <Input value={form.tradeLicenseNo} onChange={e => update("tradeLicenseNo", e.target.value)} />
                </Field>
                <Field label="Issuing Authority">
                  <Input value={form.licenseAuthority} onChange={e => update("licenseAuthority", e.target.value)} placeholder="e.g. DED Dubai" />
                </Field>
                <Field label="Trade Licence Expiry" required>
                  <Input type="date" value={form.licenseExpiry} onChange={e => update("licenseExpiry", e.target.value)} />
                </Field>
                <Field label="Year Established">
                  <Input value={form.establishedYear} onChange={e => update("establishedYear", e.target.value)} placeholder="e.g. 2015" />
                </Field>
                <Field label="Company Size">
                  <Select value={form.companySize} onValueChange={v => update("companySize", v)}>
                    <SelectTrigger><SelectValue placeholder="Select size" /></SelectTrigger>
                    <SelectContent>
                      {COMPANY_SIZES.map(s => <SelectItem key={s} value={s}>{s} employees</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Website">
                  <Input value={form.website} onChange={e => update("website", e.target.value)} placeholder="https://" />
                </Field>
                <Field label="Country">
                  <Select value={form.country} onValueChange={v => update("country", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Emirate">
                  <Select value={form.emirate} onValueChange={v => update("emirate", v)}>
                    <SelectTrigger><SelectValue placeholder="Select emirate" /></SelectTrigger>
                    <SelectContent>
                      {EMIRATES.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="City">
                  <Input value={form.city} onChange={e => update("city", e.target.value)} />
                </Field>
                <Field label="P.O. Box">
                  <Input value={form.poBox} onChange={e => update("poBox", e.target.value)} />
                </Field>
                <Field label="Office Address" className="sm:col-span-2">
                  <Textarea value={form.address} onChange={e => update("address", e.target.value)} rows={2} />
                </Field>
              </div>
            </div>
          )}

          {/* STEP 2 — Contact + tax + tender contact */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Contact &amp; Tax Details</h2>

              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Authorised Signatory</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Name" required>
                  <Input value={form.contactPerson} onChange={e => update("contactPerson", e.target.value)} />
                </Field>
                <Field label="Designation">
                  <Input value={form.designation} onChange={e => update("designation", e.target.value)} />
                </Field>
                <Field label="Email" required>
                  <Input type="email" value={form.email} onChange={e => update("email", e.target.value)} />
                </Field>
                <Field label="Mobile" required>
                  <Input value={form.phone} onChange={e => update("phone", e.target.value)} placeholder="+971 ..." />
                </Field>
                <Field label="WhatsApp">
                  <Input value={form.whatsapp} onChange={e => update("whatsapp", e.target.value)} placeholder="+971 ..." />
                </Field>
              </div>

              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-2">Tender / RFQ Contact</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Name">
                  <Input value={form.tenderContactName} onChange={e => update("tenderContactName", e.target.value)} />
                </Field>
                <Field label="Mobile">
                  <Input value={form.tenderContactMobile} onChange={e => update("tenderContactMobile", e.target.value)} />
                </Field>
                <Field label="Email">
                  <Input type="email" value={form.tenderContactEmail} onChange={e => update("tenderContactEmail", e.target.value)} />
                </Field>
              </div>

              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-2">Tax &amp; Legal</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center gap-2 pt-6">
                  <Checkbox id="vat" checked={form.vatRegistered} onCheckedChange={v => update("vatRegistered", Boolean(v))} />
                  <Label htmlFor="vat" className="cursor-pointer">VAT Registered</Label>
                </div>
                <Field label="VAT TRN">
                  <Input value={form.trn} onChange={e => update("trn", e.target.value)} />
                </Field>
                <Field label="VAT Certificate Expiry">
                  <Input type="date" value={form.vatCertificateExpiry} onChange={e => update("vatCertificateExpiry", e.target.value)} />
                </Field>
                <Field label="Chamber of Commerce No.">
                  <Input value={form.chamberMembership} onChange={e => update("chamberMembership", e.target.value)} placeholder="(optional)" />
                </Field>
              </div>
            </div>
          )}

          {/* STEP 3 — Categories */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Supply Categories</h2>
              <p className="text-sm text-muted-foreground">Select all categories you can supply or service.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(categories ?? []).map(cat => {
                  const checked = form.categories.includes(cat.name);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => toggleCategory(cat.name)}
                      className={`text-left border rounded-lg p-2.5 transition-all flex items-center gap-2 ${checked ? "border-[#1e6ab0] bg-[#1e6ab0]/5" : "hover:border-muted-foreground/40"}`}
                    >
                      <Checkbox checked={checked} className="pointer-events-none" />
                      <span className="text-sm">{cat.name}</span>
                    </button>
                  );
                })}
              </div>
              {form.categories.includes("Other") && (
                <Field label="Other — please specify">
                  <Input value={form.categoriesOther} onChange={e => update("categoriesOther", e.target.value)} placeholder="Describe the other category" />
                </Field>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <Field label="Preferred Payment Terms">
                  <Input value={form.paymentTerms} onChange={e => update("paymentTerms", e.target.value)} placeholder="e.g. Net 30" />
                </Field>
                <Field label="Delivery Terms">
                  <Input value={form.deliveryTerms} onChange={e => update("deliveryTerms", e.target.value)} placeholder="e.g. DDP Dubai" />
                </Field>
              </div>
            </div>
          )}

          {/* STEP 4 — Banking */}
          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Banking Details</h2>
              <p className="text-sm text-muted-foreground">For payment processing if your application is approved.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Bank Name">
                  <Input value={form.bankName} onChange={e => update("bankName", e.target.value)} />
                </Field>
                <Field label="Branch">
                  <Input value={form.bankBranch} onChange={e => update("bankBranch", e.target.value)} />
                </Field>
                <Field label="Account Holder Name">
                  <Input value={form.bankAccountName} onChange={e => update("bankAccountName", e.target.value)} />
                </Field>
                <Field label="Account Number">
                  <Input value={form.bankAccountNumber} onChange={e => update("bankAccountNumber", e.target.value)} />
                </Field>
                <Field label="IBAN">
                  <Input value={form.iban} onChange={e => update("iban", e.target.value)} />
                </Field>
                <Field label="SWIFT / BIC">
                  <Input value={form.swift} onChange={e => update("swift", e.target.value)} />
                </Field>
                <Field label="Currency">
                  <Select value={form.currency} onValueChange={v => update("currency", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["AED", "USD", "EUR", "GBP", "SAR", "INR"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </div>
          )}

          {/* STEP 5 — Profile */}
          {step === 5 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Company Profile</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Years in Business">
                  <Input value={form.yearsExperience} onChange={e => update("yearsExperience", e.target.value)} placeholder="e.g. 10" />
                </Field>
                <Field label="Annual Turnover (AED)">
                  <Select value={form.turnoverBand} onValueChange={v => update("turnoverBand", v)}>
                    <SelectTrigger><SelectValue placeholder="Select range" /></SelectTrigger>
                    <SelectContent>
                      {TURNOVER_BANDS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Employees">
                  <Select value={form.employeeBand} onValueChange={v => update("employeeBand", v)}>
                    <SelectTrigger><SelectValue placeholder="Select size" /></SelectTrigger>
                    <SelectContent>
                      {COMPANY_SIZES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="space-y-2">
                <Label>Reference Clients (up to 3)</Label>
                {refClients.map((r, i) => (
                  <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
                    <Input placeholder="Client name" value={r.name} onChange={e => setRef(i, "name", e.target.value)} />
                    <Input placeholder="Contact (name / phone / email)" value={r.contact} onChange={e => setRef(i, "contact", e.target.value)} />
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeRef(i)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                {refClients.length < 3 && (
                  <Button type="button" variant="outline" size="sm" onClick={addRef}>
                    <Plus className="w-3 h-3 mr-1" /> Add reference
                  </Button>
                )}
              </div>

              <Field label="Major Clients (free text, optional)">
                <Textarea value={form.majorClients} onChange={e => update("majorClients", e.target.value)} rows={2} placeholder="List any other notable clients" />
              </Field>
            </div>
          )}

          {/* STEP 6 — Documents */}
          {step === 6 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Supporting Documents</h2>
              <p className="text-sm text-muted-foreground">
                Upload each document into its labelled slot. PDF, JPG or PNG, <strong>5 MB max per file</strong>.
                Items marked <span className="text-red-600 font-semibold">*</span> are required.
              </p>
              <div className="space-y-2.5">
                {DOC_SLOTS.map(slot => {
                  const required = slot.required === true || (slot.required === "vatOnly" && form.vatRegistered);
                  const uploaded = files.find(f => f.documentType === slot.id);
                  const inputId = `doc-${slot.id}`;
                  return (
                    <div key={slot.id} className={`border rounded-lg p-3 ${required && !uploaded ? "border-red-200 bg-red-50/30 dark:bg-red-900/10" : "bg-muted/20"}`}>
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <div className="text-sm font-medium">
                            {slot.label}
                            {required && <span className="text-red-600 ml-1">*</span>}
                          </div>
                          {slot.hint && <div className="text-[11px] text-muted-foreground">{slot.hint}</div>}
                        </div>
                        {uploaded ? (
                          <div className="flex items-center gap-2 min-w-0">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <div className="text-xs truncate max-w-[180px]">{uploaded.filename}</div>
                            <span className="text-[10px] text-muted-foreground">{(uploaded.size / 1024).toFixed(1)} KB</span>
                            <Button type="button" variant="ghost" size="sm" onClick={() => removeSlotFile(slot.id)}>
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <Label htmlFor={inputId} className="cursor-pointer inline-flex items-center gap-1 text-xs text-[#1e6ab0] font-medium border border-[#1e6ab0]/40 rounded-md px-2.5 py-1 hover:bg-[#1e6ab0]/5">
                              <Plus className="w-3.5 h-3.5" /> Upload
                            </Label>
                            <input
                              id={inputId}
                              type="file"
                              className="hidden"
                              accept=".pdf,.jpg,.jpeg,.png"
                              onChange={e => onSlotFileChange(slot.id, e)}
                            />
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 7 — Review & submit */}
          {step === 7 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Review &amp; Submit</h2>
              <ReviewBlock title="Company">
                <ReviewRow k="Applying to" v={companies?.find(c => c.id === form.companyId)?.name ?? "—"} />
                <ReviewRow k="Legal name" v={form.companyName} />
                <ReviewRow k="Trading name" v={form.tradeName || "—"} />
                <ReviewRow k="Trade Licence" v={`${form.tradeLicenseNo}${form.licenseAuthority ? ` (${form.licenseAuthority})` : ""}`} />
                <ReviewRow k="Licence Expiry" v={form.licenseExpiry || "—"} />
                <ReviewRow k="Address" v={[form.poBox && `PO ${form.poBox}`, form.city, form.emirate, form.country].filter(Boolean).join(", ")} />
              </ReviewBlock>
              <ReviewBlock title="Contact">
                <ReviewRow k="Signatory" v={`${form.contactPerson}${form.designation ? ` (${form.designation})` : ""}`} />
                <ReviewRow k="Email / Phone" v={`${form.email} / ${form.phone || "—"}`} />
                <ReviewRow k="Tender contact" v={form.tenderContactName ? `${form.tenderContactName} — ${form.tenderContactEmail || form.tenderContactMobile || "—"}` : "—"} />
                <ReviewRow k="VAT TRN" v={form.vatRegistered ? form.trn || "(missing)" : "Not VAT registered"} />
              </ReviewBlock>
              <ReviewBlock title="Categories">
                <div className="flex flex-wrap gap-1.5">
                  {form.categories.map(c => (
                    <span key={c} className="text-xs bg-[#1e6ab0]/10 text-[#1e6ab0] px-2 py-0.5 rounded-full">{c}</span>
                  ))}
                </div>
                {form.categoriesOther && <div className="text-xs text-muted-foreground mt-1">Other: {form.categoriesOther}</div>}
              </ReviewBlock>
              <ReviewBlock title="Profile">
                <ReviewRow k="Years in business" v={form.yearsExperience || "—"} />
                <ReviewRow k="Turnover" v={form.turnoverBand || "—"} />
                <ReviewRow k="Employees" v={form.employeeBand || "—"} />
                <ReviewRow k="References" v={refClients.filter(r => r.name.trim()).map(r => r.name).join(", ") || "—"} />
              </ReviewBlock>
              <ReviewBlock title="Documents">
                {files.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No documents attached.</div>
                ) : (
                  <ul className="text-sm list-disc pl-5">
                    {files.map((f, i) => <li key={i}>{f.filename}</li>)}
                  </ul>
                )}
              </ReviewBlock>

              <div className="border-t pt-4 space-y-3">
                <label className="flex items-start gap-2 cursor-pointer">
                  <Checkbox checked={form.agreedTerms} onCheckedChange={v => update("agreedTerms", Boolean(v))} className="mt-0.5" />
                  <span className="text-sm text-muted-foreground">
                    I confirm that all information provided is true and accurate, and I authorize{" "}
                    {companies?.find(c => c.id === form.companyId)?.name ?? "the procurement team"} to verify the details with relevant authorities.
                  </span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <Checkbox checked={form.agreedCodeOfConduct} onCheckedChange={v => update("agreedCodeOfConduct", Boolean(v))} className="mt-0.5" />
                  <span className="text-sm text-muted-foreground">
                    I have read and accept the supplier <strong>Code of Conduct</strong> and <strong>Anti-Bribery &amp; Anti-Corruption</strong> policy.
                  </span>
                </label>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t">
            <Button type="button" variant="outline" onClick={back} disabled={step === 1}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            {step < STEPS.length ? (
              <Button type="button" onClick={next} className={primeBtnCls}>
                Continue <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button type="button" onClick={onSubmit} disabled={submit.isPending} className={primeBtnCls}>
                {submit.isPending ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Submitting...</> : "Submit Application"}
              </Button>
            )}
          </div>
        </div>

        <div className="text-center text-xs text-muted-foreground mt-6">
          Need help? Email <a className="underline" href="mailto:procurement@primemax.ae">procurement@primemax.ae</a>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, className = "", children }: { label: string; required?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <div className={`space-y-1 ${className}`}>
      <Label>{label}{required && <span className="text-red-500"> *</span>}</Label>
      {children}
    </div>
  );
}

function ReviewBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border rounded-lg p-3 bg-muted/30">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function ReviewRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <div className="text-muted-foreground w-32 shrink-0">{k}</div>
      <div className="font-medium">{v}</div>
    </div>
  );
}
