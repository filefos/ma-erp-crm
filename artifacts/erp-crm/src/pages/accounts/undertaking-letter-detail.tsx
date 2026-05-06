import { useRef, useState } from "react";
import {
  useGetUndertakingLetter, getGetUndertakingLetterQueryKey,
  useUpdateUndertakingLetter,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";
import { ArrowLeft, Pencil, CheckCircle, Download, Printer } from "lucide-react";
import { ExportButtons } from "@/components/export-buttons";
import { UndertakingLetterTemplate } from "@/components/undertaking-letter-template";
import { useToast } from "@/hooks/use-toast";
import { captureElementToPdfBase64 } from "@/lib/print-to-pdf";

interface Props { id: string }

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  issued: "bg-blue-100 text-blue-800",
  signed: "bg-green-100 text-green-800",
};

export function UndertakingLetterDetail({ id }: Props) {
  const ulId = parseInt(id, 10);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);
  const [editMode, setEditMode] = useState(false);
  const [exporting, setExporting] = useState(false);

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

  const handlePrint = () => {
    if (!printRef.current || !ul) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head>
      <title>${ul.ulNumber}</title>
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
    if (!printRef.current || !ul) return;
    setExporting(true);
    try {
      const { base64, filename } = await captureElementToPdfBase64(printRef.current, `${ul.ulNumber}.pdf`);
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
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Action bar — hidden on print */}
      <div className="no-print flex flex-wrap items-center gap-2">
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

        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-1.5" />Print / PDF
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
              className="bg-[#0f2d5a] hover:bg-[#1e6ab0]"
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
