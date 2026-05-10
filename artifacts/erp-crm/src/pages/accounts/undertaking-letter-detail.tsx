import { useRef, useState } from "react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import {
  useGetUndertakingLetter, getGetUndertakingLetterQueryKey,
  useUpdateUndertakingLetter, useListCompanies,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";
import { ArrowLeft, Pencil, CheckCircle, Download, Printer, Mail, Loader2, Stamp, PenLine } from "lucide-react";
import { useEmailCompose } from "@/contexts/email-compose-context";
import { ExportButtons } from "@/components/export-buttons";
import { UndertakingLetterTemplate } from "@/components/undertaking-letter-template";
import { useToast } from "@/hooks/use-toast";
import { captureElementToPdfBase64, stampAndPrint } from "@/lib/print-to-pdf";

interface Props { id: string }

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  issued: "bg-blue-100 text-blue-800",
  signed: "bg-green-100 text-green-800",
};

export function UndertakingLetterDetail({ id }: Props) {
  const { activeCompanyId } = useActiveCompany();
  const isElite = activeCompanyId === 2;
  const primeBtnCls = isElite ? "bg-[#0D0D0D] hover:bg-[#8B0000]" : "bg-[#0f2d5a] hover:bg-[#1e6ab0]";
  const ulId = parseInt(id, 10);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { openCompose } = useEmailCompose();
  const printRef = useRef<HTMLDivElement>(null);
  const [editMode, setEditMode] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [stampVisible, setStampVisible] = useState(true);
  const [signatureVisible, setSignatureVisible] = useState(true);

  const { user } = useAuth();
  const { data: companies } = useListCompanies();

  const { data: ul, isLoading } = useGetUndertakingLetter(ulId, {
    query: { queryKey: getGetUndertakingLetterQueryKey(ulId), enabled: !!ulId },
  });

  const [form, setForm] = useState<Record<string, string>>({});

  const openEdit = () => {
    if (!ul) return;
    setForm({
      letterDate: (ul as any).letterDate ?? "",
      scope: (ul as any).scope ?? "",
      commitmentText: (ul as any).commitmentText ?? "",
      signedByName: (ul as any).signedByName ?? "",
      signedDate: (ul as any).signedDate ?? "",
      status: ul.status ?? "draft",
      notes: (ul as any).notes ?? "",
    });
    setEditMode(true);
  };

  const updateMutation = useUpdateUndertakingLetter({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetUndertakingLetterQueryKey(ulId) });
        queryClient.invalidateQueries({ queryKey: ["/undertaking-letters"] });
        setEditMode(false);
        toast({ title: "Undertaking Letter updated." });
      },
      onError: (e: any) => toast({ title: e?.message ?? "Failed", variant: "destructive" }),
    },
  });

  const handlePrint = async () => {
    if (!printRef.current || !ul) return;

    // Open synchronously while still in the user-gesture stack so browsers
    // don't block it as a popup.
    const win = window.open("", "_blank");
    if (!win) {
      toast({ title: "Pop-up blocked. Please allow pop-ups for this site and try again.", variant: "destructive" });
      return;
    }

    setPrinting(true);
    try {
      const signatureUrl = user?.signatureUrl || undefined;
      const stampUrl = companies?.find(c => c.id === (ul as any).companyId)?.stamp || undefined;
      await stampAndPrint(win, printRef.current, ul.ulNumber ?? "UL", signatureUrl, stampUrl);
    } catch {
      toast({ title: "Print preparation failed. Try Export PDF instead.", variant: "destructive" });
      win.close();
    } finally {
      setPrinting(false);
    }
  };

  const handleExportPdf = async () => {
    if (!printRef.current || !ul) return;
    setExporting(true);
    try {
      const signatureUrl = user?.signatureUrl || undefined;
      const co = companies?.find(c => c.id === (ul as any).companyId);
      const stampUrl = co?.stamp || undefined;
      const stampWidthPct = co?.stampWidthPct ?? undefined;
      const stampMarginPct = co?.stampMarginPct ?? undefined;
      const { base64, filename } = await captureElementToPdfBase64(printRef.current, `${ul.ulNumber}.pdf`, { signatureUrl, stampUrl, stampWidthPct, stampMarginPct });
      const link = document.createElement("a");
      link.href = `data:application/pdf;base64,${base64}`;
      link.download = filename;
      link.click();
    } catch {
      toast({ title: "PDF export failed.", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading…</div>;
  if (!ul) return <div className="text-muted-foreground p-8">Undertaking Letter not found.</div>;

  const docForTemplate = {
    ulNumber: ul.ulNumber,
    letterDate: (ul as any).letterDate ?? null,
    clientName: ul.clientName,
    lpoNumber: (ul as any).lpoNumber ?? null,
    projectRef: (ul as any).projectRef ?? null,
    scope: (ul as any).scope ?? null,
    commitmentText: (ul as any).commitmentText ?? null,
    signedByName: (ul as any).signedByName ?? null,
    signedDate: (ul as any).signedDate ?? null,
    notes: (ul as any).notes ?? null,
    companyId: (ul as any).companyId ?? 1,
    signatureUrl: signatureVisible ? (user?.signatureUrl ?? null) : null,
    stampUrl: stampVisible ? (companies?.find(c => c.id === ((ul as any).companyId ?? 1))?.stamp ?? null) : null,
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Action bar — two rows, hidden on print */}
      <div className="no-print space-y-2">
        {/* Row 1: nav + status + edit | stamp/sig toggles */}
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/accounts/undertaking-letters">
              <ArrowLeft className="w-4 h-4 mr-1" />Back
            </Link>
          </Button>
          <Badge className={`capitalize ${STATUS_COLORS[ul.status] ?? "bg-gray-100"}`}>
            {ul.status}
          </Badge>
          {(ul as any)?.projectRef && (
            <Badge className="bg-[#0f2d5a] text-white border border-blue-300/40 font-mono text-[11px] tracking-wide px-2.5">
              PROJECT ID: {(ul as any).projectRef}
            </Badge>
          )}
          <span className="font-mono text-sm text-muted-foreground">{ul.ulNumber}</span>
          {!editMode && (
            <Button size="sm" variant="outline" onClick={openEdit}>
              <Pencil className="w-3.5 h-3.5 mr-1.5" />Edit
            </Button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              variant={stampVisible ? "default" : "outline"}
              className={stampVisible ? "bg-violet-600 hover:bg-violet-700 text-white" : "text-violet-600 border-violet-400"}
              onClick={() => setStampVisible(v => !v)}
            >
              <Stamp className="w-3.5 h-3.5 mr-1" />P.STAMP
            </Button>
            <Button
              size="sm"
              variant={signatureVisible ? "default" : "outline"}
              className={signatureVisible ? "bg-orange-500 hover:bg-orange-600 text-white" : "text-orange-500 border-orange-400"}
              onClick={() => setSignatureVisible(v => !v)}
            >
              <PenLine className="w-3.5 h-3.5 mr-1" />P.SIGNATURE
            </Button>
          </div>
        </div>

        {/* Row 2: document action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm" variant="outline"
            disabled={generatingPdf}
            onClick={async () => {
              const el = printRef.current;
              let attachments: { filename: string; content: string; contentType: string; size: number }[] = [];
              if (el) {
                setGeneratingPdf(true);
                try {
                  const filename = `UndertakingLetter_${ul.ulNumber ?? ul.id ?? "doc"}.pdf`;
                  const signatureUrl = user?.signatureUrl || undefined;
                  const co = companies?.find(c => c.id === (ul as any).companyId);
                  const stampUrl = co?.stamp || undefined;
                  const stampWidthPct = co?.stampWidthPct ?? undefined;
                  const stampMarginPct = co?.stampMarginPct ?? undefined;
                  const { base64 } = await captureElementToPdfBase64(el, filename, { signatureUrl, stampUrl, stampWidthPct, stampMarginPct });
                  attachments = [{ filename, content: base64, contentType: "application/pdf", size: Math.round(base64.length * 0.75) }];
                } catch { /* fall through */ } finally { setGeneratingPdf(false); }
              }
              openCompose({
                toAddress: "",
                toName: ul.clientName ?? "",
                subject: `Undertaking Letter ${ul.ulNumber ?? ""} – ${ul.clientName ?? ""}`,
                body: `Dear ${ul.clientName ?? "Sir/Madam"},\n\nPlease find attached our Undertaking Letter ${ul.ulNumber ?? ""} as per your request.\n\nKindly review and confirm your receipt.\n\nBest regards,\nPrime Max Prefab`,
                clientName: ul.clientName ?? "",
                sourceRef: ul.ulNumber ?? "",
                companyId: (ul as any).companyId ?? undefined,
                attachments,
              });
            }}
          >
            {generatingPdf ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Preparing PDF…</> : <><Mail className="w-4 h-4 mr-1.5" />Send Email</>}
          </Button>
          <Button size="sm" variant="outline" onClick={handlePrint} disabled={printing}>
            {printing ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Preparing…</> : <><Printer className="w-4 h-4 mr-1.5" />Print / PDF</>}
          </Button>
          <Button size="sm" variant="outline" onClick={handleExportPdf} disabled={exporting}>
            <Download className="w-4 h-4 mr-1.5" />{exporting ? "Exporting…" : "Export PDF"}
          </Button>
          <ExportButtons
            docNumber={ul.ulNumber ?? ul.id?.toString() ?? "UL"}
            recipientPhone={undefined}
            recipientEmail={undefined}
            companyId={(ul as any).companyId ?? undefined}
            docTypeLabel="Undertaking Letter"
            signatureUrl={user?.signatureUrl ?? undefined}
            stampUrl={companies?.find(c => c.id === (ul as any).companyId)?.stamp ?? undefined}
            stampWidthPct={companies?.find(c => c.id === (ul as any).companyId)?.stampWidthPct ?? undefined}
            stampMarginPct={companies?.find(c => c.id === (ul as any).companyId)?.stampMarginPct ?? undefined}
          />
        </div>
      </div>

      {/* Edit form */}
      {editMode && (
        <div className="no-print border rounded-lg p-4 bg-card space-y-4">
          <h3 className="font-semibold text-[#0f2d5a]">Edit Undertaking Letter</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Letter Date</Label>
              <Input type="date" value={form.letterDate} onChange={e => setForm(p => ({ ...p, letterDate: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="issued">Issued</SelectItem>
                  <SelectItem value="signed">Signed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Project / Scope Description</Label>
              <Textarea rows={2} value={form.scope} onChange={e => setForm(p => ({ ...p, scope: e.target.value }))} />
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Commitment Text (override)</Label>
              <Textarea rows={3} value={form.commitmentText} onChange={e => setForm(p => ({ ...p, commitmentText: e.target.value }))} placeholder="Leave blank to use default fire-rated materials commitment text" />
            </div>
            <div className="space-y-1">
              <Label>Signed By</Label>
              <Input value={form.signedByName} onChange={e => setForm(p => ({ ...p, signedByName: e.target.value }))} placeholder="Authorised signatory name" />
            </div>
            <div className="space-y-1">
              <Label>Signed Date</Label>
              <Input type="date" value={form.signedDate} onChange={e => setForm(p => ({ ...p, signedDate: e.target.value }))} />
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Notes</Label>
              <Textarea rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => setEditMode(false)}>Cancel</Button>
            <Button
              className={primeBtnCls}
              onClick={() => updateMutation.mutate({ id: ulId, data: form as any })}
              disabled={updateMutation.isPending}
            >
              <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
              {updateMutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </div>
      )}

      {/* Document rendered inline — same as delivery note */}
      <UndertakingLetterTemplate ref={printRef} doc={docForTemplate} />
    </div>
  );
}
