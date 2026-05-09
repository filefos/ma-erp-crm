import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft, Building2, Mail, Phone, MapPin, User, Hash,
  FileText, ClipboardList, Receipt, TruckIcon, FileCheck,
  Download, Eye, Search, Loader2, ExternalLink, DollarSign,
  AlertCircle, RefreshCw, Banknote, Handshake, Stamp,
  CreditCard, CheckCircle2, Clock,
} from "lucide-react";
import { authHeaders } from "@/lib/ai-client";
import { HelpButton } from "@/components/help-button";

interface Props { id: string }

type DocStatus = string;

const BASE = import.meta.env.BASE_URL;

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtAED(n: number | string | null | undefined) {
  const v = Number(n ?? 0);
  return `AED ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STATUS_PILL: Record<string, string> = {
  draft:      "bg-gray-100 text-gray-700",
  approved:   "bg-blue-100 text-blue-800",
  sent:       "bg-purple-100 text-purple-800",
  accepted:   "bg-green-100 text-green-800",
  active:     "bg-green-100 text-green-800",
  paid:       "bg-emerald-100 text-emerald-800",
  overdue:    "bg-red-100 text-red-800",
  cancelled:  "bg-red-100 text-red-700",
  delivered:  "bg-green-100 text-green-800",
  dispatched: "bg-blue-100 text-blue-800",
  closed:     "bg-gray-100 text-gray-700",
  completed:  "bg-emerald-100 text-emerald-800",
  partial:    "bg-yellow-100 text-yellow-800",
};

function StatusBadge({ status }: { status: DocStatus }) {
  return (
    <Badge className={`capitalize text-xs ${STATUS_PILL[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status}
    </Badge>
  );
}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  bank_transfer: "Bank Transfer",
  cheque: "Cheque",
  cash: "Cash",
  online: "Online",
  card: "Card",
};

const PAYMENT_METHOD_COLOR: Record<string, string> = {
  bank_transfer: "bg-blue-100 text-blue-800",
  cheque:        "bg-purple-100 text-purple-800",
  cash:          "bg-green-100 text-green-800",
  online:        "bg-cyan-100 text-cyan-800",
  card:          "bg-orange-100 text-orange-800",
};

function PaymentMethodBadge({ method }: { method: string }) {
  return (
    <Badge className={`text-xs ${PAYMENT_METHOD_COLOR[method] ?? "bg-gray-100 text-gray-600"}`}>
      {PAYMENT_METHOD_LABEL[method] ?? method}
    </Badge>
  );
}

function DocSearch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative max-w-xs">
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input value={value} onChange={e => onChange(e.target.value)} placeholder="Filter…" className="pl-8 h-8 text-sm" />
    </div>
  );
}

function EmptyRow({ cols, msg }: { cols: number; msg: string }) {
  return (
    <TableRow>
      <TableCell colSpan={cols} className="text-center py-10 text-muted-foreground text-sm">{msg}</TableCell>
    </TableRow>
  );
}

export function CustomerProfile({ id }: Props) {
  const [, navigate] = useLocation();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}api/contacts/${id}/documents`, { headers: authHeaders() });
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />Loading customer profile…
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="max-w-3xl mx-auto p-8 text-center space-y-4">
        <AlertCircle className="w-10 h-10 mx-auto text-red-400" />
        <p className="text-muted-foreground">{error ?? "Customer not found."}</p>
        <Button variant="outline" onClick={load}><RefreshCw className="w-4 h-4 mr-2" />Retry</Button>
      </div>
    );
  }

  const {
    contact,
    quotations = [],
    lpos = [],
    proformas = [],
    invoices = [],
    deliveryNotes = [],
    undertakingLetters = [],
    handoverNotes = [],
    payments = [],
    summary,
  } = data as {
    contact: any;
    quotations: any[];
    lpos: any[];
    proformas: any[];
    invoices: any[];
    deliveryNotes: any[];
    undertakingLetters: any[];
    handoverNotes: any[];
    payments: any[];
    summary: {
      quotationCount: number;
      lpoCount: number;
      invoiceCount: number;
      deliveryCount: number;
      undertakingCount: number;
      handoverCount: number;
      paymentCount: number;
      totalInvoiced: number;
      totalPaid: number;
      outstandingBalance: number;
    };
  };

  const s = search.toLowerCase();
  const fq = (arr: any[], keys: string[]) =>
    s ? arr.filter(r => keys.some(k => String(r[k] ?? "").toLowerCase().includes(s))) : arr;

  const kpis = [
    { label: "Quotations",       value: summary.quotationCount,                     icon: FileText,     color: "text-blue-600",    bg: "bg-blue-50" },
    { label: "LPOs",             value: summary.lpoCount,                           icon: ClipboardList, color: "text-purple-600",  bg: "bg-purple-50" },
    { label: "Tax Invoices",     value: summary.invoiceCount,                       icon: Receipt,      color: "text-orange-600",   bg: "bg-orange-50" },
    { label: "Payments",         value: summary.paymentCount,                       icon: Banknote,     color: "text-teal-600",     bg: "bg-teal-50" },
    { label: "Total Invoiced",   value: fmtAED(summary.totalInvoiced),             icon: DollarSign,   color: "text-gray-700",     bg: "bg-gray-50" },
    { label: "Total Paid",       value: fmtAED(summary.totalPaid),                 icon: CheckCircle2, color: "text-emerald-600",  bg: "bg-emerald-50" },
    { label: "Outstanding",      value: fmtAED(summary.outstandingBalance),        icon: Clock,        color: summary.outstandingBalance > 0 ? "text-red-600" : "text-emerald-600", bg: summary.outstandingBalance > 0 ? "bg-red-50" : "bg-emerald-50" },
    { label: "Delivery Notes",   value: summary.deliveryCount ?? deliveryNotes.length, icon: TruckIcon, color: "text-sky-600",    bg: "bg-sky-50" },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">

      {/* Header */}
      <div className="flex items-start gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate("/crm/contacts")}>
          <ArrowLeft className="w-4 h-4 mr-1" />Back to Contacts
        </Button>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Refresh
          </Button>
          <HelpButton pageKey="customer_profile" />
        </div>
      </div>

      {/* Contact card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-start gap-5 flex-wrap">
          <div className="w-16 h-16 rounded-2xl bg-[#0f2d5a] flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
            {contact.name?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-[#0f2d5a]">{contact.name}</h1>
              {contact.clientCode && (
                <Badge className="font-mono bg-[#0f2d5a] text-[#c9a14a] border border-[#c9a14a]/30 text-xs">
                  {contact.clientCode}
                </Badge>
              )}
            </div>
            {contact.companyName && (
              <div className="flex items-center gap-1.5 text-gray-600">
                <Building2 className="w-4 h-4" />
                <span className="font-medium">{contact.companyName}</span>
                {contact.designation && <span className="text-muted-foreground">· {contact.designation}</span>}
              </div>
            )}
            <div className="flex flex-wrap gap-4 pt-1 text-sm text-muted-foreground">
              {contact.email && (
                <a href={`mailto:${contact.email}`} className="flex items-center gap-1 hover:text-[#1e6ab0]">
                  <Mail className="w-3.5 h-3.5" />{contact.email}
                </a>
              )}
              {contact.phone && (
                <a href={`tel:${contact.phone}`} className="flex items-center gap-1 hover:text-[#1e6ab0]">
                  <Phone className="w-3.5 h-3.5" />{contact.phone}
                </a>
              )}
              {contact.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />{contact.location}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {kpis.map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} className="border-0 shadow-sm">
            <CardContent className="p-3 text-center">
              <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mx-auto mb-1.5`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <div className={`font-bold text-sm leading-tight ${color}`}>{value}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide leading-tight">{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Outstanding balance highlight */}
      {summary.outstandingBalance > 0 && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <span className="text-red-700 font-medium">
            Outstanding balance: {fmtAED(summary.outstandingBalance)}
          </span>
          <span className="text-red-500 text-xs ml-auto">
            {fmtAED(summary.totalInvoiced)} invoiced · {fmtAED(summary.totalPaid)} received
          </span>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="quotations">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
          <TabsList className="h-9 flex-wrap gap-1">
            <TabsTrigger value="quotations">Quotations&nbsp;({quotations.length})</TabsTrigger>
            <TabsTrigger value="lpos">LPOs&nbsp;({lpos.length})</TabsTrigger>
            <TabsTrigger value="proformas">Proforma&nbsp;({proformas.length})</TabsTrigger>
            <TabsTrigger value="invoices">Invoices&nbsp;({invoices.length})</TabsTrigger>
            <TabsTrigger value="delivery">Delivery&nbsp;({deliveryNotes.length})</TabsTrigger>
            <TabsTrigger value="undertaking">Undertaking&nbsp;({undertakingLetters.length})</TabsTrigger>
            <TabsTrigger value="handover">Handover&nbsp;({handoverNotes.length})</TabsTrigger>
            <TabsTrigger value="payments">Payments&nbsp;({payments.length})</TabsTrigger>
          </TabsList>
          <DocSearch value={search} onChange={setSearch} />
        </div>

        {/* ── Quotations ── */}
        <TabsContent value="quotations">
          <div className="border rounded-lg bg-white overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Quotation #</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Grand Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fq(quotations, ["quotationNumber","projectName","clientName"]).length === 0
                  ? <EmptyRow cols={6} msg="No quotations found." />
                  : fq(quotations, ["quotationNumber","projectName","clientName"]).map((q: any) => (
                    <TableRow key={q.id} className="hover:bg-muted/20">
                      <TableCell className="font-mono font-bold text-[#0f2d5a]">{q.quotationNumber}</TableCell>
                      <TableCell className="text-sm max-w-[160px] truncate">{q.projectName || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtDate(q.createdAt)}</TableCell>
                      <TableCell className="font-medium">{fmtAED(q.grandTotal)}</TableCell>
                      <TableCell><StatusBadge status={q.status ?? "draft"} /></TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/sales/quotations/${q.id}`}><Eye className="w-3.5 h-3.5 mr-1" />View</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── LPOs ── */}
        <TabsContent value="lpos">
          <div className="border rounded-lg bg-white overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>LPO Number</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>LPO Value</TableHead>
                  <TableHead>Payment Terms</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fq(lpos, ["lpoNumber","clientName"]).length === 0
                  ? <EmptyRow cols={6} msg="No LPOs found." />
                  : fq(lpos, ["lpoNumber","clientName"]).map((l: any) => (
                    <TableRow key={l.id} className="hover:bg-muted/20">
                      <TableCell className="font-mono font-bold text-[#0f2d5a]">{l.lpoNumber}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtDate(l.lpoDate)}</TableCell>
                      <TableCell className="font-medium">{fmtAED(l.lpoValue)}</TableCell>
                      <TableCell className="text-sm max-w-[180px] truncate">{l.paymentTerms || "—"}</TableCell>
                      <TableCell><StatusBadge status={l.status ?? "active"} /></TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href="/sales/lpos"><ExternalLink className="w-3.5 h-3.5 mr-1" />LPO Register</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── Proforma Invoices ── */}
        <TabsContent value="proformas">
          <div className="border rounded-lg bg-white overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>PI Number</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Grand Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fq(proformas, ["piNumber","projectName","clientName"]).length === 0
                  ? <EmptyRow cols={6} msg="No proforma invoices found." />
                  : fq(proformas, ["piNumber","projectName","clientName"]).map((p: any) => (
                    <TableRow key={p.id} className="hover:bg-muted/20">
                      <TableCell className="font-mono font-bold text-[#0f2d5a]">{p.piNumber}</TableCell>
                      <TableCell className="text-sm max-w-[160px] truncate">{p.projectName || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtDate(p.createdAt)}</TableCell>
                      <TableCell className="font-medium">{fmtAED(p.grandTotal)}</TableCell>
                      <TableCell><StatusBadge status={p.status ?? "draft"} /></TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/sales/proforma-invoices/${p.id}`}><Eye className="w-3.5 h-3.5 mr-1" />View</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── Tax Invoices ── */}
        <TabsContent value="invoices">
          <div className="border rounded-lg bg-white overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Invoice Date</TableHead>
                  <TableHead>Grand Total</TableHead>
                  <TableHead>Payment Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fq(invoices, ["invoiceNumber","projectName","clientName"]).length === 0
                  ? <EmptyRow cols={6} msg="No tax invoices found." />
                  : fq(invoices, ["invoiceNumber","projectName","clientName"]).map((inv: any) => (
                    <TableRow key={inv.id} className="hover:bg-muted/20">
                      <TableCell className="font-mono font-bold text-[#0f2d5a]">{inv.invoiceNumber}</TableCell>
                      <TableCell className="text-sm max-w-[160px] truncate">{inv.projectName || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtDate(inv.invoiceDate || inv.createdAt)}</TableCell>
                      <TableCell className="font-medium">{fmtAED(inv.grandTotal)}</TableCell>
                      <TableCell><StatusBadge status={inv.paymentStatus ?? inv.status ?? "unpaid"} /></TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/accounts/invoices/${inv.id}`}><Eye className="w-3.5 h-3.5 mr-1" />View</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── Delivery Notes ── */}
        <TabsContent value="delivery">
          <div className="border rounded-lg bg-white overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>DN Number</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Delivery Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Signed Copy</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fq(deliveryNotes, ["dnNumber","projectName","clientName"]).length === 0
                  ? <EmptyRow cols={6} msg="No delivery notes found." />
                  : fq(deliveryNotes, ["dnNumber","projectName","clientName"]).map((dn: any) => {
                    const signedAtts: any[] = (dn.attachments ?? []).filter((a: any) => a.isSigned);
                    return (
                      <TableRow key={dn.id} className="hover:bg-muted/20">
                        <TableCell className="font-mono font-bold text-[#0f2d5a]">{dn.dnNumber}</TableCell>
                        <TableCell className="text-sm max-w-[160px] truncate">{dn.projectName || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{fmtDate(dn.deliveryDate)}</TableCell>
                        <TableCell><StatusBadge status={dn.status ?? "draft"} /></TableCell>
                        <TableCell>
                          {signedAtts.length > 0 ? (
                            <a
                              href={`data:${signedAtts[0].contentType};base64,${signedAtts[0].content}`}
                              download={signedAtts[0].filename}
                              className="flex items-center gap-1 text-sm text-emerald-700 hover:underline"
                            >
                              <Download className="w-3.5 h-3.5" />Signed ({signedAtts.length})
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Not uploaded</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/accounts/delivery-notes/${dn.id}`}><Eye className="w-3.5 h-3.5 mr-1" />View</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── Undertaking Letters ── */}
        <TabsContent value="undertaking">
          <div className="border rounded-lg bg-white overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>UL Number</TableHead>
                  <TableHead>LPO Ref</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Letter Date</TableHead>
                  <TableHead>Signed By</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fq(undertakingLetters, ["ulNumber","lpoNumber","projectRef","clientName","signedByName"]).length === 0
                  ? <EmptyRow cols={7} msg="No undertaking letters found." />
                  : fq(undertakingLetters, ["ulNumber","lpoNumber","projectRef","clientName","signedByName"]).map((ul: any) => (
                    <TableRow key={ul.id} className="hover:bg-muted/20">
                      <TableCell className="font-mono font-bold text-[#0f2d5a]">{ul.ulNumber}</TableCell>
                      <TableCell className="font-mono text-xs">{ul.lpoNumber || "—"}</TableCell>
                      <TableCell className="text-sm max-w-[120px] truncate">{ul.projectRef || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtDate(ul.letterDate)}</TableCell>
                      <TableCell className="text-sm">{ul.signedByName || "—"}</TableCell>
                      <TableCell><StatusBadge status={ul.status ?? "draft"} /></TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href="/sales/undertaking-letters"><ExternalLink className="w-3.5 h-3.5 mr-1" />View</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── Handover Notes ── */}
        <TabsContent value="handover">
          <div className="border rounded-lg bg-white overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>HON Number</TableHead>
                  <TableHead>LPO Ref</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Handover Date</TableHead>
                  <TableHead>Received By</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fq(handoverNotes, ["honNumber","lpoNumber","projectRef","clientName","receivedByName"]).length === 0
                  ? <EmptyRow cols={7} msg="No handover notes found." />
                  : fq(handoverNotes, ["honNumber","lpoNumber","projectRef","clientName","receivedByName"]).map((hon: any) => (
                    <TableRow key={hon.id} className="hover:bg-muted/20">
                      <TableCell className="font-mono font-bold text-[#0f2d5a]">{hon.honNumber}</TableCell>
                      <TableCell className="font-mono text-xs">{hon.lpoNumber || "—"}</TableCell>
                      <TableCell className="text-sm max-w-[120px] truncate">{hon.projectRef || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtDate(hon.handoverDate)}</TableCell>
                      <TableCell className="text-sm">{hon.receivedByName || hon.clientRepresentative || "—"}</TableCell>
                      <TableCell><StatusBadge status={hon.status ?? "draft"} /></TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href="/sales/handover-notes"><ExternalLink className="w-3.5 h-3.5 mr-1" />View</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── Payments Received ── */}
        <TabsContent value="payments">
          <div className="space-y-4">
            {/* Payment summary bar */}
            {payments.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                {(["bank_transfer","cheque","cash"] as const).map(method => {
                  const methodPayments = payments.filter((p: any) => p.paymentMethod === method);
                  const total = methodPayments.reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0);
                  return total > 0 ? (
                    <div key={method} className={`rounded-xl p-3 border ${PAYMENT_METHOD_COLOR[method] ?? "bg-gray-50"}`}>
                      <div className="text-xs font-medium uppercase tracking-wide mb-0.5">
                        {PAYMENT_METHOD_LABEL[method] ?? method}
                      </div>
                      <div className="font-bold text-sm">{fmtAED(total)}</div>
                      <div className="text-xs opacity-70">{methodPayments.length} payment{methodPayments.length !== 1 ? "s" : ""}</div>
                    </div>
                  ) : null;
                })}
              </div>
            )}

            <div className="border rounded-lg bg-white overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Payment #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Invoice Ref</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Attachments</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fq(payments, ["paymentNumber","customerName","invoiceRef","referenceNumber","notes"]).length === 0
                    ? <EmptyRow cols={8} msg="No payment records found for this customer." />
                    : fq(payments, ["paymentNumber","customerName","invoiceRef","referenceNumber","notes"]).map((pmt: any) => {
                      let attachments: any[] = [];
                      try { attachments = JSON.parse(pmt.attachments ?? "[]"); } catch { /* ignore */ }
                      return (
                        <TableRow key={pmt.id} className="hover:bg-muted/20">
                          <TableCell className="font-mono font-bold text-[#0f2d5a] text-xs">{pmt.paymentNumber}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{fmtDate(pmt.paymentDate)}</TableCell>
                          <TableCell><PaymentMethodBadge method={pmt.paymentMethod ?? "bank_transfer"} /></TableCell>
                          <TableCell className="font-mono text-xs">{pmt.invoiceRef || "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">{pmt.referenceNumber || "—"}</TableCell>
                          <TableCell className="font-bold text-emerald-700">{fmtAED(pmt.amount)}</TableCell>
                          <TableCell><StatusBadge status={pmt.status ?? "completed"} /></TableCell>
                          <TableCell>
                            {attachments.length > 0 ? (
                              <span className="flex items-center gap-1 text-xs text-blue-700">
                                <FileCheck className="w-3.5 h-3.5" />{attachments.length} file{attachments.length !== 1 ? "s" : ""}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">None</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </div>

            {payments.length > 0 && (
              <div className="flex items-center justify-between text-sm border-t pt-3">
                <span className="text-muted-foreground">{payments.length} payment record{payments.length !== 1 ? "s" : ""}</span>
                <div className="flex gap-6">
                  <span className="text-muted-foreground">Total invoiced: <span className="font-medium text-gray-800">{fmtAED(summary.totalInvoiced)}</span></span>
                  <span className="text-muted-foreground">Total received: <span className="font-bold text-emerald-700">{fmtAED(summary.totalPaid)}</span></span>
                  {summary.outstandingBalance > 0 && (
                    <span className="text-muted-foreground">Outstanding: <span className="font-bold text-red-600">{fmtAED(summary.outstandingBalance)}</span></span>
                  )}
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Footer info */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground border-t pt-3">
        {contact.clientCode && <span className="flex items-center gap-1"><Hash className="w-3 h-3" />Client code: {contact.clientCode}</span>}
        {contact.createdAt && <span className="flex items-center gap-1"><User className="w-3 h-3" />Contact since: {fmtDate(contact.createdAt)}</span>}
        {contact.notes && <span className="flex items-center gap-1 max-w-md truncate"><FileText className="w-3 h-3 flex-shrink-0" />{contact.notes}</span>}
      </div>
    </div>
  );
}
