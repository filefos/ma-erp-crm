import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft, Building2, Mail, Phone, MapPin, User, Hash,
  FileText, ClipboardList, Receipt, TruckIcon, FileCheck,
  Download, Eye, Search, Loader2, ExternalLink, DollarSign,
  AlertCircle, RefreshCw,
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
};

function StatusBadge({ status }: { status: DocStatus }) {
  return (
    <Badge className={`capitalize text-xs ${STATUS_PILL[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status}
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

  const { contact, quotations, lpos, proformas, invoices, deliveryNotes, summary } = data as {
    contact: any;
    quotations: any[];
    lpos: any[];
    proformas: any[];
    invoices: any[];
    deliveryNotes: any[];
    summary: { quotationCount: number; lpoCount: number; invoiceCount: number; totalInvoiced: number; totalPaid: number; outstandingBalance: number };
  };

  const s = search.toLowerCase();
  const fq = (arr: any[], keys: string[]) =>
    s ? arr.filter(r => keys.some(k => String(r[k] ?? "").toLowerCase().includes(s))) : arr;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-start gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate("/crm/contacts")}>
          <ArrowLeft className="w-4 h-4 mr-1" />Back to Contacts
        </Button>
        <div className="ml-auto flex gap-2">
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Quotations", value: summary.quotationCount, icon: FileText, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "LPOs Received", value: summary.lpoCount, icon: ClipboardList, color: "text-purple-600", bg: "bg-purple-50" },
          { label: "Tax Invoices", value: summary.invoiceCount, icon: Receipt, color: "text-orange-600", bg: "bg-orange-50" },
          { label: "Total Invoiced", value: fmtAED(summary.totalInvoiced), icon: DollarSign, color: "text-gray-700", bg: "bg-gray-50" },
          { label: "Total Paid", value: fmtAED(summary.totalPaid), icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Outstanding", value: fmtAED(summary.outstandingBalance), icon: DollarSign, color: summary.outstandingBalance > 0 ? "text-red-600" : "text-emerald-600", bg: summary.outstandingBalance > 0 ? "bg-red-50" : "bg-emerald-50" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} className="border-0 shadow-sm">
            <CardContent className="p-4 text-center">
              <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mx-auto mb-2`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <div className={`font-bold text-sm ${color}`}>{value}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="quotations">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <TabsList className="h-9">
            <TabsTrigger value="quotations">Quotations ({quotations.length})</TabsTrigger>
            <TabsTrigger value="lpos">LPOs ({lpos.length})</TabsTrigger>
            <TabsTrigger value="proformas">Proforma ({proformas.length})</TabsTrigger>
            <TabsTrigger value="invoices">Tax Invoices ({invoices.length})</TabsTrigger>
            <TabsTrigger value="delivery">Delivery Notes ({deliveryNotes.length})</TabsTrigger>
          </TabsList>
          <DocSearch value={search} onChange={setSearch} />
        </div>

        {/* Quotations */}
        <TabsContent value="quotations">
          <div className="border rounded-lg bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quotation #</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Grand Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fq(quotations, ["quotationNumber","projectName","clientName"]).length === 0
                  ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No quotations found.</TableCell></TableRow>
                  : fq(quotations, ["quotationNumber","projectName","clientName"]).map((q: any) => (
                    <TableRow key={q.id}>
                      <TableCell className="font-mono font-bold text-[#0f2d5a]">{q.quotationNumber}</TableCell>
                      <TableCell className="text-sm">{q.projectName || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtDate(q.createdAt)}</TableCell>
                      <TableCell className="font-medium">{fmtAED(q.grandTotal)}</TableCell>
                      <TableCell><StatusBadge status={q.status ?? "draft"} /></TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/sales/quotations/${q.id}`}>
                            <Eye className="w-3.5 h-3.5 mr-1" />View
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* LPOs */}
        <TabsContent value="lpos">
          <div className="border rounded-lg bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>LPO Number</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>LPO Value</TableHead>
                  <TableHead>Payment Terms</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fq(lpos, ["lpoNumber","clientName"]).length === 0
                  ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No LPOs found.</TableCell></TableRow>
                  : fq(lpos, ["lpoNumber","clientName"]).map((l: any) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-mono font-bold text-[#0f2d5a]">{l.lpoNumber}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtDate(l.lpoDate)}</TableCell>
                      <TableCell className="font-medium">{fmtAED(l.lpoValue)}</TableCell>
                      <TableCell className="text-sm max-w-[180px] truncate">{l.paymentTerms || "—"}</TableCell>
                      <TableCell><StatusBadge status={l.status ?? "active"} /></TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href="/sales/lpos">
                            <ExternalLink className="w-3.5 h-3.5 mr-1" />LPO Register
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Proforma Invoices */}
        <TabsContent value="proformas">
          <div className="border rounded-lg bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PI Number</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Grand Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fq(proformas, ["piNumber","projectName","clientName"]).length === 0
                  ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No proforma invoices found.</TableCell></TableRow>
                  : fq(proformas, ["piNumber","projectName","clientName"]).map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono font-bold text-[#0f2d5a]">{p.piNumber}</TableCell>
                      <TableCell className="text-sm">{p.projectName || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtDate(p.createdAt)}</TableCell>
                      <TableCell className="font-medium">{fmtAED(p.grandTotal)}</TableCell>
                      <TableCell><StatusBadge status={p.status ?? "draft"} /></TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/sales/proforma-invoices/${p.id}`}>
                            <Eye className="w-3.5 h-3.5 mr-1" />View
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Tax Invoices */}
        <TabsContent value="invoices">
          <div className="border rounded-lg bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Invoice Date</TableHead>
                  <TableHead>Grand Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fq(invoices, ["invoiceNumber","projectName","clientName"]).length === 0
                  ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No tax invoices found.</TableCell></TableRow>
                  : fq(invoices, ["invoiceNumber","projectName","clientName"]).map((inv: any) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono font-bold text-[#0f2d5a]">{inv.invoiceNumber}</TableCell>
                      <TableCell className="text-sm">{inv.projectName || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtDate(inv.invoiceDate || inv.createdAt)}</TableCell>
                      <TableCell className="font-medium">{fmtAED(inv.grandTotal)}</TableCell>
                      <TableCell><StatusBadge status={inv.status ?? "draft"} /></TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/accounts/invoices/${inv.id}`}>
                            <Eye className="w-3.5 h-3.5 mr-1" />View
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Delivery Notes */}
        <TabsContent value="delivery">
          <div className="border rounded-lg bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>DN Number</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Delivery Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Signed Copy</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fq(deliveryNotes, ["dnNumber","projectName","clientName"]).length === 0
                  ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No delivery notes found.</TableCell></TableRow>
                  : fq(deliveryNotes, ["dnNumber","projectName","clientName"]).map((dn: any) => {
                    const signedAtts: any[] = (dn.attachments ?? []).filter((a: any) => a.isSigned);
                    return (
                      <TableRow key={dn.id}>
                        <TableCell className="font-mono font-bold text-[#0f2d5a]">{dn.dnNumber}</TableCell>
                        <TableCell className="text-sm">{dn.projectName || "—"}</TableCell>
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
                            <span className="text-xs text-muted-foreground">Not uploaded</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/accounts/delivery-notes/${dn.id}`}>
                              <Eye className="w-3.5 h-3.5 mr-1" />View
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Info row */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground border-t pt-3">
        {contact.clientCode && <span className="flex items-center gap-1"><Hash className="w-3 h-3" />Client code: {contact.clientCode}</span>}
        {contact.createdAt && <span className="flex items-center gap-1"><User className="w-3 h-3" />Contact since: {fmtDate(contact.createdAt)}</span>}
      </div>
    </div>
  );
}
