import { useState } from "react";
import {
  useListSupplierApplications,
  useGetSupplierApplication,
  useDecideSupplierApplication,
  getListSupplierApplicationsQueryKey,
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
  Phone, MapPin, Calendar, Tags, Banknote, Paperclip, Download, Loader2, FileText,
} from "lucide-react";

const STATUS_BADGES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  needs_info: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  needs_info: "Needs Info",
};

export function SupplierApplicationsList() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [openId, setOpenId] = useState<number | null>(null);
  const { filterByCompany } = useActiveCompany();
  const { data, isLoading } = useListSupplierApplications(
    statusFilter === "all" ? {} : { status: statusFilter }
  );
  const filtered = filterByCompany((data ?? []) as any[]);

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
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="needs_info">Needs Info</TabsTrigger>
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
              filtered.map((a: any) => (
                <TableRow key={a.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setOpenId(a.id)}>
                  <TableCell className="font-mono text-xs text-[#1e6ab0]">{a.refNumber}</TableCell>
                  <TableCell className="font-medium">{a.companyName}</TableCell>
                  <TableCell>
                    <div className="text-sm">{a.contactPerson}</div>
                    <div className="text-[11px] text-muted-foreground">{a.email}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(a.categories ?? []).slice(0, 2).map((c: string) => (
                        <span key={c} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{c}</span>
                      ))}
                      {(a.categories ?? []).length > 2 && (
                        <span className="text-[10px] text-muted-foreground">+{a.categories.length - 2}</span>
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
              ))
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
  const { data: app, isLoading } = useGetSupplierApplication(id ?? 0, { query: { enabled: !!id } as never });
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

  function act(decision: "approve" | "reject" | "needs_info") {
    if (!id) return;
    decide.mutate({ id, data: { decision, notes: notes || undefined } as any });
  }

  return (
    <Sheet open={!!id} onOpenChange={v => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-[#1e6ab0]" />
            Supplier Application
          </SheetTitle>
        </SheetHeader>

        {isLoading || !app ? (
          <div className="py-12 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-mono text-xs text-[#1e6ab0]">{(app as any).refNumber}</div>
                <div className="text-xl font-bold">{(app as any).companyName}</div>
              </div>
              <Badge variant="secondary" className={STATUS_BADGES[(app as any).status] ?? ""}>
                {STATUS_LABELS[(app as any).status] ?? (app as any).status}
              </Badge>
            </div>

            <Section icon={Building2} title="Company">
              <KV k="Trade License" v={(app as any).tradeLicenseNo} />
              <KV k="License Expiry" v={(app as any).licenseExpiry} />
              <KV k="Established" v={(app as any).establishedYear} />
              <KV k="Size" v={(app as any).companySize} />
              <KV k="Country / City" v={[(app as any).country, (app as any).city].filter(Boolean).join(", ")} />
              <KV k="Website" v={(app as any).website} />
              <KV k="Address" v={(app as any).address} />
            </Section>

            <Section icon={Mail} title="Contact">
              <KV k="Person" v={`${(app as any).contactPerson}${(app as any).designation ? ` (${(app as any).designation})` : ""}`} />
              <KV k="Email" v={(app as any).email} />
              <KV k="Phone" v={(app as any).phone} />
              <KV k="WhatsApp" v={(app as any).whatsapp} />
              <KV k="TRN" v={(app as any).trn} />
              <KV k="VAT Registered" v={(app as any).vatRegistered ? "Yes" : "No"} />
              <KV k="Chamber Membership" v={(app as any).chamberMembership} />
            </Section>

            <Section icon={Tags} title="Categories & Commercial">
              <div className="flex flex-wrap gap-1.5 mb-2">
                {((app as any).categories ?? []).map((c: string) => (
                  <span key={c} className="text-xs bg-[#1e6ab0]/10 text-[#1e6ab0] px-2 py-0.5 rounded-full">{c}</span>
                ))}
              </div>
              <KV k="Years Experience" v={(app as any).yearsExperience} />
              <KV k="Payment Terms" v={(app as any).paymentTerms} />
              <KV k="Delivery Terms" v={(app as any).deliveryTerms} />
              <KV k="Major Clients" v={(app as any).majorClients} />
            </Section>

            <Section icon={Banknote} title="Banking">
              <KV k="Bank" v={(app as any).bankName} />
              <KV k="Account Name" v={(app as any).bankAccountName} />
              <KV k="Account #" v={(app as any).bankAccountNumber} />
              <KV k="IBAN" v={(app as any).iban} />
              <KV k="SWIFT" v={(app as any).swift} />
              <KV k="Currency" v={(app as any).currency} />
            </Section>

            <Section icon={Paperclip} title={`Documents (${((app as any).attachments ?? []).length})`}>
              {((app as any).attachments ?? []).length === 0 ? (
                <div className="text-sm text-muted-foreground italic">No documents attached.</div>
              ) : (
                <div className="space-y-1.5">
                  {((app as any).attachments ?? []).map((f: any, idx: number) => (
                    <a
                      key={idx}
                      href={`/api/supplier-applications/${(app as any).id}/attachments/${idx}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between border rounded-lg p-2 hover:bg-muted/40"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{f.filename}</div>
                          <div className="text-[11px] text-muted-foreground">{(f.size / 1024).toFixed(1)} KB · {f.contentType}</div>
                        </div>
                      </div>
                      <Download className="w-4 h-4 text-muted-foreground shrink-0" />
                    </a>
                  ))}
                </div>
              )}
            </Section>

            {(app as any).reviewNotes && (
              <Section icon={MessageCircleQuestion} title="Previous Review Notes">
                <div className="text-sm whitespace-pre-wrap">{(app as any).reviewNotes}</div>
              </Section>
            )}

            {((app as any).status === "pending" || (app as any).status === "needs_info") ? (
              <div className="border-t pt-4 space-y-3 sticky bottom-0 bg-card -mx-6 px-6 pb-2">
                <div className="space-y-1">
                  <Label>Notes (optional — sent to applicant)</Label>
                  <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Reason for rejection / what additional info is needed..." />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => act("approve")} disabled={decide.isPending} className="bg-emerald-600 hover:bg-emerald-700">
                    <CheckCircle2 className="w-4 h-4 mr-1" /> Approve & Create Supplier
                  </Button>
                  <Button onClick={() => act("needs_info")} disabled={decide.isPending} variant="outline">
                    <MessageCircleQuestion className="w-4 h-4 mr-1" /> Request Info
                  </Button>
                  <Button onClick={() => act("reject")} disabled={decide.isPending} variant="outline" className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                    <XCircle className="w-4 h-4 mr-1" /> Reject
                  </Button>
                </div>
              </div>
            ) : (
              <div className="border-t pt-4 text-sm text-muted-foreground">
                Reviewed on {(app as any).reviewedAt ? new Date((app as any).reviewedAt).toLocaleString("en-AE") : "—"}
                {(app as any).supplierIdCreated && (
                  <> · <a className="text-[#1e6ab0] underline" href="/procurement/suppliers">View in suppliers</a></>
                )}
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
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

function KV({ k, v }: { k: string; v: any }) {
  if (!v) return null;
  return (
    <div className="flex items-start gap-2 text-sm">
      <div className="text-muted-foreground w-32 shrink-0">{k}</div>
      <div className="font-medium break-words flex-1">{String(v)}</div>
    </div>
  );
}
