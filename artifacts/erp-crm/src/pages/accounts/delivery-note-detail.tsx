import {
  useGetDeliveryNote, getGetDeliveryNoteQueryKey,
  useGetTaxInvoice, getGetTaxInvoiceQueryKey,
  useListCompanies,
} from "@workspace/api-client-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { useState, useRef } from "react";
import { captureElementToPdfBase64 } from "@/lib/print-to-pdf";
import { ArrowLeft, Receipt, Mail, Loader2, Upload, Download, Trash2, FileCheck, Paperclip, AlertCircle } from "lucide-react";
import { useEmailCompose } from "@/contexts/email-compose-context";
import { ExportButtons } from "@/components/export-buttons";
import { DocumentPrint } from "@/components/document-print";
import type { DocumentData } from "@/components/document-print";
import { HelpButton } from "@/components/help-button";
import { authHeaders } from "@/lib/ai-client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface Props { id: string }

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  dispatched: "bg-blue-100 text-blue-800",
  delivered: "bg-green-100 text-green-800",
};

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

const BASE = import.meta.env.BASE_URL;
const MAX_MB = 20;

export function DeliveryNoteDetail({ id }: Props) {
  const dnId = parseInt(id, 10);
  const { user } = useAuth();
  const { openCompose } = useEmailCompose();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [uploading, setUploading] = useState(false);
  const signedInputRef = useRef<HTMLInputElement>(null);

  const { data: dn, isLoading } = useGetDeliveryNote(dnId, {
    query: { queryKey: getGetDeliveryNoteQueryKey(dnId), enabled: !!dnId },
  });
  const { data: companies } = useListCompanies();
  const tInvId = (dn as any)?.taxInvoiceId as number | undefined;
  const { data: taxInv } = useGetTaxInvoice(tInvId!, {
    query: { queryKey: getGetTaxInvoiceQueryKey(tInvId!), enabled: !!tInvId },
  });

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading…</div>;
  if (!dn) return <div className="text-muted-foreground p-8">Delivery Note not found.</div>;

  const items = ((dn as any).items ?? []) as { description: string; quantity: number; unit?: string }[];
  const allAttachments: any[] = (dn as any).attachments ?? [];
  const signedAtts = allAttachments.filter((a: any) => a.isSigned);
  const otherAtts = allAttachments.filter((a: any) => !a.isSigned);

  const docData: DocumentData = {
    type: "delivery_note",
    docNumber: dn.dnNumber,
    companyId: dn.companyId,
    companyRef: (dn as any).companyRef,
    clientName: dn.clientName,
    projectName: dn.projectName,
    projectRef: (dn as any).projectRef ?? undefined,
    deliveryLocation: dn.deliveryLocation,
    vehicleNumber: dn.vehicleNumber,
    driverName: dn.driverName,
    receiverName: dn.receiverName,
    deliveryDate: dn.deliveryDate
      ? new Date(dn.deliveryDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
      : undefined,
    grandTotal: 0,
    items: items.map(i => ({
      description: i.description,
      quantity: i.quantity,
      unit: i.unit,
    })),
    companyLogo: (companies?.find((c: any) => c.id === dn.companyId) as any)?.logo ?? undefined,
    printedByUniqueId: (user as any)?.uniqueUserId ?? undefined,
    clientCode: (dn as any).clientCode ?? undefined,
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetDeliveryNoteQueryKey(dnId) });
  };

  const handleSignedUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_MB * 1024 * 1024) {
      toast({ title: `File too large (max ${MAX_MB} MB)`, variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1] ?? "");
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const newAtt = {
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        size: file.size,
        content: base64,
        isSigned: true,
        uploadedAt: new Date().toISOString(),
        uploadedBy: (user as any)?.name ?? "Unknown",
      };
      const updatedAtts = [...allAttachments, newAtt];
      const res = await fetch(`${BASE}api/delivery-notes/${dnId}`, {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ attachments: updatedAtts, companyId: dn.companyId }),
      });
      if (!res.ok) throw new Error(await res.text());
      invalidate();
      toast({ title: "Signed delivery note uploaded." });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
      if (signedInputRef.current) signedInputRef.current.value = "";
    }
  };

  const handleDeleteSigned = async (idx: number) => {
    const signedIdx = allAttachments.findIndex((a: any) => a.isSigned && allAttachments.filter((b: any) => b.isSigned).indexOf(a) === idx);
    if (signedIdx === -1) return;
    const updatedAtts = allAttachments.filter((_, i) => i !== signedIdx);
    setUploading(true);
    try {
      const res = await fetch(`${BASE}api/delivery-notes/${dnId}`, {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ attachments: updatedAtts, companyId: dn.companyId }),
      });
      if (!res.ok) throw new Error(await res.text());
      invalidate();
      toast({ title: "Signed copy removed." });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Delete failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="no-print flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/accounts/delivery-notes"><ArrowLeft className="w-4 h-4 mr-1" />Back</Link>
        </Button>
        <Badge className={`capitalize ${STATUS_COLORS[dn.status] ?? "bg-gray-100"}`}>{dn.status}</Badge>
        {(dn as any)?.projectRef && (
          <Badge className="bg-[#0f2d5a] text-white border border-blue-300/40 font-mono text-[11px] tracking-wide px-2.5">
            PROJECT ID: {(dn as any).projectRef}
          </Badge>
        )}
        {(dn as any)?.clientCode && (
          <Badge className="bg-[#0f2d5a] text-[#c9a14a] border border-[#c9a14a]/30 font-mono text-[11px] tracking-wide">
            {(dn as any).clientCode}
          </Badge>
        )}
        {tInvId ? (
          <Button size="sm" variant="outline" asChild>
            <Link href={`/accounts/invoices/${tInvId}`}>
              <Receipt className="w-4 h-4 mr-1" />Tax Invoice {(taxInv as any)?.invoiceNumber ?? `#${tInvId}`}
            </Link>
          </Button>
        ) : null}
        <div className="ml-auto flex gap-2">
          <HelpButton pageKey="delivery_notes" />
          <Button
            size="sm" variant="outline"
            disabled={generatingPdf}
            onClick={async () => {
              const docEl = document.querySelector<HTMLElement>(".print-doc");
              let attachments: { filename: string; content: string; contentType: string; size: number }[] = [];
              if (docEl) {
                setGeneratingPdf(true);
                try {
                  const filename = `DeliveryNote_${dn.dnNumber ?? dn.id ?? "doc"}.pdf`;
                  const signatureUrl = user?.signatureUrl || undefined;
                  const stampUrl = companies?.find(c => c.id === dn.companyId)?.stamp || undefined;
                  const { base64 } = await captureElementToPdfBase64(docEl, filename, { signatureUrl, stampUrl });
                  attachments = [{ filename, content: base64, contentType: "application/pdf", size: Math.round(base64.length * 0.75) }];
                } catch { /* fall through */ } finally { setGeneratingPdf(false); }
              }
              openCompose({
                toAddress: (dn as any).clientEmail ?? "",
                toName: dn.clientName ?? "",
                subject: `Delivery Note ${dn.dnNumber ?? ""} – ${dn.projectName ?? dn.clientName ?? ""}`,
                body: `Dear ${dn.clientName ?? "Sir/Madam"},\n\nPlease find attached Delivery Note ${dn.dnNumber ?? ""} for ${dn.projectName ?? "your project"}.\n\nDelivery Status: ${dn.status ?? ""}\n\nKindly acknowledge receipt of the delivered items.\n\nBest regards,\nPrime Max Prefab`,
                clientName: dn.clientName ?? "",
                sourceRef: dn.dnNumber ?? "",
                companyId: dn.companyId ?? undefined,
                attachments,
              });
            }}
          >
            {generatingPdf ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Preparing PDF…</> : <><Mail className="w-4 h-4 mr-1" />Send Email</>}
          </Button>
          <ExportButtons docNumber={dn.dnNumber ?? dn.id?.toString() ?? "DN"} recipientPhone={(dn as any).clientPhone ?? undefined} recipientEmail={(dn as any).clientEmail ?? undefined} companyId={dn.companyId ?? undefined} docTypeLabel="Delivery Note" signatureUrl={user?.signatureUrl ?? undefined} stampUrl={companies?.find(c => c.id === dn.companyId)?.stamp ?? undefined} />
        </div>
      </div>

      <DocumentPrint data={docData} />

      {/* ── Signed Delivery Note Section ── */}
      <div className="no-print bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <FileCheck className="w-4.5 h-4.5 text-emerald-700" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800 text-sm">Signed Delivery Note</h3>
            <p className="text-xs text-muted-foreground">Upload the client-signed copy as proof of delivery</p>
          </div>
          <div className="ml-auto">
            <input
              ref={signedInputRef}
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={handleSignedUpload}
            />
            <Button
              size="sm"
              variant="outline"
              className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              disabled={uploading}
              onClick={() => signedInputRef.current?.click()}
            >
              {uploading
                ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Uploading…</>
                : <><Upload className="w-3.5 h-3.5 mr-1.5" />Upload Signed Copy</>}
            </Button>
          </div>
        </div>

        {signedAtts.length === 0 ? (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            No signed copy uploaded yet. Upload the client-signed delivery note to confirm delivery.
          </div>
        ) : (
          <div className="space-y-2">
            {signedAtts.map((att: any, i: number) => (
              <div key={i} className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                <FileCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-emerald-900 truncate">{att.filename}</div>
                  <div className="text-xs text-emerald-600 mt-0.5">
                    {formatBytes(att.size ?? 0)}
                    {att.uploadedAt && ` · Uploaded ${new Date(att.uploadedAt).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" })}`}
                    {att.uploadedBy && ` by ${att.uploadedBy}`}
                  </div>
                </div>
                <a
                  href={`data:${att.contentType};base64,${att.content}`}
                  download={att.filename}
                  className="flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-900 border border-emerald-300 rounded-md px-2 py-1 hover:bg-emerald-100 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />Download
                </a>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-7 h-7 text-red-400 hover:text-red-600 hover:bg-red-50"
                  disabled={uploading}
                  onClick={() => handleDeleteSigned(i)}
                  title="Remove signed copy"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Other attachments */}
        {otherAtts.length > 0 && (
          <div className="border-t pt-3 space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Paperclip className="w-3.5 h-3.5" />
              <span>Other attachments ({otherAtts.length})</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {otherAtts.map((att: any, i: number) => (
                <a
                  key={i}
                  href={`data:${att.contentType};base64,${att.content}`}
                  download={att.filename}
                  className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 hover:bg-blue-50 hover:border-[#1e6ab0] transition-colors text-xs"
                >
                  <Download className="w-3.5 h-3.5 text-[#1e6ab0]" />
                  <span className="truncate max-w-[140px]">{att.filename}</span>
                  <span className="text-muted-foreground">{formatBytes(att.size ?? 0)}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
