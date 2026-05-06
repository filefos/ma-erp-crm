import {
  useGetDeliveryNote, getGetDeliveryNoteQueryKey,
  useGetTaxInvoice, getGetTaxInvoiceQueryKey,
  useListCompanies,
} from "@workspace/api-client-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { ArrowLeft, Receipt, Mail } from "lucide-react";
import { useEmailCompose } from "@/contexts/email-compose-context";
import { ExportButtons } from "@/components/export-buttons";
import { DocumentPrint } from "@/components/document-print";
import type { DocumentData } from "@/components/document-print";

interface Props { id: string }

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  dispatched: "bg-blue-100 text-blue-800",
  delivered: "bg-green-100 text-green-800",
};

export function DeliveryNoteDetail({ id }: Props) {
  const dnId = parseInt(id, 10);
  const { user } = useAuth();
  const { openCompose } = useEmailCompose();

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

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="no-print flex items-center gap-2">
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
          <Button
            size="sm" variant="outline"
            onClick={() => openCompose({
              toAddress: (dn as any).clientEmail ?? "",
              toName: dn.clientName ?? "",
              subject: `Delivery Note ${dn.dnNumber ?? ""} – ${dn.projectName ?? dn.clientName ?? ""}`,
              body: `Dear ${dn.clientName ?? "Sir/Madam"},\n\nPlease find attached Delivery Note ${dn.dnNumber ?? ""} for ${dn.projectName ?? "your project"}.\n\nDelivery Status: ${dn.status ?? ""}\n\nKindly acknowledge receipt of the delivered items.\n\nBest regards,\nPrime Max Prefab`,
              clientName: dn.clientName ?? "",
              sourceRef: dn.dnNumber ?? "",
              companyId: dn.companyId ?? undefined,
            })}
          >
            <Mail className="w-4 h-4 mr-1" />Send Email
          </Button>
          <ExportButtons docNumber={dn.dnNumber ?? dn.id?.toString() ?? "DN"} recipientPhone={(dn as any).clientPhone ?? undefined} recipientEmail={(dn as any).clientEmail ?? undefined} companyId={dn.companyId ?? undefined} docTypeLabel="Delivery Note" />
        </div>
      </div>
      <DocumentPrint data={docData} />
    </div>
  );
}
