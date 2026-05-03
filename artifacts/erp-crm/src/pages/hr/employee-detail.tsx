import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import {
  useGetEmployee, useUpdateEmployee,
  useListEmployeeAttachments, useCreateEmployeeAttachment, useDeleteEmployeeAttachment,
  useListOfferLetters,
  getGetEmployeeQueryKey, getListEmployeeAttachmentsQueryKey, getListOfferLettersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Pencil, Save, X, Upload, Trash2, FileText, AlertTriangle, FileImage, User } from "lucide-react";
import { uploadFile } from "@/lib/upload";

interface Props { id: string }

const ATTACHMENT_CATEGORIES = [
  "passport", "visa", "emirates_id", "photo", "degree_certificate",
  "experience_certificate", "labour_card", "offer_letter_signed", "other",
] as const;

function expiryClass(dateStr?: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const days = Math.ceil((d.getTime() - Date.now()) / 86_400_000);
  if (days < 0) return "text-red-600 font-semibold";
  if (days <= 60) return "text-orange-600 font-semibold";
  return "";
}

export function EmployeeDetail({ id }: Props) {
  const empId = parseInt(id, 10);
  const qc = useQueryClient();
  const { data: emp, isLoading } = useGetEmployee(empId, { query: { queryKey: getGetEmployeeQueryKey(empId), enabled: !!empId } });
  const { data: attachments } = useListEmployeeAttachments(empId, { query: { queryKey: getListEmployeeAttachmentsQueryKey(empId), enabled: !!empId } });
  const { data: offers } = useListOfferLetters({ employeeId: empId }, { query: { queryKey: getListOfferLettersQueryKey({ employeeId: empId }), enabled: !!empId } });

  const update = useUpdateEmployee({ mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getGetEmployeeQueryKey(empId) }) } });
  const createAttachment = useCreateEmployeeAttachment({ mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getListEmployeeAttachmentsQueryKey(empId) }) } });
  const deleteAttachment = useDeleteEmployeeAttachment({ mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getListEmployeeAttachmentsQueryKey(empId) }) } });

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<any>({});
  useEffect(() => {
    if (emp && !editing) {
      setDraft({
        designation: emp.designation ?? "", phone: emp.phone ?? "", email: emp.email ?? "",
        nationality: emp.nationality ?? "", siteLocation: emp.siteLocation ?? "", joiningDate: emp.joiningDate ?? "",
        passportNo: (emp as any).passportNo ?? "", passportExpiry: (emp as any).passportExpiry ?? "",
        emiratesIdNo: (emp as any).emiratesIdNo ?? "", emiratesIdExpiry: (emp as any).emiratesIdExpiry ?? "",
        dateOfBirth: (emp as any).dateOfBirth ?? "", gender: (emp as any).gender ?? "",
        maritalStatus: (emp as any).maritalStatus ?? "", homeAddress: (emp as any).homeAddress ?? "",
        personalEmail: (emp as any).personalEmail ?? "", personalPhone: (emp as any).personalPhone ?? "",
        emergencyContactName: (emp as any).emergencyContactName ?? "", emergencyContactPhone: (emp as any).emergencyContactPhone ?? "",
        basicSalary: (emp as any).basicSalary ?? "", allowances: (emp as any).allowances ?? "",
      });
    }
  }, [emp, editing]);

  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingCategory, setPendingCategory] = useState<string>("passport");
  const [uploading, setUploading] = useState(false);

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading…</div>;
  if (!emp) return <div className="p-8 text-muted-foreground">Employee not found.</div>;

  const save = () => {
    const patch: any = { ...draft };
    // Strip Select sentinel placeholders before persisting.
    for (const k of Object.keys(patch)) {
      if (patch[k] === "__none__") patch[k] = null;
    }
    if (patch.basicSalary === "" || patch.basicSalary == null) patch.basicSalary = null; else patch.basicSalary = Number(patch.basicSalary);
    if (patch.allowances === "" || patch.allowances == null) patch.allowances = null; else patch.allowances = Number(patch.allowances);
    update.mutate({ id: empId, data: { ...patch, name: emp.name, type: emp.type, companyId: emp.companyId } as any });
    setEditing(false);
  };

  const handlePhotoUpload = async (file: File) => {
    setUploading(true);
    try {
      const r = await uploadFile(file);
      update.mutate({ id: empId, data: { name: emp.name, type: emp.type, companyId: emp.companyId, photoObjectKey: r.objectKey } as any });
    } finally { setUploading(false); }
  };

  const handleAttachmentUpload = async (file: File) => {
    setUploading(true);
    try {
      const r = await uploadFile(file);
      await createAttachment.mutateAsync({
        id: empId,
        data: { category: pendingCategory, fileName: r.fileName, objectKey: r.objectKey, contentType: r.contentType, sizeBytes: r.sizeBytes },
      });
    } finally { setUploading(false); }
  };

  const photoUrl = (emp as any).photoSignedUrl as string | undefined;
  const expiringDocsCount = [
    (emp as any).passportExpiry, (emp as any).emiratesIdExpiry,
  ].filter(d => {
    if (!d) return false;
    const days = Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000);
    return days <= 60;
  }).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild><Link href="/hr/employees"><ArrowLeft className="w-4 h-4 mr-1" />Back</Link></Button>
        <div className="flex items-center gap-3 flex-1">
          <div className="relative w-14 h-14 rounded-full overflow-hidden bg-muted flex items-center justify-center shrink-0">
            {photoUrl ? <img src={photoUrl} alt={emp.name} className="w-full h-full object-cover" /> : <User className="w-6 h-6 text-muted-foreground" />}
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-employee-name">{emp.name}</h1>
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <span className="font-mono">{emp.employeeId}</span>
              <Badge variant="secondary" className={emp.type === "staff" ? "bg-blue-100 text-blue-800" : "bg-orange-100 text-orange-800"}>{emp.type}</Badge>
              {emp.designation ? <span>· {emp.designation}</span> : null}
              {expiringDocsCount > 0 && <Badge className="bg-orange-100 text-orange-800"><AlertTriangle className="w-3 h-3 mr-1" />{expiringDocsCount} doc{expiringDocsCount === 1 ? "" : "s"} expiring</Badge>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handlePhotoUpload(e.target.files[0])} />
          <Button variant="outline" size="sm" onClick={() => photoInputRef.current?.click()} disabled={uploading} data-testid="button-upload-photo">
            <FileImage className="w-4 h-4 mr-1" />{photoUrl ? "Change Photo" : "Upload Photo"}
          </Button>
          {!editing ? (
            <Button size="sm" onClick={() => setEditing(true)} className="bg-[#0f2d5a] hover:bg-[#1e6ab0]" data-testid="button-edit-employee"><Pencil className="w-4 h-4 mr-1" />Edit</Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}><X className="w-4 h-4 mr-1" />Cancel</Button>
              <Button size="sm" onClick={save} className="bg-[#0f2d5a] hover:bg-[#1e6ab0]" data-testid="button-save-employee"><Save className="w-4 h-4 mr-1" />Save</Button>
            </>
          )}
        </div>
      </div>

      <Tabs defaultValue="personal">
        <TabsList>
          <TabsTrigger value="personal" data-testid="tab-personal">Personal</TabsTrigger>
          <TabsTrigger value="documents" data-testid="tab-documents">Documents{attachments?.length ? ` (${attachments.length})` : ""}</TabsTrigger>
          <TabsTrigger value="employment" data-testid="tab-employment">Employment</TabsTrigger>
          <TabsTrigger value="offers" data-testid="tab-offers">Offer Letters{offers?.length ? ` (${offers.length})` : ""}</TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Personal Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Field label="Date of Birth" type="date" v={emp as any} k="dateOfBirth" editing={editing} draft={draft} setDraft={setDraft} />
              <Field label="Gender" v={emp as any} k="gender" editing={editing} draft={draft} setDraft={setDraft}
                options={[["", "—"], ["male", "Male"], ["female", "Female"]]} />
              <Field label="Marital Status" v={emp as any} k="maritalStatus" editing={editing} draft={draft} setDraft={setDraft}
                options={[["", "—"], ["single", "Single"], ["married", "Married"], ["divorced", "Divorced"], ["widowed", "Widowed"]]} />
              <Field label="Nationality" v={emp as any} k="nationality" editing={editing} draft={draft} setDraft={setDraft} />
              <Field label="Personal Email" v={emp as any} k="personalEmail" editing={editing} draft={draft} setDraft={setDraft} />
              <Field label="Personal Phone" v={emp as any} k="personalPhone" editing={editing} draft={draft} setDraft={setDraft} />
              <Field label="Home Address" v={emp as any} k="homeAddress" editing={editing} draft={draft} setDraft={setDraft} className="md:col-span-3" />
              <Field label="Emergency Contact" v={emp as any} k="emergencyContactName" editing={editing} draft={draft} setDraft={setDraft} />
              <Field label="Emergency Phone" v={emp as any} k="emergencyContactPhone" editing={editing} draft={draft} setDraft={setDraft} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Identity Documents</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Field label="Passport No." v={emp as any} k="passportNo" editing={editing} draft={draft} setDraft={setDraft} />
              <Field label="Passport Expiry" type="date" v={emp as any} k="passportExpiry" editing={editing} draft={draft} setDraft={setDraft}
                valueClass={expiryClass((emp as any).passportExpiry)} />
              <Field label="Emirates ID No." v={emp as any} k="emiratesIdNo" editing={editing} draft={draft} setDraft={setDraft} />
              <Field label="EID Expiry" type="date" v={emp as any} k="emiratesIdExpiry" editing={editing} draft={draft} setDraft={setDraft}
                valueClass={expiryClass((emp as any).emiratesIdExpiry)} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Attachments</CardTitle>
              <div className="flex items-center gap-2">
                <Select value={pendingCategory} onValueChange={setPendingCategory}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>{ATTACHMENT_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                </Select>
                <input ref={attachmentInputRef} type="file" className="hidden" onChange={e => e.target.files?.[0] && handleAttachmentUpload(e.target.files[0])} />
                <Button onClick={() => attachmentInputRef.current?.click()} disabled={uploading} className="bg-[#0f2d5a] hover:bg-[#1e6ab0]" data-testid="button-upload-attachment">
                  <Upload className="w-4 h-4 mr-1" />{uploading ? "Uploading…" : "Upload"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!attachments || attachments.length === 0 ? (
                <div className="text-sm text-muted-foreground py-8 text-center">No attachments uploaded yet.</div>
              ) : (
                <div className="space-y-2">
                  {attachments.map((a: any) => (
                    <div key={a.id} className="flex items-center gap-3 border rounded-lg p-3 hover:bg-muted/40">
                      <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <a href={a.signedUrl} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline truncate">{a.fileName}</a>
                          <Badge variant="outline" className="text-[10px]">{a.category.replace(/_/g, " ")}</Badge>
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {a.uploadedByName ? `Uploaded by ${a.uploadedByName} · ` : ""}{new Date(a.uploadedAt).toLocaleString("en-AE")}
                          {a.sizeBytes ? ` · ${(a.sizeBytes / 1024).toFixed(1)} KB` : ""}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => deleteAttachment.mutate({ id: empId, attachmentId: a.id })} data-testid={`button-delete-attachment-${a.id}`}>
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="employment" className="space-y-3">
          <Card>
            <CardHeader><CardTitle>Employment</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Field label="Designation" v={emp as any} k="designation" editing={editing} draft={draft} setDraft={setDraft} />
              <Field label="Joining Date" type="date" v={emp as any} k="joiningDate" editing={editing} draft={draft} setDraft={setDraft} />
              <Field label="Site / Location" v={emp as any} k="siteLocation" editing={editing} draft={draft} setDraft={setDraft} />
              <Field label="Work Phone" v={emp as any} k="phone" editing={editing} draft={draft} setDraft={setDraft} />
              <Field label="Work Email" v={emp as any} k="email" editing={editing} draft={draft} setDraft={setDraft} />
              <div />
              <Field label="Basic Salary (AED)" type="number" v={emp as any} k="basicSalary" editing={editing} draft={draft} setDraft={setDraft} />
              <Field label="Allowances (AED)" type="number" v={emp as any} k="allowances" editing={editing} draft={draft} setDraft={setDraft} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="offers" className="space-y-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Offer Letters</CardTitle>
              <Button asChild size="sm" className="bg-[#0f2d5a] hover:bg-[#1e6ab0]"><Link href={`/hr/offer-letters?new=1&employeeId=${empId}`}>New Offer Letter</Link></Button>
            </CardHeader>
            <CardContent>
              {!offers || offers.length === 0 ? (
                <div className="text-sm text-muted-foreground py-8 text-center">No offer letters yet.</div>
              ) : (
                <div className="space-y-2">
                  {offers.map((o: any) => (
                    <Link key={o.id} href={`/hr/offer-letters/${o.id}`} className="block border rounded-lg p-3 hover:bg-muted/40">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{o.letterNumber} <span className="text-xs text-muted-foreground">v{o.version}</span></div>
                          <div className="text-xs text-muted-foreground">{o.designation || "—"} · {o.templateType} · issued {o.issuedAt ? new Date(o.issuedAt).toLocaleDateString("en-AE") : "—"}</div>
                        </div>
                        <Badge className={o.status === "accepted" ? "bg-green-100 text-green-800" : o.status === "rejected" ? "bg-red-100 text-red-800" : o.status === "issued" ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-700"}>{o.status}</Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({
  label, v, k, editing, draft, setDraft, type = "text", className = "", valueClass = "", options,
}: {
  label: string; v: any; k: string; editing: boolean; draft: any; setDraft: (fn: any) => void;
  type?: string; className?: string; valueClass?: string; options?: [string, string][];
}) {
  return (
    <div className={`space-y-1 ${className}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {editing ? (
        options ? (
          <Select
            value={(() => { const cur = draft[k]; if (cur == null || cur === "") return "__none__"; return String(cur); })()}
            onValueChange={val => setDraft((p: any) => ({ ...p, [k]: val === "__none__" ? "" : val }))}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{options.map(([val, lab]) => <SelectItem key={val || "_empty"} value={val || "__none__"}>{lab}</SelectItem>)}</SelectContent>
          </Select>
        ) : (
          <Input type={type} value={draft[k] ?? ""} onChange={e => setDraft((p: any) => ({ ...p, [k]: e.target.value }))} data-testid={`input-${k}`} />
        )
      ) : (
        <div className={`text-sm ${valueClass}`}>{(v?.[k] ?? "") || <span className="text-muted-foreground">—</span>}</div>
      )}
    </div>
  );
}
