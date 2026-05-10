import { useEffect, useState, useRef } from "react";
import { useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  User, MapPin, Briefcase, GraduationCap, FileText, Users, CheckSquare,
  ChevronRight, ChevronLeft, Plus, Trash2, Upload, X, CheckCircle, AlertCircle, Clock,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Experience {
  companyName: string; country: string; city: string; designation: string;
  startDate: string; endDate: string; totalDuration: string; reasonForLeaving: string; jobResponsibilities: string;
}
interface Education {
  certificateName: string; instituteName: string; country: string;
  passingYear: string; grade: string; fileData: string; fileName: string;
}
interface Relative {
  relativeName: string; relationship: string; contactNumber: string; country: string; address: string;
}
interface DocUpload {
  documentType: string; documentName: string; fileData: string; fileName: string;
  contentType: string; expiryDate: string;
}
interface FormData {
  // Personal
  fatherName: string; dateOfBirth: string; gender: string; nationality: string; maritalStatus: string;
  mobile: string; email: string; currentAddress: string; permanentAddress: string;
  // Location
  currentCountry: string; currentState: string; currentCity: string;
  homeCountry: string; homeState: string; homeCity: string;
  // Emergency
  emergencyContactName: string; emergencyContactNumber: string; emergencyContactRelationship: string;
  // Employment
  expectedJoiningDate: string; visaStatus: string; uaeDrivingLicense: string;
  totalExperienceYears: string; gulfExperienceYears: string; homeCountryExperienceYears: string;
  previousCompany: string; previousDesignation: string; previousCompanyLocation: string;
  reasonForLeaving: string; skillsCategory: string; salaryExpectation: string;
  // Arrays
  experience: Experience[]; education: Education[]; relatives: Relative[];
}

interface RegistrationData {
  registration: {
    id: number; regCode: string; deptRegCode: string | null; status: string;
    fullName: string; email: string | null; mobile: string | null;
    designation: string | null; departmentName: string | null; joiningType: string | null;
    correctionNotes: string | null; fatherName: string | null; dateOfBirth: string | null;
    gender: string | null; nationality: string | null; maritalStatus: string | null;
    currentAddress: string | null; permanentAddress: string | null;
    currentCountry: string | null; currentState: string | null; currentCity: string | null;
    homeCountry: string | null; homeState: string | null; homeCity: string | null;
    emergencyContactName: string | null; emergencyContactNumber: string | null; emergencyContactRelationship: string | null;
    expectedJoiningDate: string | null; visaStatus: string | null; uaeDrivingLicense: string | null;
    totalExperienceYears: string | null; gulfExperienceYears: string | null; homeCountryExperienceYears: string | null;
    previousCompany: string | null; previousDesignation: string | null; previousCompanyLocation: string | null;
    reasonForLeaving: string | null; skillsCategory: string | null; salaryExpectation: string | null;
  };
  documents: Array<{ id: number; documentType: string; documentName: string; fileData: string | null; fileName: string | null; expiryDate: string | null; status: string }>;
  experience: Experience[];
  education: Education[];
  relatives: Relative[];
  company: { name: string; shortName: string | null } | null;
}

const STEPS = [
  { id: 1, label: "Personal", icon: User },
  { id: 2, label: "Location", icon: MapPin },
  { id: 3, label: "Employment", icon: Briefcase },
  { id: 4, label: "Experience", icon: Briefcase },
  { id: 5, label: "Education", icon: GraduationCap },
  { id: 6, label: "Documents", icon: FileText },
  { id: 7, label: "Emergency", icon: Users },
  { id: 8, label: "Declaration", icon: CheckSquare },
];

const DOC_TYPES = [
  { value: "passport", label: "Passport Copy", required: true },
  { value: "emirates_id", label: "Emirates ID (EID)", required: false },
  { value: "visa_copy", label: "Visa Copy", required: false },
  { value: "national_id", label: "National ID / Country ID", required: true },
  { value: "academic_certificate", label: "Academic Certificate / Degree", required: false },
  { value: "cv_resume", label: "CV / Resume", required: true },
  { value: "passport_photo", label: "Passport-size Photo", required: true },
  { value: "experience_certificate", label: "Experience Certificate", required: false },
  { value: "labour_card", label: "Labour Card", required: false },
  { value: "work_permit", label: "Work Permit", required: false },
  { value: "medical_fitness", label: "Medical Fitness Certificate", required: false },
  { value: "police_clearance", label: "Police Clearance Certificate", required: false },
  { value: "uae_driving_license", label: "UAE Driving License", required: false },
  { value: "home_country_driving_license", label: "Home Country Driving License", required: false },
  { value: "health_insurance", label: "Health Insurance Card", required: false },
  { value: "labour_contract", label: "Labour Contract", required: false },
  { value: "other", label: "Other Document", required: false },
];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-sm">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</Label>
      {children}
    </div>
  );
}

function emptyExp(): Experience {
  return { companyName: "", country: "", city: "", designation: "", startDate: "", endDate: "", totalDuration: "", reasonForLeaving: "", jobResponsibilities: "" };
}
function emptyEdu(): Education {
  return { certificateName: "", instituteName: "", country: "", passingYear: "", grade: "", fileData: "", fileName: "" };
}
function emptyRel(): Relative {
  return { relativeName: "", relationship: "", contactNumber: "", country: "", address: "" };
}

export default function EmployeeRegisterPage() {
  const [, params] = useRoute("/employee-register/:token");
  const token = params?.token ?? "";

  const [regData, setRegData] = useState<RegistrationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [docUploading, setDocUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const eduFileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormData>({
    fatherName: "", dateOfBirth: "", gender: "", nationality: "", maritalStatus: "",
    mobile: "", email: "", currentAddress: "", permanentAddress: "",
    currentCountry: "", currentState: "", currentCity: "",
    homeCountry: "", homeState: "", homeCity: "",
    emergencyContactName: "", emergencyContactNumber: "", emergencyContactRelationship: "",
    expectedJoiningDate: "", visaStatus: "", uaeDrivingLicense: "",
    totalExperienceYears: "", gulfExperienceYears: "", homeCountryExperienceYears: "",
    previousCompany: "", previousDesignation: "", previousCompanyLocation: "",
    reasonForLeaving: "", skillsCategory: "", salaryExpectation: "",
    experience: [emptyExp()], education: [emptyEdu()], relatives: [emptyRel()],
  });

  const [docs, setDocs] = useState<DocUpload[]>([]);
  const [newDoc, setNewDoc] = useState<Omit<DocUpload, "fileData" | "fileName" | "contentType">>({ documentType: "", documentName: "", expiryDate: "" });

  // Fetch registration data
  useEffect(() => {
    if (!token) return;
    fetch(`/api/employee-register/${token}`)
      .then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(e.error ?? "Invalid link")))
      .then((d: RegistrationData) => {
        setRegData(d);
        // Prefill form with existing data
        const r = d.registration;
        setForm(prev => ({
          ...prev,
          fatherName: r.fatherName ?? "", dateOfBirth: r.dateOfBirth ?? "",
          gender: r.gender ?? "", nationality: r.nationality ?? "", maritalStatus: r.maritalStatus ?? "",
          mobile: r.mobile ?? "", email: r.email ?? "",
          currentAddress: r.currentAddress ?? "", permanentAddress: r.permanentAddress ?? "",
          currentCountry: r.currentCountry ?? "", currentState: r.currentState ?? "", currentCity: r.currentCity ?? "",
          homeCountry: r.homeCountry ?? "", homeState: r.homeState ?? "", homeCity: r.homeCity ?? "",
          emergencyContactName: r.emergencyContactName ?? "", emergencyContactNumber: r.emergencyContactNumber ?? "",
          emergencyContactRelationship: r.emergencyContactRelationship ?? "",
          expectedJoiningDate: r.expectedJoiningDate ?? "", visaStatus: r.visaStatus ?? "",
          uaeDrivingLicense: r.uaeDrivingLicense ?? "",
          totalExperienceYears: r.totalExperienceYears ?? "", gulfExperienceYears: r.gulfExperienceYears ?? "",
          homeCountryExperienceYears: r.homeCountryExperienceYears ?? "",
          previousCompany: r.previousCompany ?? "", previousDesignation: r.previousDesignation ?? "",
          previousCompanyLocation: r.previousCompanyLocation ?? "", reasonForLeaving: r.reasonForLeaving ?? "",
          skillsCategory: r.skillsCategory ?? "", salaryExpectation: r.salaryExpectation ?? "",
          experience: d.experience.length > 0 ? d.experience : [emptyExp()],
          education: d.education.length > 0 ? d.education : [emptyEdu()],
          relatives: d.relatives.length > 0 ? d.relatives : [emptyRel()],
        }));
        if (r.status === "submitted" || r.status === "under_review" || r.status === "approved" || r.status === "rejected") {
          setSubmitted(true);
        }
        setLoading(false);
      })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, [token]);

  const f = (key: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [key]: e.target.value }));
  const sel = (key: keyof FormData) => (v: string) => setForm(p => ({ ...p, [key]: v }));

  async function autoSave() {
    setSaving(true);
    setSaveMsg("");
    try {
      const res = await fetch(`/api/employee-register/${token}/save`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) { setSaveMsg("Progress saved"); setTimeout(() => setSaveMsg(""), 3000); }
    } finally { setSaving(false); }
  }

  async function uploadDocument(file: File) {
    if (!newDoc.documentType || !newDoc.documentName) {
      alert("Please select document type and enter a name before uploading."); return;
    }
    setDocUploading(true);
    try {
      const fileData = await fileToBase64(file);
      const res = await fetch(`/api/employee-register/${token}/documents`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentType: newDoc.documentType, documentName: newDoc.documentName, fileData, fileName: file.name, contentType: file.type, expiryDate: newDoc.expiryDate }),
      });
      if (res.ok) {
        // Refresh docs list
        const updated = await fetch(`/api/employee-register/${token}`).then(r => r.json());
        setRegData(updated);
        setDocs(d => [...d, { ...newDoc, fileData, fileName: file.name, contentType: file.type }]);
        setNewDoc({ documentType: "", documentName: "", expiryDate: "" });
      }
    } finally { setDocUploading(false); }
  }

  async function removeDoc(docId: number) {
    await fetch(`/api/employee-register/${token}/documents/${docId}`, { method: "DELETE" });
    const updated = await fetch(`/api/employee-register/${token}`).then(r => r.json());
    setRegData(updated);
  }

  async function handleSubmit() {
    if (!agreed) { alert("Please confirm the declaration before submitting."); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/employee-register/${token}/submit`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) setSubmitted(true);
      else { const e = await res.json(); alert(e.error ?? "Submission failed"); }
    } finally { setSubmitting(false); }
  }

  // ─── Loading / Error states ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-gray-800 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-600">Loading your registration form…</p>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="p-8 space-y-3">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
            <h2 className="text-lg font-bold">Invalid Registration Link</h2>
            <p className="text-sm text-gray-600">{error}</p>
            <p className="text-xs text-gray-400">Please contact HR for a valid registration link.</p>
          </CardContent>
        </Card>
      </div>
    );
  }
  if (!regData) return null;

  const reg = regData.registration;
  const isLocked = submitted || ["approved", "rejected"].includes(reg.status);
  const companyName = regData.company?.name ?? "Prime Max ERP";

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-[#1a0a0a] flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center shadow-2xl">
          <CardContent className="p-10 space-y-4">
            <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto" />
            <h2 className="text-2xl font-bold">Registration Submitted!</h2>
            <p className="text-muted-foreground">Thank you, <strong>{reg.fullName}</strong>. Your registration has been submitted successfully.</p>
            <div className="bg-muted rounded-lg p-4 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Employee ID</span><code className="font-mono font-bold">{reg.regCode}</code></div>
              {reg.deptRegCode && <div className="flex justify-between"><span className="text-muted-foreground">Dept. ID</span><code className="font-mono">{reg.deptRegCode}</code></div>}
              <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge className="bg-purple-100 text-purple-800 text-[11px]">Under Review</Badge></div>
            </div>
            <p className="text-xs text-muted-foreground">HR will review your application and contact you within 3–5 working days.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900 to-[#3a0a0a] text-white py-5 px-4 shadow-lg">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">{companyName}</p>
              <h1 className="text-lg font-bold mt-0.5">Employee Registration</h1>
              <p className="text-xs text-gray-400 mt-0.5">Complete your registration to join our team</p>
            </div>
            <div className="text-right">
              <code className="text-sm font-mono font-bold text-amber-300">{reg.regCode}</code>
              {reg.deptRegCode && <p className="text-[11px] text-gray-400 font-mono">{reg.deptRegCode}</p>}
            </div>
          </div>
          {/* Welcome banner */}
          <div className="mt-3 bg-white/10 rounded-lg px-3 py-2 text-sm">
            Welcome, <strong>{reg.fullName}</strong>
            {reg.designation && <span className="text-gray-300"> · {reg.designation}</span>}
            {reg.departmentName && <span className="text-gray-300"> · {reg.departmentName}</span>}
          </div>
          {reg.correctionNotes && (
            <div className="mt-2 bg-amber-500/20 border border-amber-500/40 rounded-lg px-3 py-2 text-xs text-amber-200">
              <strong>Correction Required:</strong> {reg.correctionNotes}
            </div>
          )}
        </div>
      </div>

      {/* Progress stepper */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-2 overflow-x-auto">
          <div className="flex items-center gap-1 min-w-max">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const isActive = step === s.id;
              const isDone = step > s.id;
              return (
                <div key={s.id} className="flex items-center">
                  <button
                    onClick={() => { autoSave(); setStep(s.id); }}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all ${isActive ? "bg-gray-900 text-white" : isDone ? "bg-emerald-100 text-emerald-700" : "text-gray-500 hover:text-gray-700"}`}
                  >
                    {isDone ? <CheckCircle className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">{s.label}</span>
                  </button>
                  {i < STEPS.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-gray-300 mx-0.5" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Form content */}
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {saveMsg && <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 rounded px-3 py-2"><CheckCircle className="w-4 h-4" />{saveMsg}</div>}

        {/* Step 1: Personal */}
        {step === 1 && (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><User className="w-5 h-5" />Personal Information</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Full Name"><Input value={reg.fullName} disabled className="bg-muted" /></Field>
              <Field label="Father's Name"><Input value={form.fatherName} onChange={f("fatherName")} placeholder="Father's full name" /></Field>
              <Field label="Date of Birth"><Input type="date" value={form.dateOfBirth} onChange={f("dateOfBirth")} /></Field>
              <Field label="Gender">
                <Select value={form.gender} onValueChange={sel("gender")}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent>
                </Select>
              </Field>
              <Field label="Nationality"><Input value={form.nationality} onChange={f("nationality")} placeholder="e.g. Pakistani" /></Field>
              <Field label="Marital Status">
                <Select value={form.maritalStatus} onValueChange={sel("maritalStatus")}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent><SelectItem value="single">Single</SelectItem><SelectItem value="married">Married</SelectItem><SelectItem value="divorced">Divorced</SelectItem><SelectItem value="widowed">Widowed</SelectItem></SelectContent>
                </Select>
              </Field>
              <Field label="Mobile Number" required><Input value={form.mobile} onChange={f("mobile")} placeholder="+971 50 xxx xxxx" /></Field>
              <Field label="Email Address" required><Input type="email" value={form.email} onChange={f("email")} placeholder="your@email.com" /></Field>
              <div className="col-span-2"><Field label="Current Address"><Textarea rows={2} value={form.currentAddress} onChange={f("currentAddress")} placeholder="Full current address" /></Field></div>
              <div className="col-span-2"><Field label="Permanent Home Country Address"><Textarea rows={2} value={form.permanentAddress} onChange={f("permanentAddress")} placeholder="Permanent home country address" /></Field></div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Location */}
        {step === 2 && (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="w-5 h-5" />Location Information</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div>
                <p className="text-sm font-semibold text-muted-foreground mb-3">Current Location (UAE / Work Country)</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Field label="Country"><Input value={form.currentCountry} onChange={f("currentCountry")} placeholder="e.g. UAE" /></Field>
                  <Field label="Emirate / State"><Input value={form.currentState} onChange={f("currentState")} placeholder="e.g. Dubai" /></Field>
                  <Field label="City"><Input value={form.currentCity} onChange={f("currentCity")} placeholder="e.g. Dubai" /></Field>
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-muted-foreground mb-3">Home Country</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Field label="Country"><Input value={form.homeCountry} onChange={f("homeCountry")} placeholder="e.g. Pakistan" /></Field>
                  <Field label="State / Province"><Input value={form.homeState} onChange={f("homeState")} placeholder="Province" /></Field>
                  <Field label="City"><Input value={form.homeCity} onChange={f("homeCity")} placeholder="City" /></Field>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Employment */}
        {step === 3 && (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Briefcase className="w-5 h-5" />Employment Information</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Designation / Position"><Input value={reg.designation ?? ""} disabled className="bg-muted" /></Field>
              <Field label="Department"><Input value={reg.departmentName ?? "—"} disabled className="bg-muted" /></Field>
              <Field label="Expected Joining Date"><Input type="date" value={form.expectedJoiningDate} onChange={f("expectedJoiningDate")} /></Field>
              <Field label="Visa Status">
                <Select value={form.visaStatus} onValueChange={sel("visaStatus")}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employment_visa">Employment Visa</SelectItem>
                    <SelectItem value="visit_visa">Visit Visa</SelectItem>
                    <SelectItem value="tourist_visa">Tourist Visa</SelectItem>
                    <SelectItem value="residence_visa">Residence Visa</SelectItem>
                    <SelectItem value="no_visa">No Visa / Outside UAE</SelectItem>
                    <SelectItem value="cancelled">Visa Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="UAE Driving License">
                <Select value={form.uaeDrivingLicense} onValueChange={sel("uaeDrivingLicense")}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent><SelectItem value="yes">Yes — Valid</SelectItem><SelectItem value="expired">Yes — Expired</SelectItem><SelectItem value="no">No</SelectItem></SelectContent>
                </Select>
              </Field>
              <Field label="Skills / Trade Category"><Input value={form.skillsCategory} onChange={f("skillsCategory")} placeholder="e.g. Welding, Electrical, Admin" /></Field>
              <Field label="Salary Expectation (AED)"><Input value={form.salaryExpectation} onChange={f("salaryExpectation")} placeholder="e.g. 3500 AED/month" /></Field>
              <Field label="Total Years of Experience"><Input type="number" value={form.totalExperienceYears} onChange={f("totalExperienceYears")} placeholder="Years" /></Field>
              <Field label="Gulf / UAE / GCC Experience (yrs)"><Input type="number" value={form.gulfExperienceYears} onChange={f("gulfExperienceYears")} placeholder="Years" /></Field>
              <Field label="Home Country Experience (yrs)"><Input type="number" value={form.homeCountryExperienceYears} onChange={f("homeCountryExperienceYears")} placeholder="Years" /></Field>
              <Field label="Previous Company"><Input value={form.previousCompany} onChange={f("previousCompany")} placeholder="Company name" /></Field>
              <Field label="Previous Designation"><Input value={form.previousDesignation} onChange={f("previousDesignation")} placeholder="Job title" /></Field>
              <Field label="Previous Company Location"><Input value={form.previousCompanyLocation} onChange={f("previousCompanyLocation")} placeholder="City, Country" /></Field>
              <div className="col-span-2"><Field label="Reason for Leaving Previous Company"><Textarea rows={2} value={form.reasonForLeaving} onChange={f("reasonForLeaving")} /></Field></div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Experience */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2"><Briefcase className="w-5 h-5" />Work Experience</h2>
              <Button variant="outline" size="sm" onClick={() => setForm(p => ({ ...p, experience: [...p.experience, emptyExp()] }))}>
                <Plus className="w-4 h-4 mr-1" />Add
              </Button>
            </div>
            {form.experience.map((exp, i) => (
              <Card key={i}>
                <CardHeader className="pb-2 flex-row justify-between items-center">
                  <CardTitle className="text-sm">Experience #{i + 1}</CardTitle>
                  {form.experience.length > 1 && (
                    <Button variant="ghost" size="sm" className="text-destructive h-7 w-7 p-0" onClick={() => setForm(p => ({ ...p, experience: p.experience.filter((_, j) => j !== i) }))}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { key: "companyName", label: "Company Name", req: true, ph: "Company name" },
                    { key: "designation", label: "Designation", ph: "Job title" },
                    { key: "country", label: "Country", ph: "Country" },
                    { key: "city", label: "City", ph: "City" },
                    { key: "startDate", label: "Start Date", type: "date" },
                    { key: "endDate", label: "End Date", type: "date" },
                    { key: "totalDuration", label: "Total Duration", ph: "e.g. 2 years 3 months" },
                    { key: "reasonForLeaving", label: "Reason for Leaving", ph: "Reason" },
                  ].map(({ key, label, ph, req, type }) => (
                    <Field key={key} label={label} required={req}>
                      <Input type={type ?? "text"} value={(exp as unknown as Record<string, string>)[key]} placeholder={ph}
                        onChange={e => setForm(p => ({ ...p, experience: p.experience.map((x, j) => j === i ? { ...x, [key]: e.target.value } : x) }))} />
                    </Field>
                  ))}
                  <div className="col-span-2">
                    <Field label="Job Responsibilities">
                      <Textarea rows={2} value={exp.jobResponsibilities} placeholder="Describe key responsibilities…"
                        onChange={e => setForm(p => ({ ...p, experience: p.experience.map((x, j) => j === i ? { ...x, jobResponsibilities: e.target.value } : x) }))} />
                    </Field>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Step 5: Education */}
        {step === 5 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2"><GraduationCap className="w-5 h-5" />Education & Academic Details</h2>
              <Button variant="outline" size="sm" onClick={() => setForm(p => ({ ...p, education: [...p.education, emptyEdu()] }))}>
                <Plus className="w-4 h-4 mr-1" />Add
              </Button>
            </div>
            {form.education.map((edu, i) => (
              <Card key={i}>
                <CardHeader className="pb-2 flex-row justify-between items-center">
                  <CardTitle className="text-sm">Education #{i + 1}</CardTitle>
                  {form.education.length > 1 && (
                    <Button variant="ghost" size="sm" className="text-destructive h-7 w-7 p-0" onClick={() => setForm(p => ({ ...p, education: p.education.filter((_, j) => j !== i) }))}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { key: "certificateName", label: "Certificate / Degree", req: true, ph: "e.g. Bachelor of Engineering" },
                    { key: "instituteName", label: "Institute / University", ph: "Institute name" },
                    { key: "country", label: "Country", ph: "Country" },
                    { key: "passingYear", label: "Passing Year", ph: "e.g. 2018" },
                    { key: "grade", label: "Grade / Percentage", ph: "e.g. 75% or B+" },
                  ].map(({ key, label, ph, req }) => (
                    <Field key={key} label={label} required={req}>
                      <Input value={(edu as unknown as Record<string, string>)[key]} placeholder={ph}
                        onChange={e => setForm(p => ({ ...p, education: p.education.map((x, j) => j === i ? { ...x, [key]: e.target.value } : x) }))} />
                    </Field>
                  ))}
                  <div>
                    <Label className="text-sm">Certificate Upload (optional)</Label>
                    <div className="mt-1">
                      {edu.fileData ? (
                        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded px-3 py-2">
                          <CheckCircle className="w-4 h-4" />{edu.fileName}
                          <button className="ml-auto" onClick={() => setForm(p => ({ ...p, education: p.education.map((x, j) => j === i ? { ...x, fileData: "", fileName: "" } : x) }))}>
                            <X className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                        </div>
                      ) : (
                        <label className="flex items-center gap-2 border-2 border-dashed border-gray-300 rounded-lg px-3 py-2 cursor-pointer hover:border-gray-400 text-sm text-muted-foreground">
                          <Upload className="w-4 h-4" />Upload certificate
                          <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                            onChange={async e => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const fd = await fileToBase64(file);
                              setForm(p => ({ ...p, education: p.education.map((x, j) => j === i ? { ...x, fileData: fd, fileName: file.name } : x) }));
                            }} />
                        </label>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Step 6: Documents */}
        {step === 6 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2"><FileText className="w-5 h-5" />Document Uploads</h2>
              <p className="text-sm text-muted-foreground mt-1">Upload all required and available documents. Supported: PDF, JPG, JPEG, PNG (max 8 MB each).</p>
            </div>

            {/* Required doc checklist */}
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="p-4">
                <p className="text-sm font-semibold text-amber-800 mb-2">Required Documents</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {DOC_TYPES.filter(d => d.required).map(dt => {
                    const uploaded = regData.documents.some(d => d.documentType === dt.value);
                    return (
                      <div key={dt.value} className={`flex items-center gap-2 text-xs rounded px-2 py-1 ${uploaded ? "bg-emerald-100 text-emerald-700" : "bg-white text-amber-700 border border-amber-200"}`}>
                        {uploaded ? <CheckCircle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                        {dt.label}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Uploaded docs */}
            {regData.documents.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Uploaded Documents ({regData.documents.length})</p>
                {regData.documents.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between bg-white border rounded-lg px-3 py-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{doc.documentName}</span>
                        <Badge className={`text-[10px] border-0 ${doc.status === "verified" ? "bg-emerald-100 text-emerald-700" : doc.status === "rejected" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
                          {doc.status}
                        </Badge>
                      </div>
                      {doc.expiryDate && <p className="text-xs text-muted-foreground">Expires: {doc.expiryDate}</p>}
                    </div>
                    {!isLocked && (
                      <button onClick={() => removeDoc(doc.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Upload new doc */}
            {!isLocked && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Upload New Document</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Document Type" required>
                      <Select value={newDoc.documentType} onValueChange={v => {
                        const found = DOC_TYPES.find(d => d.value === v);
                        setNewDoc(p => ({ ...p, documentType: v, documentName: found?.label ?? p.documentName }));
                      }}>
                        <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                        <SelectContent>{DOC_TYPES.map(d => <SelectItem key={d.value} value={d.value}>{d.label}{d.required ? " *" : ""}</SelectItem>)}</SelectContent>
                      </Select>
                    </Field>
                    <Field label="Document Name" required>
                      <Input value={newDoc.documentName} onChange={e => setNewDoc(p => ({ ...p, documentName: e.target.value }))} placeholder="e.g. Passport - Muhammad Ali" />
                    </Field>
                    <Field label="Expiry Date (if applicable)">
                      <Input type="date" value={newDoc.expiryDate} onChange={e => setNewDoc(p => ({ ...p, expiryDate: e.target.value }))} />
                    </Field>
                  </div>
                  <label className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl py-8 cursor-pointer transition-colors ${docUploading ? "border-gray-300 bg-gray-50" : "border-gray-300 hover:border-gray-500 bg-white"}`}>
                    {docUploading ? (
                      <div className="flex flex-col items-center gap-2"><div className="w-6 h-6 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" /><p className="text-sm text-muted-foreground">Uploading…</p></div>
                    ) : (
                      <div className="flex flex-col items-center gap-2"><Upload className="w-8 h-8 text-gray-400" /><p className="text-sm text-muted-foreground">Click to select file (PDF, JPG, PNG — max 8 MB)</p></div>
                    )}
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" disabled={docUploading}
                      onChange={async e => { const file = e.target.files?.[0]; if (file) await uploadDocument(file); e.target.value = ""; }} />
                  </label>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Step 7: Emergency / Relatives */}
        {step === 7 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2"><Users className="w-5 h-5" />Emergency Contact & Relatives</h2>
              <Button variant="outline" size="sm" onClick={() => setForm(p => ({ ...p, relatives: [...p.relatives, emptyRel()] }))}>
                <Plus className="w-4 h-4 mr-1" />Add
              </Button>
            </div>
            {form.relatives.map((rel, i) => (
              <Card key={i}>
                <CardHeader className="pb-2 flex-row justify-between items-center">
                  <CardTitle className="text-sm">Contact #{i + 1}</CardTitle>
                  {form.relatives.length > 1 && (
                    <Button variant="ghost" size="sm" className="text-destructive h-7 w-7 p-0" onClick={() => setForm(p => ({ ...p, relatives: p.relatives.filter((_, j) => j !== i) }))}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { key: "relativeName", label: "Full Name", req: true, ph: "Name" },
                    { key: "relationship", label: "Relationship", ph: "e.g. Father, Spouse, Brother" },
                    { key: "contactNumber", label: "Contact Number", ph: "+country code…" },
                    { key: "country", label: "Country", ph: "Country" },
                  ].map(({ key, label, ph, req }) => (
                    <Field key={key} label={label} required={req}>
                      <Input value={(rel as unknown as Record<string, string>)[key]} placeholder={ph}
                        onChange={e => setForm(p => ({ ...p, relatives: p.relatives.map((x, j) => j === i ? { ...x, [key]: e.target.value } : x) }))} />
                    </Field>
                  ))}
                  <div className="col-span-2">
                    <Field label="Address">
                      <Textarea rows={2} value={rel.address} placeholder="Full address"
                        onChange={e => setForm(p => ({ ...p, relatives: p.relatives.map((x, j) => j === i ? { ...x, address: e.target.value } : x) }))} />
                    </Field>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Step 8: Declaration */}
        {step === 8 && (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><CheckSquare className="w-5 h-5" />Final Declaration</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div className="bg-gray-50 border rounded-lg p-4 text-sm text-gray-700 leading-relaxed">
                <p className="font-semibold mb-3">Declaration Statement</p>
                <p>I hereby confirm that the information and documents provided in this registration form are true, correct, and complete to the best of my knowledge and belief. I understand that:</p>
                <ul className="list-disc list-inside mt-3 space-y-1 text-sm text-gray-600">
                  <li>Any false, misleading, or inaccurate information provided may result in rejection of my employment registration or termination of employment if already commenced.</li>
                  <li>I am required to submit original documents upon request for verification.</li>
                  <li>I consent to the company verifying the information and documents provided with relevant authorities and institutions.</li>
                  <li>I am aware of and agree to comply with UAE labour laws and the company's employment policies.</li>
                </ul>
              </div>
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="mt-0.5 w-4 h-4 accent-gray-900" />
                <span className="text-sm font-medium">I agree and confirm that all information and documents provided are true and correct. I understand that any false information or invalid document may result in rejection of my employment registration.</span>
              </label>
              {/* Summary of what was filled */}
              <div className="bg-muted rounded-lg p-4 text-sm space-y-1">
                <p className="font-semibold mb-2">Registration Summary</p>
                <div className="grid grid-cols-2 gap-1">
                  <div className="text-muted-foreground">Full Name</div><div className="font-medium">{reg.fullName}</div>
                  <div className="text-muted-foreground">Employee ID</div><div className="font-mono font-bold">{reg.regCode}</div>
                  <div className="text-muted-foreground">Designation</div><div>{reg.designation ?? "—"}</div>
                  <div className="text-muted-foreground">Department</div><div>{reg.departmentName ?? "—"}</div>
                  <div className="text-muted-foreground">Documents</div><div>{regData.documents.length} uploaded</div>
                  <div className="text-muted-foreground">Experience</div><div>{form.experience.filter(e => e.companyName).length} records</div>
                  <div className="text-muted-foreground">Education</div><div>{form.education.filter(e => e.certificateName).length} records</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2">
          <Button variant="outline" onClick={() => { if (step > 1) { autoSave(); setStep(s => s - 1); } }} disabled={step === 1}>
            <ChevronLeft className="w-4 h-4 mr-1" />Previous
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={autoSave} disabled={saving}>
              {saving ? <Clock className="w-4 h-4 animate-spin mr-1" /> : null}
              {saving ? "Saving…" : "Save Progress"}
            </Button>
            {step < 8 ? (
              <Button className="bg-gray-900 hover:bg-gray-700 text-white" onClick={() => { autoSave(); setStep(s => s + 1); }}>
                Next<ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button
                className="bg-emerald-700 hover:bg-emerald-800 text-white px-6"
                disabled={!agreed || submitting}
                onClick={handleSubmit}
              >
                {submitting ? "Submitting…" : "Submit Registration"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-900 text-gray-400 text-center text-xs py-4 mt-8">
        {companyName} · Employee Registration Portal · All data is handled securely and confidentially.
      </div>
    </div>
  );
}
