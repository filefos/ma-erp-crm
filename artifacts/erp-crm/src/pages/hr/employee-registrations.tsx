import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { useListDepartments } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { CompanyField } from "@/components/CompanyField";
import {
  UserPlus, Search, Link2, Copy, Check, Users, ClipboardList,
  Clock, CheckCircle, XCircle, AlertCircle, RefreshCw, ExternalLink,
} from "lucide-react";
import { format } from "date-fns";

const AUTH_KEY = "erp_token";
function authHeaders() {
  return { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem(AUTH_KEY) ?? ""}` };
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  link_generated: { label: "Link Generated", color: "bg-blue-100 text-blue-800" },
  pending: { label: "Pending Submission", color: "bg-yellow-100 text-yellow-800" },
  submitted: { label: "Submitted", color: "bg-purple-100 text-purple-800" },
  under_review: { label: "Under Review", color: "bg-orange-100 text-orange-800" },
  correction_required: { label: "Correction Required", color: "bg-red-100 text-red-800" },
  approved: { label: "Approved", color: "bg-emerald-100 text-emerald-800" },
  rejected: { label: "Rejected", color: "bg-red-200 text-red-900" },
  active: { label: "Active Employee", color: "bg-emerald-200 text-emerald-900" },
  inactive: { label: "Inactive", color: "bg-gray-100 text-gray-700" },
};

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: status, color: "bg-gray-100 text-gray-700" };
  return <Badge className={`${m.color} text-[11px] border-0`}>{m.label}</Badge>;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };
  return (
    <button onClick={copy} className="text-muted-foreground hover:text-foreground transition-colors">
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

interface RegistrationRow {
  id: number; regCode: string; deptRegCode: string | null; status: string;
  fullName: string; email: string | null; mobile: string | null;
  departmentName: string | null; designation: string | null;
  registrationLink: string; createdAt: string;
}

export function EmployeeRegistrations() {
  const [, navigate] = useLocation();
  const { activeCompanyId, filterByCompany } = useActiveCompany();
  const isElite = activeCompanyId === 2;
  const primeBtnCls = isElite ? "bg-[#0D0D0D] hover:bg-[#8B0000]" : "bg-[#0f2d5a] hover:bg-[#1e6ab0]";
  const { toast } = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "", mobile: "", designation: "", departmentId: "", companyId: String(activeCompanyId ?? ""), joiningType: "", branch: "" });
  const [createdResult, setCreatedResult] = useState<{ regCode: string; deptRegCode: string | null; registrationLink: string } | null>(null);

  const { data: depts } = useListDepartments();
  const myDepts = (depts ?? []).filter(d => !activeCompanyId || (d as unknown as { companyId: number }).companyId === activeCompanyId);

  const { data: registrations = [], isLoading } = useQuery<RegistrationRow[]>({
    queryKey: ["employee-registrations"],
    queryFn: async () => {
      const res = await fetch("/api/employee-registrations", { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (body: typeof form) => {
      const res = await fetch("/api/employee-registrations", {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ ...body, departmentId: body.departmentId ? Number(body.departmentId) : undefined, companyId: Number(body.companyId) }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Failed to create"); }
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["employee-registrations"] });
      setCreatedResult({ regCode: data.regCode, deptRegCode: data.deptRegCode, registrationLink: data.registrationLink });
      setForm({ fullName: "", email: "", mobile: "", designation: "", departmentId: "", companyId: String(activeCompanyId ?? ""), joiningType: "", branch: "" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filtered = filterByCompany(registrations).filter(r => {
    const s = search.toLowerCase();
    const matchSearch = !s || r.fullName.toLowerCase().includes(s) || r.regCode.toLowerCase().includes(s) || (r.email ?? "").toLowerCase().includes(s);
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    const matchDept = deptFilter === "all" || r.departmentName === deptFilter;
    return matchSearch && matchStatus && matchDept;
  });

  const statusCounts = registrations.reduce<Record<string, number>>((acc, r) => { acc[r.status] = (acc[r.status] ?? 0) + 1; return acc; }, {});

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Employee Registration Panel</h1>
          <p className="text-muted-foreground text-sm">Create secure registration links and review employee submissions.</p>
        </div>
        <Button className={`${primeBtnCls} text-white`} onClick={() => { setShowCreate(true); setCreatedResult(null); }}>
          <UserPlus className="w-4 h-4 mr-2" />New Registration
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total", count: registrations.length, icon: Users, color: "text-blue-600" },
          { label: "Submitted", count: (statusCounts["submitted"] ?? 0) + (statusCounts["under_review"] ?? 0), icon: ClipboardList, color: "text-purple-600" },
          { label: "Pending", count: (statusCounts["link_generated"] ?? 0) + (statusCounts["pending"] ?? 0), icon: Clock, color: "text-yellow-600" },
          { label: "Approved", count: (statusCounts["approved"] ?? 0) + (statusCounts["active"] ?? 0), icon: CheckCircle, color: "text-emerald-600" },
        ].map(({ label, count, icon: Icon, color }) => (
          <Card key={label} className="py-0">
            <CardContent className="p-4 flex items-center gap-3">
              <Icon className={`w-6 h-6 ${color}`} />
              <div><p className="text-2xl font-bold">{count}</p><p className="text-xs text-muted-foreground">{label}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-[320px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search name, ID, email…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(STATUS_META).map(([v, m]) => <SelectItem key={v} value={v}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="All departments" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {myDepts.map(d => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading registrations…</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <UserPlus className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium">No registrations found</p>
              <p className="text-sm text-muted-foreground mt-1">Create the first employee registration to get started.</p>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map(r => (
                <div key={r.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-sm font-semibold text-muted-foreground flex-shrink-0">
                      {r.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{r.fullName}</span>
                        <StatusBadge status={r.status} />
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                        <span className="font-mono">{r.regCode}</span>
                        {r.deptRegCode && <span className="font-mono text-blue-600">{r.deptRegCode}</span>}
                        {r.departmentName && <span>· {r.departmentName}</span>}
                        {r.designation && <span>· {r.designation}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/60 rounded px-2 py-1">
                      <Link2 className="w-3 h-3" />
                      <span className="font-mono truncate max-w-[120px] hidden sm:inline">{r.registrationLink.replace(/^https?:\/\//, "").slice(0, 30)}…</span>
                      <CopyButton value={r.registrationLink} />
                    </div>
                    <Button size="sm" variant="outline" onClick={() => navigate(`/hr/employee-registrations/${r.id}`)}>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={(o) => { if (!o) { setShowCreate(false); setCreatedResult(null); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Employee Registration</DialogTitle></DialogHeader>
          {createdResult ? (
            <div className="space-y-4 pt-2">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 text-emerald-700 font-semibold">
                  <CheckCircle className="w-5 h-5" />Registration Created Successfully
                </div>
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Employee ID</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="bg-white border rounded px-2 py-1 text-sm font-mono font-bold">{createdResult.regCode}</code>
                      <CopyButton value={createdResult.regCode} />
                    </div>
                  </div>
                  {createdResult.deptRegCode && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Department ID</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="bg-white border rounded px-2 py-1 text-sm font-mono">{createdResult.deptRegCode}</code>
                        <CopyButton value={createdResult.deptRegCode} />
                      </div>
                    </div>
                  )}
                  <div>
                    <Label className="text-xs text-muted-foreground">Registration Link (share with employee)</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="bg-white border rounded px-2 py-1 text-xs font-mono break-all flex-1">{createdResult.registrationLink}</code>
                      <CopyButton value={createdResult.registrationLink} />
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(createdResult.registrationLink); toast({ title: "Copied!", description: "Registration link copied to clipboard." }); }}>
                    <Copy className="w-3.5 h-3.5 mr-1.5" />Copy Link
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a href={`https://wa.me/?text=${encodeURIComponent(`Your employee registration link: ${createdResult.registrationLink}`)}`} target="_blank" rel="noreferrer">
                      Share on WhatsApp
                    </a>
                  </Button>
                </div>
              </div>
              <div className="flex gap-2">
                <Button className={`${primeBtnCls} text-white flex-1`} onClick={() => { setShowCreate(false); setCreatedResult(null); }}>Close</Button>
                <Button variant="outline" onClick={() => setCreatedResult(null)}>Create Another</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label>Full Name <span className="text-destructive">*</span></Label>
                <Input placeholder="Employee full name" value={form.fullName} onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Email</Label>
                  <Input type="email" placeholder="email@example.com" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Mobile</Label>
                  <Input placeholder="+971…" value={form.mobile} onChange={e => setForm(p => ({ ...p, mobile: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Designation</Label>
                  <Input placeholder="Job title" value={form.designation} onChange={e => setForm(p => ({ ...p, designation: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Joining Type</Label>
                  <Select value={form.joiningType} onValueChange={v => setForm(p => ({ ...p, joiningType: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="labour">Labour</SelectItem>
                      <SelectItem value="contractor">Contractor</SelectItem>
                      <SelectItem value="intern">Intern</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Department</Label>
                  <Select value={form.departmentId} onValueChange={v => setForm(p => ({ ...p, departmentId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select dept." /></SelectTrigger>
                    <SelectContent>{myDepts.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Branch / Location</Label>
                  <Input placeholder="Site / office" value={form.branch} onChange={e => setForm(p => ({ ...p, branch: e.target.value }))} />
                </div>
              </div>
              <CompanyField value={form.companyId} onChange={v => setForm(p => ({ ...p, companyId: v }))} />
              <Button
                className={`${primeBtnCls} text-white w-full mt-2`}
                disabled={!form.fullName || !form.companyId || createMutation.isPending}
                onClick={() => createMutation.mutate(form)}
              >
                {createMutation.isPending ? "Creating…" : "Create & Generate Link"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
