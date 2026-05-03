import { useState } from "react";
import {
  useListAuthCompanies,
  useListSupplierCategories,
  useSubmitSupplierRegistration,
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
  Building2, User, Banknote, Tags, Paperclip, FileText,
  CheckCircle2, AlertCircle, Loader2, ArrowRight, ArrowLeft,
} from "lucide-react";

interface UploadedFile {
  filename: string;
  contentType: string;
  content: string; // base64 (no data: prefix)
  size: number;
}

const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-500", "500+"];
const COUNTRIES = [
  "United Arab Emirates", "Saudi Arabia", "Oman", "Qatar", "Kuwait", "Bahrain",
  "India", "Pakistan", "China", "Turkey", "Germany", "United Kingdom", "Other",
];

const STEPS = [
  { id: 1, label: "Company",     icon: Building2 },
  { id: 2, label: "Contact",     icon: User },
  { id: 3, label: "Categories",  icon: Tags },
  { id: 4, label: "Banking",     icon: Banknote },
  { id: 5, label: "Documents",   icon: Paperclip },
  { id: 6, label: "Review",      icon: FileText },
];

export default function SupplierRegisterPage() {
  const { data: companies } = useListAuthCompanies();
  const { data: categories } = useListSupplierCategories();
  const submit = useSubmitSupplierRegistration();

  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState<{ refNumber: string; companyName: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    companyId: 0,
    companyName: "",
    tradeLicenseNo: "",
    licenseExpiry: "",
    establishedYear: "",
    companySize: "",
    country: "United Arab Emirates",
    city: "",
    address: "",
    website: "",
    contactPerson: "",
    designation: "",
    email: "",
    phone: "",
    whatsapp: "",
    trn: "",
    vatRegistered: false,
    chamberMembership: "",
    bankName: "",
    bankAccountName: "",
    bankAccountNumber: "",
    iban: "",
    swift: "",
    currency: "AED",
    categories: [] as string[],
    paymentTerms: "",
    deliveryTerms: "",
    yearsExperience: "",
    majorClients: "",
    agreedTerms: false,
  });
  const [files, setFiles] = useState<UploadedFile[]>([]);

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

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []);
    if (files.length + list.length > 5) {
      setError("Maximum 5 files allowed.");
      return;
    }
    const next: UploadedFile[] = [];
    for (const f of list) {
      if (f.size > 10 * 1024 * 1024) {
        setError(`${f.name} exceeds 10MB limit.`);
        return;
      }
      const buf = await f.arrayBuffer();
      const bin = new Uint8Array(buf);
      let raw = "";
      for (let i = 0; i < bin.byteLength; i++) raw += String.fromCharCode(bin[i]);
      const base64 = btoa(raw);
      next.push({ filename: f.name, contentType: f.type || "application/octet-stream", content: base64, size: f.size });
    }
    setFiles(p => [...p, ...next]);
    setError(null);
    e.target.value = "";
  }

  function removeFile(idx: number) {
    setFiles(p => p.filter((_, i) => i !== idx));
  }

  function validateStep(s: number): string | null {
    if (s === 1) {
      if (!form.companyId) return "Please select the company you are applying to.";
      if (!form.companyName.trim()) return "Company name is required.";
    }
    if (s === 2) {
      if (!form.contactPerson.trim()) return "Contact person is required.";
      if (!form.email.trim() || !form.email.includes("@")) return "A valid email is required.";
    }
    if (s === 3) {
      if (form.categories.length === 0) return "Please select at least one supply category.";
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
    if (!form.agreedTerms) { setError("Please confirm the declaration to submit."); return; }
    for (let s = 1; s <= 3; s++) {
      const err = validateStep(s);
      if (err) { setStep(s); setError(err); return; }
    }
    setError(null);
    try {
      const result = await submit.mutateAsync({
        data: {
          ...form,
          attachments: files.map(f => ({ filename: f.filename, contentType: f.contentType, content: f.content })),
        },
      });
      const co = companies?.find(c => c.id === form.companyId);
      setSubmitted({ refNumber: (result as any).refNumber, companyName: co?.name ?? "Procurement Team" });
    } catch (err: any) {
      setError(err?.error ?? err?.message ?? "Submission failed. Please try again.");
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
      {/* Header */}
      <div className="bg-[#0f2d5a] text-white">
        <div className="max-w-4xl mx-auto px-4 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/15 rounded-xl px-4 py-2 backdrop-blur ring-1 ring-white/20">
              <div className="text-xl font-extrabold tracking-widest leading-none">MA</div>
              <div className="text-[10px] font-bold tracking-[0.3em] text-white/75 mt-0.5">ERP</div>
            </div>
            <div>
              <div className="text-lg font-semibold">Become a Supplier</div>
              <div className="text-xs text-white/70">Prime Max & Elite Prefab — UAE Procurement</div>
            </div>
          </div>
          <a href="/login" className="text-xs text-white/80 hover:text-white underline">Sign in</a>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Stepper */}
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
                <Field label="Company Name" required>
                  <Input value={form.companyName} onChange={e => update("companyName", e.target.value)} />
                </Field>
                <Field label="Trade License No.">
                  <Input value={form.tradeLicenseNo} onChange={e => update("tradeLicenseNo", e.target.value)} />
                </Field>
                <Field label="License Expiry">
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
                <Field label="City">
                  <Input value={form.city} onChange={e => update("city", e.target.value)} />
                </Field>
                <Field label="Address" className="sm:col-span-2">
                  <Textarea value={form.address} onChange={e => update("address", e.target.value)} rows={2} />
                </Field>
              </div>
            </div>
          )}

          {/* STEP 2 — Contact + tax */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Primary Contact & Tax Details</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Contact Person" required>
                  <Input value={form.contactPerson} onChange={e => update("contactPerson", e.target.value)} />
                </Field>
                <Field label="Designation">
                  <Input value={form.designation} onChange={e => update("designation", e.target.value)} />
                </Field>
                <Field label="Email" required>
                  <Input type="email" value={form.email} onChange={e => update("email", e.target.value)} />
                </Field>
                <Field label="Phone">
                  <Input value={form.phone} onChange={e => update("phone", e.target.value)} placeholder="+971 ..." />
                </Field>
                <Field label="WhatsApp">
                  <Input value={form.whatsapp} onChange={e => update("whatsapp", e.target.value)} placeholder="+971 ..." />
                </Field>
                <Field label="TRN (UAE Tax Registration Number)">
                  <Input value={form.trn} onChange={e => update("trn", e.target.value)} />
                </Field>
                <Field label="Chamber of Commerce Membership">
                  <Input value={form.chamberMembership} onChange={e => update("chamberMembership", e.target.value)} placeholder="Membership # / Emirate" />
                </Field>
                <div className="flex items-center gap-2 pt-6">
                  <Checkbox id="vat" checked={form.vatRegistered} onCheckedChange={v => update("vatRegistered", Boolean(v))} />
                  <Label htmlFor="vat" className="cursor-pointer">VAT Registered</Label>
                </div>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <Field label="Years of Experience">
                  <Input value={form.yearsExperience} onChange={e => update("yearsExperience", e.target.value)} placeholder="e.g. 10+ years" />
                </Field>
                <Field label="Preferred Payment Terms">
                  <Input value={form.paymentTerms} onChange={e => update("paymentTerms", e.target.value)} placeholder="e.g. Net 30" />
                </Field>
                <Field label="Delivery Terms">
                  <Input value={form.deliveryTerms} onChange={e => update("deliveryTerms", e.target.value)} placeholder="e.g. DDP Dubai" />
                </Field>
                <Field label="Major Clients" className="sm:col-span-2">
                  <Textarea value={form.majorClients} onChange={e => update("majorClients", e.target.value)} rows={2} placeholder="List a few notable clients (optional)" />
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

          {/* STEP 5 — Documents */}
          {step === 5 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Supporting Documents</h2>
              <p className="text-sm text-muted-foreground">
                Upload trade license, VAT certificate, company profile, bank confirmation letter, etc. Max 5 files, 10MB each.
              </p>
              <div className="border-2 border-dashed rounded-xl p-6 text-center">
                <Paperclip className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <Label htmlFor="files" className="cursor-pointer text-[#1e6ab0] font-medium">
                  Click to upload files
                </Label>
                <input
                  id="files"
                  type="file"
                  multiple
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                  onChange={onFileChange}
                />
                <div className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG, DOC, XLS</div>
              </div>
              {files.length > 0 && (
                <div className="space-y-2">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center justify-between border rounded-lg p-2.5 bg-muted/30">
                      <div className="flex items-center gap-2 min-w-0">
                        <Paperclip className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{f.filename}</div>
                          <div className="text-[11px] text-muted-foreground">{(f.size / 1024).toFixed(1)} KB</div>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeFile(i)}>Remove</Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 6 — Review & submit */}
          {step === 6 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Review & Submit</h2>
              <ReviewBlock title="Company">
                <ReviewRow k="Applying to" v={companies?.find(c => c.id === form.companyId)?.name ?? "—"} />
                <ReviewRow k="Company name" v={form.companyName} />
                <ReviewRow k="Trade License" v={form.tradeLicenseNo || "—"} />
                <ReviewRow k="Country / City" v={`${form.country}${form.city ? ", " + form.city : ""}`} />
              </ReviewBlock>
              <ReviewBlock title="Contact">
                <ReviewRow k="Person" v={`${form.contactPerson}${form.designation ? ` (${form.designation})` : ""}`} />
                <ReviewRow k="Email" v={form.email} />
                <ReviewRow k="Phone / WhatsApp" v={`${form.phone || "—"} / ${form.whatsapp || "—"}`} />
                <ReviewRow k="TRN" v={form.trn || "—"} />
              </ReviewBlock>
              <ReviewBlock title="Categories">
                <div className="flex flex-wrap gap-1.5">
                  {form.categories.map(c => (
                    <span key={c} className="text-xs bg-[#1e6ab0]/10 text-[#1e6ab0] px-2 py-0.5 rounded-full">{c}</span>
                  ))}
                </div>
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

              <div className="border-t pt-4">
                <label className="flex items-start gap-2 cursor-pointer">
                  <Checkbox checked={form.agreedTerms} onCheckedChange={v => update("agreedTerms", Boolean(v))} className="mt-0.5" />
                  <span className="text-sm text-muted-foreground">
                    I confirm that all information provided is true and accurate, and I authorize{" "}
                    {companies?.find(c => c.id === form.companyId)?.name ?? "the procurement team"} to verify the details with relevant authorities.
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Nav buttons */}
          <div className="flex items-center justify-between pt-2 border-t">
            <Button type="button" variant="outline" onClick={back} disabled={step === 1}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            {step < STEPS.length ? (
              <Button type="button" onClick={next} className="bg-[#0f2d5a] hover:bg-[#1e6ab0]">
                Continue <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button type="button" onClick={onSubmit} disabled={submit.isPending} className="bg-[#0f2d5a] hover:bg-[#1e6ab0]">
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
