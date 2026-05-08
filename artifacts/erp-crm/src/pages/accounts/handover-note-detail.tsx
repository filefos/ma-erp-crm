import { useRef, useState } from "react";
import {
  useGetHandoverNote, getGetHandoverNoteQueryKey,
  useUpdateHandoverNote, useListCompanies,
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
import { ArrowLeft, Pencil, CheckCircle, Download, Printer, Plus, Trash2, Mail, Loader2 } from "lucide-react";
import { useEmailCompose } from "@/contexts/email-compose-context";
import { ExportButtons } from "@/components/export-buttons";
import { HandoverNoteTemplate } from "@/components/handover-note-template";
import { useToast } from "@/hooks/use-toast";
import { captureElementToPdfBase64 } from "@/lib/print-to-pdf";

interface Props { id: string }

interface HandoverItem { description: string; quantity: number; unit: string; }

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  completed: "bg-blue-100 text-blue-800",
  signed: "bg-green-100 text-green-800",
};

const EMPTY_ITEM = (): HandoverItem => ({ description: "", quantity: 1, unit: "nos" });

export function HandoverNoteDetail({ id }: Props) {
  const honId = parseInt(id, 10);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { openCompose } = useEmailCompose();
  const printRef = useRef<HTMLDivElement>(null);
  const [editMode, setEditMode] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [form, setForm] = useState({
    handoverDate: "", projectDescription: "", receivedByName: "",
    receivedByDesignation: "", clientRepresentative: "",
    status: "draft", notes: "", items: [EMPTY_ITEM()] as HandoverItem[],
  });

  const { user } = useAuth();
  const { data: companies } = useListCompanies();

  const { data: hon, isLoading } = useGetHandoverNote(honId, {
    query: { queryKey: getGetHandoverNoteQueryKey(honId), enabled: !!honId },
  });

  const openEdit = () => {
    if (!hon) return;
    const rawItems = (hon as any).itemsHandedOver;
    let items: HandoverItem[] = [];
    try { items = typeof rawItems === "string" ? JSON.parse(rawItems) : (rawItems ?? []); } catch { items = []; }
    setForm({
      handoverDate: (hon as any).handoverDate ?? "",
      projectDescription: (hon as any).projectDescription ?? "",
      receivedByName: (hon as any).receivedByName ?? "",
      receivedByDesignation: (hon as any).receivedByDesignation ?? "",
      clientRepresentative: (hon as any).clientRepresentative ?? "",
      status: hon.status ?? "draft",
      notes: (hon as any).notes ?? "",
      items: items.length > 0 ? items : [EMPTY_ITEM()],
    });
    setEditMode(true);
  };

  const updateMutation = useUpdateHandoverNote({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetHandoverNoteQueryKey(honId) });
        queryClient.invalidateQueries({ queryKey: ["/handover-notes"] });
        setEditMode(false);
        toast({ title: "Handover Note updated." });
      },
      onError: (e: any) => toast({ title: e?.message ?? "Failed", variant: "destructive" }),
    },
  });

  const updateItem = (idx: number, field: keyof HandoverItem, value: string | number) =>
    setForm(p => ({ ...p, items: p.items.map((it, i) => i === idx ? { ...it, [field]: value } : it) }));
  const addItem = () => setForm(p => ({ ...p, items: [...p.items, EMPTY_ITEM()] }));
  const removeItem = (idx: number) => setForm(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));

  const handlePrint = () => {
    if (!printRef.current || !hon) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head>
      <title>${hon.honNumber}</title>
      <style>
        @page { size: A4 portrait; margin: 0; }
        body { margin: 0; padding: 0; background: white; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      </style>
    </head><body>${printRef.current.outerHTML}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  const handleExportPdf = async () => {
    if (!printRef.current || !hon) return;
    setExporting(true);
    try {
      const signatureUrl = user?.signatureUrl || undefined;
      const stampUrl = companies?.find(c => c.id === (hon as any).companyId)?.stamp || undefined;
      const { base64, filename } = await captureElementToPdfBase64(printRef.current, `${hon.honNumber}.pdf`, { signatureUrl, stampUrl });
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
  if (!hon) return <div className="text-muted-foreground p-8">Handover Note not found.</div>;

  const rawItems = (hon as any).itemsHandedOver;
  let liveItems: HandoverItem[] = [];
  try { liveItems = typeof rawItems === "string" ? JSON.parse(rawItems) : (rawItems ?? []); } catch { liveItems = []; }

  const docForTemplate = {
    honNumber: hon.honNumber,
    handoverDate: (hon as any).handoverDate ?? null,
    clientName: hon.clientName,
    lpoNumber: (hon as any).lpoNumber ?? null,
    projectRef: (hon as any).projectRef ?? null,
    projectDescription: (hon as any).projectDescription ?? null,
    itemsHandedOver: liveItems,
    receivedByName: (hon as any).receivedByName ?? null,
    receivedByDesignation: (hon as any).receivedByDesignation ?? null,
    clientRepresentative: (hon as any).clientRepresentative ?? null,
    notes: (hon as any).notes ?? null,
    companyId: (hon as any).companyId ?? 1,
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Action bar — hidden on print */}
      <div className="no-print flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/accounts/handover-notes">
            <ArrowLeft className="w-4 h-4 mr-1" />Back
          </Link>
        </Button>

        <Badge className={`capitalize ${STATUS_COLORS[hon.status] ?? "bg-gray-100"}`}>
          {hon.status}
        </Badge>

        {(hon as any)?.projectRef && (
          <Badge className="bg-[#0f2d5a] text-white border border-blue-300/40 font-mono text-[11px] tracking-wide px-2.5">
            PROJECT ID: {(hon as any).projectRef}
          </Badge>
        )}

        <span className="font-mono text-sm text-muted-foreground">{hon.honNumber}</span>

        {!editMode && (
          <Button size="sm" variant="outline" onClick={openEdit}>
            <Pencil className="w-3.5 h-3.5 mr-1.5" />Edit
          </Button>
        )}

        <div className="ml-auto flex gap-2">
          <Button
            size="sm" variant="outline"
            disabled={generatingPdf}
            onClick={async () => {
              const el = printRef.current;
              let attachments: { filename: string; content: string; contentType: string; size: number }[] = [];
              if (el) {
                setGeneratingPdf(true);
                try {
                  const filename = `HandoverNote_${hon.honNumber ?? hon.id ?? "doc"}.pdf`;
                  const signatureUrl = user?.signatureUrl || undefined;
                  const stampUrl = companies?.find(c => c.id === (hon as any).companyId)?.stamp || undefined;
                  const { base64 } = await captureElementToPdfBase64(el, filename, { signatureUrl, stampUrl });
                  attachments = [{ filename, content: base64, contentType: "application/pdf", size: Math.round(base64.length * 0.75) }];
                } catch { /* fall through */ } finally { setGeneratingPdf(false); }
              }
              openCompose({
                toAddress: "",
                toName: hon.clientName ?? "",
                subject: `Handover Note ${hon.honNumber ?? ""} – ${hon.clientName ?? ""}`,
                body: `Dear ${hon.clientName ?? "Sir/Madam"},\n\nPlease find attached the Handover Note ${hon.honNumber ?? ""} for your project.\n\nKindly sign and return the acknowledgement.\n\nBest regards,\nPrime Max Prefab`,
                clientName: hon.clientName ?? "",
                sourceRef: hon.honNumber ?? "",
                companyId: (hon as any).companyId ?? undefined,
                attachments,
              });
            }}
          >
            {generatingPdf ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Preparing PDF…</> : <><Mail className="w-4 h-4 mr-1.5" />Send Email</>}
          </Button>
          <Button size="sm" variant="outline" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-1.5" />Print / PDF
          </Button>
          <Button size="sm" variant="outline" onClick={handleExportPdf} disabled={exporting}>
            <Download className="w-4 h-4 mr-1.5" />{exporting ? "Exporting…" : "Export PDF"}
          </Button>
          <ExportButtons
            docNumber={hon.honNumber ?? hon.id?.toString() ?? "HON"}
            recipientPhone={undefined}
            recipientEmail={undefined}
            companyId={(hon as any).companyId ?? undefined}
            docTypeLabel="Handover Note"
            signatureUrl={user?.signatureUrl ?? undefined}
            stampUrl={companies?.find(c => c.id === (hon as any).companyId)?.stamp ?? undefined}
          />
        </div>
      </div>

      {/* Edit form */}
      {editMode && (
        <div className="no-print border rounded-lg p-4 bg-card space-y-4">
          <h3 className="font-semibold text-[#0f2d5a]">Edit Handover Note</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Handover Date</Label>
              <Input type="date" value={form.handoverDate} onChange={e => setForm(p => ({ ...p, handoverDate: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="signed">Signed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Received By (Name)</Label>
              <Input value={form.receivedByName} onChange={e => setForm(p => ({ ...p, receivedByName: e.target.value }))} placeholder="Client's representative name" />
            </div>
            <div className="space-y-1">
              <Label>Designation</Label>
              <Input value={form.receivedByDesignation} onChange={e => setForm(p => ({ ...p, receivedByDesignation: e.target.value }))} placeholder="Site Engineer, Project Manager..." />
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Client Representative</Label>
              <Input value={form.clientRepresentative} onChange={e => setForm(p => ({ ...p, clientRepresentative: e.target.value }))} placeholder="Company / authority representative" />
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Project Description</Label>
              <Textarea rows={2} value={form.projectDescription} onChange={e => setForm(p => ({ ...p, projectDescription: e.target.value }))} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Items Handed Over</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="w-3.5 h-3.5 mr-1" />Add Item
              </Button>
            </div>
            <div className="border rounded overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2">Description *</th>
                    <th className="px-3 py-2 w-20 text-center">Qty</th>
                    <th className="px-3 py-2 w-20 text-left">Unit</th>
                    <th className="px-3 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((item, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="px-2 py-1">
                        <Input value={item.description} onChange={e => updateItem(idx, "description", e.target.value)} placeholder="Item description" className="h-8 text-sm" />
                      </td>
                      <td className="px-2 py-1">
                        <Input type="number" value={item.quantity} onChange={e => updateItem(idx, "quantity", parseFloat(e.target.value) || 1)} className="h-8 text-sm text-center" min={1} />
                      </td>
                      <td className="px-2 py-1">
                        <Input value={item.unit} onChange={e => updateItem(idx, "unit", e.target.value)} placeholder="nos" className="h-8 text-sm" />
                      </td>
                      <td className="px-2 py-1">
                        <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => removeItem(idx)} disabled={form.items.length === 1}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => setEditMode(false)}>Cancel</Button>
            <Button
              className="bg-[#0f2d5a] hover:bg-[#1e6ab0]"
              onClick={() => updateMutation.mutate({ id: honId, data: { ...form, itemsHandedOver: form.items.filter(i => i.description.trim()) } as any })}
              disabled={updateMutation.isPending}
            >
              <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
              {updateMutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </div>
      )}

      {/* Document rendered inline */}
      <HandoverNoteTemplate ref={printRef} doc={docForTemplate} />
    </div>
  );
}
