import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Copy, RefreshCw, User, Briefcase, FileText, GraduationCap,
  Users, CheckCircle, XCircle, Clock, AlertCircle, Download, Link2, Eye,
} from "lucide-react";
import { format } from "date-fns";

const AUTH_KEY = "erp_token";
function authHeaders() { return { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem(AUTH_KEY) ?? ""}` }; }

const DOC_STATUS_META: Record<string, { label: string; color: string }> = {
  submitted: { label: "Submitted", color: "bg-blue-100 text-blue-800" },
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-800" },
  not_applicable: { label: "N/A", color: "bg-gray-100 text-gray-600" },
  expired: { label: "Expired", color: "bg-red-100 text-red-800" },
  verified: { label: "Verified", color: "bg-emerald-100 text-emerald-800" },
  rejected: { label: "Rejected", color: "bg-red-200 text-red-900" },
};

const REG_STATUSES = [
  "link_generated", "pending", "submitted", "under_review",
  "correction_required", "approved", "rejected", "active", "inactive",
];
const STATUS_LABELS: Record<string, string> = {
  link_generated: "Link Generated", pending: "Pending Submission", submitted: "Submitted",
  under_review: "Under Review", correction_required: "Correction Required",
  approved: "Approved", rejected: "Rejected", active: "Active Employee", inactive: "Inactive",
};

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-sm font-medium">{value}</p></div>
  );
}

interface Registration {
  id: number; regCode: string; deptRegCode: string | null; status: string;
  fullName: string; fatherName: string | null; email: string | null; mobile: string | null;
  dateOfBirth: string | null; gender: string | null; nationality: string | null; maritalStatus: string | null;
  currentAddress: string | null; permanentAddress: string | null;
  currentCountry: string | null; currentState: string | null; currentCity: string | null;
  homeCountry: string | null; homeState: string | null; homeCity: string | null;
  emergencyContactName: string | null; emergencyContactNumber: string | null; emergencyContactRelationship: string | null;
  departmentName: string | null; designation: string | null; joiningType: string | null; branch: string | null;
  expectedJoiningDate: string | null; visaStatus: string | null; uaeDrivingLicense: string | null;
  totalExperienceYears: string | null; gulfExperienceYears: string | null; homeCountryExperienceYears: string | null;
  previousCompany: string | null; previousDesignation: string | null; previousCompanyLocation: string | null;
  reasonForLeaving: string | null; skillsCategory: string | null; salaryExpectation: string | null;
  adminRemarks: string | null; correctionNotes: string | null;
  registrationLink: string; token: string; linkActive: boolean;
  submittedAt: string | null; createdAt: string;
  documents: Array<{ id: number; documentType: string; documentName: string; fileData: string | null; fileName: string | null; expiryDate: string | null; status: string; adminRemarks: string | null; uploadedAt: string }>;
  experience: Array<{ id: number; companyName: string; designation: string | null; country: string | null; city: string | null; startDate: string | null; endDate: string | null; totalDuration: string | null; reasonForLeaving: string | null; jobResponsibilities: string | null }>;
  education: Array<{ id: number; certificateName: string; instituteName: string | null; country: string | null; passingYear: string | null; grade: string | null; fileData: string | null }>;
  relatives: Array<{ id: number; relativeName: string; relationship: string | null; contactNumber: string | null; country: string | null; address: string | null }>;
}

export function EmployeeRegistrationDetail({ id }: { id: string }) {
  const [, navigate] = useLocation();
  const { activeCompanyId } = useActiveCompany();
  const isElite = activeCompanyId === 2;
  const primeBtnCls = isElite ? "bg-[#0D0D0D] hover:bg-[#8B0000]" : "bg-[#0f2d5a] hover:bg-[#1e6ab0]";
  const { toast } = useToast();
  const qc = useQueryClient();

  const [newStatus, setNewStatus] = useState("");
  const [adminRemarks, setAdminRemarks] = useState("");
  const [correctionNotes, setCorrectionNotes] = useState("");

  const { data: reg, isLoading } = useQuery<Registration>({
    queryKey: ["employee-registration", id],
    queryFn: async () => {
      const res = await fetch(`/api/employee-registrations/${id}`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
  });

  useEffect(() => {
    if (reg) {
      setNewStatus(reg.status);
      setAdminRemarks(reg.adminRemarks ?? "");
      setCorrectionNotes(reg.correctionNotes ?? "");
    }
  }, [reg?.id]);

  const updateMutation = useMutation({
    mutationFn: async (body: object) => {
      const res = await fetch(`/api/employee-registrations/${id}`, { method: "PUT", headers: authHeaders(), body: JSON.stringify(body) });
      if (!res.ok) throw new Error("Update failed");
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employee-registration", id] }); toast({ title: "Updated successfully" }); },
    onError: (e) => toast({ title: "Error", description: String(e), variant: "destructive" }),
  });

  const regenMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/employee-registrations/${id}/regenerate-link`, { method: "POST", headers: authHeaders() });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (d) => { qc.invalidateQueries({ queryKey: ["employee-registration", id] }); navigator.clipboard.writeText(d.registrationLink); toast({ title: "New link generated & copied!" }); },
  });

  const verifyDoc = useMutation({
    mutationFn: async ({ docId, status, adminRemarks }: { docId: number; status: string; adminRemarks?: string }) => {
      const res = await fetch(`/api/employee-registrations/${id}/documents/${docId}`, { method: "PUT", headers: authHeaders(), body: JSON.stringify({ status, adminRemarks }) });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employee-registration", id] }),
  });

  const downloadDoc = async (docId: number, fileName: string | null) => {
    const res = await fetch(`/api/employee-registrations/${id}/documents/${docId}/download`, { headers: authHeaders() });
    if (!res.ok) { toast({ title: "Failed to download", variant: "destructive" }); return; }
    const { fileData, contentType } = await res.json();
    if (!fileData) return;
    const a = document.createElement("a");
    a.href = fileData;
    a.download = fileName ?? "document";
    a.click();
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  if (!reg) return <div className="p-8 text-center text-destructive">Registration not found.</div>;

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate("/hr/employee-registrations")}>
            <ArrowLeft className="w-4 h-4 mr-1" />Back
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold">{reg.fullName}</h1>
              <Badge className={`text-[11px] border-0 ${reg.status === "approved" ? "bg-emerald-100 text-emerald-800" : reg.status === "rejected" ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800"}`}>
                {STATUS_LABELS[reg.status] ?? reg.status}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
              <code className="font-mono font-bold">{reg.regCode}</code>
              {reg.deptRegCode && <code className="font-mono text-blue-600">{reg.deptRegCode}</code>}
              {reg.departmentName && <span>{reg.departmentName}</span>}
              {reg.submittedAt && <span>Submitted {format(new Date(reg.submittedAt), "dd MMM yyyy")}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-muted rounded px-3 py-1.5 text-xs">
            <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="font-mono text-[11px] truncate max-w-[180px]">{reg.registrationLink.replace(/^https?:\/\//, "")}</span>
            <button onClick={() => { navigator.clipboard.writeText(reg.registrationLink); toast({ title: "Copied!" }); }}><Copy className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" /></button>
          </div>
          <Button variant="outline" size="sm" onClick={() => regenMutation.mutate()} disabled={regenMutation.isPending}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" />Regenerate
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main content */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="profile">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="profile"><User className="w-3.5 h-3.5 mr-1.5" />Profile</TabsTrigger>
              <TabsTrigger value="documents">
                <FileText className="w-3.5 h-3.5 mr-1.5" />Documents
                {reg.documents.length > 0 && <span className="ml-1 bg-primary text-primary-foreground rounded-full text-[10px] w-4 h-4 inline-flex items-center justify-center">{reg.documents.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="experience"><Briefcase className="w-3.5 h-3.5 mr-1.5" />Experience</TabsTrigger>
              <TabsTrigger value="education"><GraduationCap className="w-3.5 h-3.5 mr-1.5" />Education</TabsTrigger>
              <TabsTrigger value="relatives"><Users className="w-3.5 h-3.5 mr-1.5" />Emergency</TabsTrigger>
            </TabsList>

            {/* Profile tab */}
            <TabsContent value="profile" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">Personal Information</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <InfoRow label="Full Name" value={reg.fullName} />
                  <InfoRow label="Father's Name" value={reg.fatherName} />
                  <InfoRow label="Date of Birth" value={reg.dateOfBirth} />
                  <InfoRow label="Gender" value={reg.gender} />
                  <InfoRow label="Nationality" value={reg.nationality} />
                  <InfoRow label="Marital Status" value={reg.maritalStatus} />
                  <InfoRow label="Email" value={reg.email} />
                  <InfoRow label="Mobile" value={reg.mobile} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">Location</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <InfoRow label="Current Country" value={reg.currentCountry} />
                  <InfoRow label="Current City" value={reg.currentCity} />
                  <InfoRow label="Home Country" value={reg.homeCountry} />
                  <InfoRow label="Home City" value={reg.homeCity} />
                  <div className="col-span-2"><InfoRow label="Current Address" value={reg.currentAddress} /></div>
                  <div className="col-span-2"><InfoRow label="Permanent Address" value={reg.permanentAddress} /></div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">Employment Details</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <InfoRow label="Designation" value={reg.designation} />
                  <InfoRow label="Department" value={reg.departmentName} />
                  <InfoRow label="Joining Type" value={reg.joiningType} />
                  <InfoRow label="Expected Joining" value={reg.expectedJoiningDate} />
                  <InfoRow label="Visa Status" value={reg.visaStatus} />
                  <InfoRow label="UAE Driving License" value={reg.uaeDrivingLicense} />
                  <InfoRow label="Total Experience" value={reg.totalExperienceYears ? `${reg.totalExperienceYears} yrs` : null} />
                  <InfoRow label="Gulf Experience" value={reg.gulfExperienceYears ? `${reg.gulfExperienceYears} yrs` : null} />
                  <InfoRow label="Skills / Trade" value={reg.skillsCategory} />
                  <InfoRow label="Salary Expectation" value={reg.salaryExpectation} />
                  <InfoRow label="Previous Company" value={reg.previousCompany} />
                  <InfoRow label="Previous Designation" value={reg.previousDesignation} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">Emergency Contact</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <InfoRow label="Name" value={reg.emergencyContactName} />
                  <InfoRow label="Number" value={reg.emergencyContactNumber} />
                  <InfoRow label="Relationship" value={reg.emergencyContactRelationship} />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Documents tab */}
            <TabsContent value="documents" className="mt-4">
              {reg.documents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">No documents uploaded yet.</div>
              ) : (
                <div className="space-y-2">
                  {reg.documents.map(doc => {
                    const sm = DOC_STATUS_META[doc.status] ?? { label: doc.status, color: "bg-gray-100 text-gray-600" };
                    const [showRemarks, setShowRemarks] = useState(false);
                    const [remarks, setRemarks] = useState(doc.adminRemarks ?? "");
                    return (
                      <Card key={doc.id}>
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm">{doc.documentName}</span>
                                <Badge className={`text-[10px] border-0 ${sm.color}`}>{sm.label}</Badge>
                                <span className="text-xs text-muted-foreground font-mono">{doc.documentType}</span>
                              </div>
                              {doc.expiryDate && (
                                <p className="text-xs text-muted-foreground mt-0.5">Expiry: {doc.expiryDate}</p>
                              )}
                              {doc.adminRemarks && <p className="text-xs text-muted-foreground mt-0.5 italic">Remarks: {doc.adminRemarks}</p>}
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {doc.fileData === "[uploaded]" && (
                                <Button size="sm" variant="outline" onClick={() => downloadDoc(doc.id, doc.fileName)}>
                                  <Download className="w-3.5 h-3.5" />
                                </Button>
                              )}
                              <Button size="sm" variant="outline" className="text-emerald-600 hover:text-emerald-700" onClick={() => verifyDoc.mutate({ docId: doc.id, status: "verified" })}>
                                <CheckCircle className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setShowRemarks(!showRemarks)}>
                                <XCircle className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                          {showRemarks && (
                            <div className="mt-3 flex gap-2">
                              <Input placeholder="Rejection remarks…" value={remarks} onChange={e => setRemarks(e.target.value)} className="text-sm h-8" />
                              <Button size="sm" variant="destructive" onClick={() => { verifyDoc.mutate({ docId: doc.id, status: "rejected", adminRemarks: remarks }); setShowRemarks(false); }}>Reject</Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* Experience tab */}
            <TabsContent value="experience" className="mt-4 space-y-3">
              {reg.experience.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">No experience records submitted.</div>
              ) : reg.experience.map((e, i) => (
                <Card key={e.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-sm">{e.companyName}</p>
                        <p className="text-xs text-muted-foreground">{e.designation}{e.country && ` · ${e.city ? e.city + ", " : ""}${e.country}`}</p>
                        {(e.startDate || e.endDate) && <p className="text-xs text-muted-foreground">{e.startDate} → {e.endDate ?? "Present"}{e.totalDuration && ` (${e.totalDuration})`}</p>}
                      </div>
                      <Badge variant="outline" className="text-[10px]">#{i + 1}</Badge>
                    </div>
                    {e.jobResponsibilities && <p className="text-xs mt-2 text-muted-foreground">{e.jobResponsibilities}</p>}
                    {e.reasonForLeaving && <p className="text-xs mt-1"><span className="font-medium">Reason for leaving:</span> {e.reasonForLeaving}</p>}
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            {/* Education tab */}
            <TabsContent value="education" className="mt-4 space-y-3">
              {reg.education.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">No education records submitted.</div>
              ) : reg.education.map((e, i) => (
                <Card key={e.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-sm">{e.certificateName}</p>
                        <p className="text-xs text-muted-foreground">{e.instituteName}{e.country && ` · ${e.country}`}</p>
                        <p className="text-xs text-muted-foreground">{e.passingYear}{e.grade && ` · Grade: ${e.grade}`}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {e.fileData && <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Certificate uploaded</Badge>}
                        <Badge variant="outline" className="text-[10px]">#{i + 1}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            {/* Relatives tab */}
            <TabsContent value="relatives" className="mt-4 space-y-3">
              {reg.relatives.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">No emergency contact records.</div>
              ) : reg.relatives.map(r => (
                <Card key={r.id}>
                  <CardContent className="p-4 grid grid-cols-2 gap-3">
                    <InfoRow label="Name" value={r.relativeName} />
                    <InfoRow label="Relationship" value={r.relationship} />
                    <InfoRow label="Contact" value={r.contactNumber} />
                    <InfoRow label="Country" value={r.country} />
                    <div className="col-span-2"><InfoRow label="Address" value={r.address} /></div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar — status & actions */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Update Status</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{REG_STATUSES.map(s => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}</SelectContent>
              </Select>
              <div className="space-y-1">
                <Label className="text-xs">Admin Remarks</Label>
                <Textarea rows={2} placeholder="Internal notes…" value={adminRemarks} onChange={e => setAdminRemarks(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Correction Notes (sent to employee)</Label>
                <Textarea rows={2} placeholder="What the employee needs to fix…" value={correctionNotes} onChange={e => setCorrectionNotes(e.target.value)} />
              </div>
              <Button className={`${primeBtnCls} text-white w-full`} disabled={updateMutation.isPending} onClick={() => updateMutation.mutate({ status: newStatus, adminRemarks, correctionNotes })}>
                {updateMutation.isPending ? "Saving…" : "Save Changes"}
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 text-emerald-600 border-emerald-300" onClick={() => updateMutation.mutate({ status: "approved", adminRemarks })}>
                  <CheckCircle className="w-3.5 h-3.5 mr-1" />Approve
                </Button>
                <Button variant="outline" size="sm" className="flex-1 text-destructive border-destructive/30" onClick={() => updateMutation.mutate({ status: "rejected", adminRemarks })}>
                  <XCircle className="w-3.5 h-3.5 mr-1" />Reject
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Registration Info</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Reg. Code</span><code className="font-mono font-bold">{reg.regCode}</code></div>
              {reg.deptRegCode && <div className="flex justify-between"><span className="text-muted-foreground">Dept. Code</span><code className="font-mono">{reg.deptRegCode}</code></div>}
              <div className="flex justify-between"><span className="text-muted-foreground">Department</span><span>{reg.departmentName ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Joining Type</span><span>{reg.joiningType ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Branch</span><span>{reg.branch ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span>{format(new Date(reg.createdAt), "dd MMM yyyy")}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Link Active</span><span className={reg.linkActive ? "text-emerald-600" : "text-red-600"}>{reg.linkActive ? "Yes" : "No"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Documents</span><span>{reg.documents.length} uploaded</span></div>
            </CardContent>
          </Card>

          {reg.correctionNotes && (
            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="p-3">
                <p className="text-xs font-semibold text-orange-700 mb-1">Correction Required</p>
                <p className="text-xs text-orange-800">{reg.correctionNotes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
