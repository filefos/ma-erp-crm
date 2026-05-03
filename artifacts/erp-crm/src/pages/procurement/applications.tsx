import { useState } from "react";
import {
  useListSupplierApplications,
  useGetSupplierApplication,
  useDecideSupplierApplication,
  getListSupplierApplicationsQueryKey,
} from "@workspace/api-client-react";
import type {
  SupplierRegistration,
  SupplierRegistrationStatus,
  SupplierApplicationDecisionBodyDecision,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Tabs, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  CheckCircle2, XCircle, MessageCircleQuestion, FileCheck, Building2, Mail,
  Banknote, Paperclip, Download, Loader2, FileText, ShieldCheck, ClipboardList,
  Tags, Image as ImageIcon,
} from "lucide-react";

const STATUS_BADGES: Record<SupplierRegistrationStatus, string> = {
  pending_review: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  more_info_needed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
};

const STATUS_LABELS: Record<SupplierRegistrationStatus, string> = {
  pending_review: "Pending Review",
  approved: "Approved",
  rejected: "Rejected",
  more_info_needed: "More Info Needed",
};

export function SupplierApplicationsList() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [openId, setOpenId] = useState<number | null>(null);
  const { filterByCompany } = useActiveCompany();
  const { data, isLoading } = useListSupplierApplications(
    statusFilter === "all" ? {} : { status: statusFilter }
  );
  const filtered: SupplierRegistration[] = filterByCompany((data ?? []) as SupplierRegistration[]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Supplier Applications</h1>
          <p className="text-muted-foreground">
            Review applications submitted via the public registration portal.{" "}
            <a className="text-[#1e6ab0] underline" href="/supplier-register" target="_blank" rel="noreferrer">
              View public form
            </a>
          </p>
        </div>
      </div>

      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending_review">Pending Review</TabsTrigger>
          <TabsTrigger value="more_info_needed">More Info Needed</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reference</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Categories</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No applications.</TableCell></TableRow>
            ) : (
              filtered.map((a) => {
                const cats = a.categories ?? [];
                return (
                  <TableRow key={a.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setOpenId(a.id)}>
                    <TableCell className="font-mono text-xs text-[#1e6ab0]">{a.refNumber}</TableCell>
                    <TableCell className="font-medium">{a.companyName}</TableCell>
                    <TableCell>
                      <div className="text-sm">{a.contactPerson}</div>
                      <div className="text-[11px] text-muted-foreground">{a.email}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {cats.slice(0, 2).map((c) => (
                          <span key={c} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{c}</span>
                        ))}
                        {cats.length > 2 && (
                          <span className="text-[10px] text-muted-foreground">+{cats.length - 2}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {a.submittedAt ? new Date(a.submittedAt).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={STATUS_BADGES[a.status] ?? ""}>
                        {STATUS_LABELS[a.status] ?? a.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setOpenId(a.id); }}>
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <ApplicationDetailSheet id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

function ApplicationDetailSheet({ id, onClose }: { id: number | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data: app, isLoading } = useGetSupplierApplication(id ?? 0, {
    query: { enabled: !!id, queryKey: ["supplier-application", id ?? 0] as const },
  });
  const decide = useDecideSupplierApplication({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSupplierApplicationsQueryKey() });
        setNotes("");
        onClose();
      },
    },
  });
  const [notes, setNotes] = useState("");

  function act(decision: SupplierApplicationDecisionBodyDecision) {
    if (!id) return;
    decide.mutate({ id, data: { decision, notes: notes || undefined } });
  }

  return (
    <Sheet open={!!id} onOpenChange={v => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-[#1e6ab0]" />
            Supplier Application
          </SheetTitle>
        </SheetHeader>

        {isLoading || !app ? (
          <div className="py-12 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <DetailBody app={app} notes={notes} setNotes={setNotes} act={act} pending={decide.isPending} />
        )}
      </SheetContent>
    </Sheet>
  );
}

interface DetailProps {
  app: SupplierRegistration;
  notes: string;
  setNotes: (v: string) => void;
  act: (d: SupplierApplicationDecisionBodyDecision) => void;
  pending: boolean;
}

function DetailBody({ app, notes, setNotes, act, pending }: DetailProps) {
  const cats = app.categories ?? [];
  const refs = app.referenceClients ?? [];
  const atts = app.attachments ?? [];
  const editable = app.status === "pending_review" || app.status === "more_info_needed";

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-mono text-xs text-[#1e6ab0]">{app.refNumber}</div>
          <div className="text-xl font-bold">{app.companyName}</div>
          {app.tradeName && <div className="text-xs text-muted-foreground">Trading as: {app.tradeName}</div>}
        </div>
        <Badge variant="secondary" className={STATUS_BADGES[app.status] ?? ""}>
          {STATUS_LABELS[app.status] ?? app.status}
        </Badge>
      </div>

      <Section icon={Building2} title="Company">
        <KV k="Trade Licence" v={app.tradeLicenseNo} />
        <KV k="Issuing Authority" v={app.licenseAuthority} />
        <KV k="Licence Expiry" v={app.licenseExpiry} />
        <KV k="Established" v={app.establishedYear} />
        <KV k="Size" v={app.companySize} />
        <KV k="Address" v={[app.poBox && `PO ${app.poBox}`, app.city, app.emirate, app.country].filter(Boolean).join(", ")} />
        <KV k="Street Address" v={app.address} />
        <KV k="Website" v={app.website} />
      </Section>

      <Section icon={Mail} title="Contact">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Authorised Signatory</div>
        <KV k="Name" v={`${app.contactPerson}${app.designation ? ` (${app.designation})` : ""}`} />
        <KV k="Email" v={app.email} />
        <KV k="Phone" v={app.phone} />
        <KV k="WhatsApp" v={app.whatsapp} />
        {(app.tenderContactName || app.tenderContactEmail || app.tenderContactMobile) && (
          <>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-2 mb-1">Tender / RFQ Contact</div>
            <KV k="Name" v={app.tenderContactName} />
            <KV k="Mobile" v={app.tenderContactMobile} />
            <KV k="Email" v={app.tenderContactEmail} />
          </>
        )}
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-2 mb-1">Tax</div>
        <KV k="VAT Registered" v={app.vatRegistered ? "Yes" : "No"} />
        <KV k="VAT TRN" v={app.trn} />
        <KV k="VAT Cert. Expiry" v={app.vatCertificateExpiry} />
        <KV k="Chamber Membership" v={app.chamberMembership} />
      </Section>

      <Section icon={Tags} title="Categories & Commercial">
        <div className="flex flex-wrap gap-1.5 mb-2">
          {cats.map((c) => (
            <span key={c} className="text-xs bg-[#1e6ab0]/10 text-[#1e6ab0] px-2 py-0.5 rounded-full">{c}</span>
          ))}
        </div>
        <KV k="Other (specify)" v={app.categoriesOther} />
        <KV k="Payment Terms" v={app.paymentTerms} />
        <KV k="Delivery Terms" v={app.deliveryTerms} />
      </Section>

      <Section icon={ClipboardList} title="Profile">
        <KV k="Years in Business" v={app.yearsExperience} />
        <KV k="Annual Turnover" v={app.turnoverBand} />
        <KV k="Employees" v={app.employeeBand} />
        <KV k="Major Clients" v={app.majorClients} />
        {refs.length > 0 && (
          <div className="mt-1.5">
            <div className="text-xs text-muted-foreground mb-1">Reference Clients</div>
            <ul className="text-sm list-disc pl-5 space-y-0.5">
              {refs.map((r, i) => (
                <li key={i}>
                  <span className="font-medium">{r.name || "—"}</span>
                  {r.contact && <span className="text-muted-foreground"> · {r.contact}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      <Section icon={Banknote} title="Banking">
        <KV k="Bank" v={app.bankName} />
        <KV k="Branch" v={app.bankBranch} />
        <KV k="Account Holder" v={app.bankAccountName} />
        <KV k="Account #" v={app.bankAccountNumber} />
        <KV k="IBAN" v={app.iban} />
        <KV k="SWIFT" v={app.swift} />
        <KV k="Currency" v={app.currency} />
      </Section>

      <Section icon={Paperclip} title={`Documents (${atts.length})`}>
        {atts.length === 0 ? (
          <div className="text-sm text-muted-foreground italic">No documents attached.</div>
        ) : (
          <div className="space-y-3">
            {atts.map((f, idx) => {
              const url = `/api/supplier-applications/${app.id}/attachments/${idx}`;
              const isImage = (f.contentType ?? "").startsWith("image/");
              const isPdf = (f.contentType ?? "").includes("pdf") || f.filename.toLowerCase().endsWith(".pdf");
              return (
                <div key={idx} className="border rounded-lg overflow-hidden bg-background">
                  <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b">
                    <div className="flex items-center gap-2 min-w-0">
                      {isImage ? <ImageIcon className="w-4 h-4 text-muted-foreground shrink-0" /> : <FileText className="w-4 h-4 text-muted-foreground shrink-0" />}
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{f.filename}</div>
                        <div className="text-[11px] text-muted-foreground">{(f.size / 1024).toFixed(1)} KB · {f.contentType}</div>
                      </div>
                    </div>
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-[#1e6ab0] hover:underline flex items-center gap-1 shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" /> Download
                    </a>
                  </div>
                  {isImage ? (
                    <a href={url} target="_blank" rel="noreferrer" className="block bg-muted/20">
                      <img src={url} alt={f.filename} className="max-h-64 mx-auto object-contain" />
                    </a>
                  ) : isPdf ? (
                    <iframe src={url} title={f.filename} className="w-full h-72 bg-muted/20" />
                  ) : (
                    <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                      Inline preview not available for this file type — use Download.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Section icon={ShieldCheck} title="Declarations">
        <KV k="Truth & Accuracy" v={app.agreedTerms ? "Accepted" : "Not accepted"} />
        <KV k="Code of Conduct & Anti-Bribery" v={app.agreedCodeOfConduct ? "Accepted" : "Not accepted"} />
        <KV k="Submitted At" v={app.submittedAt ? new Date(app.submittedAt).toLocaleString("en-AE") : undefined} />
      </Section>

      {app.reviewNotes && (
        <Section icon={MessageCircleQuestion} title="Previous Review Notes">
          <div className="text-sm whitespace-pre-wrap">{app.reviewNotes}</div>
        </Section>
      )}

      {editable ? (
        <div className="border-t pt-4 space-y-3 sticky bottom-0 bg-card -mx-6 px-6 pb-2">
          <div className="space-y-1">
            <Label>Notes (optional — sent to applicant)</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Reason for rejection / what additional info is needed..." />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => act("approve")} disabled={pending} className="bg-emerald-600 hover:bg-emerald-700">
              <CheckCircle2 className="w-4 h-4 mr-1" /> Approve & Create Supplier
            </Button>
            <Button onClick={() => act("more_info_needed")} disabled={pending} variant="outline">
              <MessageCircleQuestion className="w-4 h-4 mr-1" /> Request Info
            </Button>
            <Button onClick={() => act("reject")} disabled={pending} variant="outline" className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
              <XCircle className="w-4 h-4 mr-1" /> Reject
            </Button>
          </div>
        </div>
      ) : (
        <div className="border-t pt-4 text-sm text-muted-foreground">
          Reviewed on {app.reviewedAt ? new Date(app.reviewedAt).toLocaleString("en-AE") : "—"}
          {app.supplierIdCreated && (
            <> · <a className="text-[#1e6ab0] underline" href="/procurement/suppliers">View in suppliers</a></>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <div className="border rounded-xl p-3 bg-muted/20">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-[#1e6ab0]" />
        <div className="text-sm font-semibold">{title}</div>
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string | number | boolean | null | undefined }) {
  if (v === null || v === undefined || v === "") return null;
  return (
    <div className="flex items-start gap-2 text-sm">
      <div className="text-muted-foreground w-36 shrink-0">{k}</div>
      <div className="font-medium break-words flex-1">{String(v)}</div>
    </div>
  );
}
