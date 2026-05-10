import { useRef, useState } from "react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { useListCompanies, useUpdateCompany, getListCompaniesQueryKey, type Company } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Building2, Pencil, Globe, Phone, Mail, Receipt, Upload, X, Stamp, FileText } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface FormState {
  name: string; shortName: string; prefix: string; trn: string;
  email: string; phone: string; website: string; address: string;
  vatPercent: number; logo: string; stamp: string;
  stampWidthPct: number; stampMarginPct: number;
}

// A4 aspect ratio preview that mirrors stampImagesOnSlice placement logic.
// Stamp is bottom-centred at stampMarginPct% from the bottom, sized to
// stampWidthPct% of the preview width and capped at 14% of preview height.
function StampPlacementPreview({
  stampUrl,
  stampWidthPct,
  stampMarginPct,
}: {
  stampUrl: string;
  stampWidthPct: number;
  stampMarginPct: number;
}) {
  const W = 168;
  const H = Math.round(W * Math.SQRT2); // ≈ 238 px — A4 portrait ratio

  const maxW = W * Math.max(5, Math.min(80, stampWidthPct)) / 100;
  const maxH = H * 0.14;
  const bottomMargin = H * Math.max(0, Math.min(30, stampMarginPct)) / 100;

  return (
    <div
      className="relative border border-gray-200 bg-white rounded shadow-sm overflow-hidden flex-shrink-0"
      style={{ width: W, height: H }}
      title="Live stamp placement preview"
    >
      {/* Simulated document lines */}
      <div className="absolute inset-x-3 top-3 space-y-[5px]">
        {[100, 100, 75, 100, 100, 60, 100, 100, 80, 100, 55].map((w, i) => (
          <div key={i} className="h-[5px] rounded bg-gray-100" style={{ width: `${w}%` }} />
        ))}
      </div>
      {/* Page label */}
      <div className="absolute top-1.5 right-2 flex items-center gap-0.5 text-[7px] text-gray-300 select-none">
        <FileText className="w-2.5 h-2.5" />
        A4
      </div>

      {/* Stamp placement zone */}
      {stampUrl ? (
        <img
          src={stampUrl}
          alt="Stamp position preview"
          style={{
            position: "absolute",
            bottom: bottomMargin,
            left: "50%",
            transform: "translateX(-50%)",
            maxWidth: maxW,
            maxHeight: maxH,
            objectFit: "contain",
            opacity: 0.85,
          }}
        />
      ) : (
        <div
          className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center border border-dashed border-gray-300 rounded"
          style={{ bottom: bottomMargin, width: maxW, height: maxH }}
        >
          <Stamp className="text-gray-300" style={{ width: maxH * 0.5, height: maxH * 0.5 }} />
        </div>
      )}

      {/* Bottom edge indicator */}
      <div className="absolute bottom-0 inset-x-0 h-px bg-gray-200" />
    </div>
  );
}

export function CompaniesAdmin() {
  const { activeCompanyId } = useActiveCompany();
  const isElite = activeCompanyId === 2;
  const primeBtnCls = isElite ? "bg-[#0D0D0D] hover:bg-[#8B0000]" : "bg-[#0f2d5a] hover:bg-[#1e6ab0]";
  const { data: companies, isLoading } = useListCompanies();
  const queryClient = useQueryClient();
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>({
    name: "", shortName: "", prefix: "", trn: "",
    email: "", phone: "", website: "", address: "", vatPercent: 5, logo: "", stamp: "",
    stampWidthPct: 30, stampMarginPct: 3,
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const stampRef = useRef<HTMLInputElement>(null);

  const update = useUpdateCompany({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCompaniesQueryKey() });
        setEditId(null);
      },
    },
  });

  const openEdit = (c: Company) => {
    setForm({
      name: c.name ?? "",
      shortName: c.shortName ?? "",
      prefix: c.prefix ?? "",
      trn: c.trn ?? "",
      email: c.email ?? "",
      phone: c.phone ?? "",
      website: c.website ?? "",
      address: c.address ?? "",
      vatPercent: c.vatPercent ?? 5,
      logo: c.logo ?? "",
      stamp: c.stamp ?? "",
      stampWidthPct: c.stampWidthPct ?? 30,
      stampMarginPct: c.stampMarginPct ?? 3,
    });
    setEditId(c.id);
  };

  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setForm(p => ({ ...p, logo: (ev.target?.result as string) ?? "" }));
    };
    reader.readAsDataURL(file);
  };

  const handleStampFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setForm(p => ({ ...p, stamp: (ev.target?.result as string) ?? "" }));
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Companies</h1>
        <p className="text-muted-foreground text-sm">Manage company profiles including logos for PRIME ERP SYSTEMS.</p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(2)].map((_, i) => <Card key={i}><CardContent className="p-6"><div className="h-32 bg-muted rounded animate-pulse" /></CardContent></Card>)}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {companies?.map(c => (
            <Card key={c.id} className="border-l-4 border-l-[#1e6ab0]">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {c.logo ? (
                      <img
                        src={c.logo}
                        alt={`${c.name} logo`}
                        className="w-12 h-12 rounded-lg object-contain border bg-white p-1"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-[#0f2d5a] flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-white" />
                      </div>
                    )}
                    <div>
                      <CardTitle className="text-base">{c.name}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className="bg-[#1e6ab0] text-white hover:bg-[#1e6ab0] text-[10px] font-mono">{c.prefix}</Badge>
                        <span className="text-xs text-muted-foreground">{c.shortName}</span>
                        {c.isActive ? (
                          <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 text-[10px]">Active</Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-red-100 text-red-800 text-[10px]">Inactive</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => openEdit(c)}>
                    <Pencil className="w-3.5 h-3.5 mr-1.5" />Edit
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {c.trn && <div className="flex items-center gap-2 text-muted-foreground"><Receipt className="w-3.5 h-3.5" /><span className="text-foreground font-mono text-xs">TRN: {c.trn}</span> · VAT {c.vatPercent}%</div>}
                {c.phone && <div className="flex items-center gap-2 text-muted-foreground"><Phone className="w-3.5 h-3.5" />{c.phone}</div>}
                {c.email && <div className="flex items-center gap-2 text-muted-foreground"><Mail className="w-3.5 h-3.5" />{c.email}</div>}
                {c.website && <div className="flex items-center gap-2 text-muted-foreground"><Globe className="w-3.5 h-3.5" />{c.website}</div>}
                {c.address && <div className="text-xs text-muted-foreground pt-1 border-t mt-2">{c.address}</div>}
                <div className="flex items-center gap-3 pt-1">
                  {!c.logo && (
                    <div className="flex items-center gap-1 text-xs text-orange-600">
                      <Upload className="w-3 h-3" />No logo
                    </div>
                  )}
                  {c.stamp ? (
                    <div className="flex items-center gap-1 text-xs text-emerald-600">
                      <Stamp className="w-3 h-3" />Stamp uploaded
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-xs text-orange-600">
                      <Stamp className="w-3 h-3" />No stamp — click Edit to add
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={editId !== null} onOpenChange={(o) => !o && setEditId(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Company</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="col-span-2 space-y-1"><Label>Legal Name</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Short Name</Label><Input value={form.shortName} onChange={e => setForm(p => ({ ...p, shortName: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Prefix</Label><Input value={form.prefix} onChange={e => setForm(p => ({ ...p, prefix: e.target.value.toUpperCase() }))} /></div>
            <div className="space-y-1"><Label>TRN</Label><Input value={form.trn} onChange={e => setForm(p => ({ ...p, trn: e.target.value }))} /></div>
            <div className="space-y-1"><Label>VAT %</Label><Input type="number" value={form.vatPercent} onChange={e => setForm(p => ({ ...p, vatPercent: parseFloat(e.target.value) || 0 }))} /></div>
            <div className="space-y-1"><Label>Email</Label><Input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
            <div className="col-span-2 space-y-1"><Label>Website</Label><Input value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))} /></div>
            <div className="col-span-2 space-y-1"><Label>Address</Label><Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} /></div>

            {/* Logo Upload */}
            <div className="col-span-2 space-y-2">
              <Label>Company Logo</Label>
              <div className="flex items-start gap-3">
                {form.logo ? (
                  <div className="relative">
                    <img src={form.logo} alt="Logo preview" className="w-20 h-20 object-contain border rounded-lg bg-white p-1" />
                    <button
                      onClick={() => setForm(p => ({ ...p, logo: "" }))}
                      className="absolute -top-1.5 -right-1.5 bg-destructive text-white rounded-full w-5 h-5 flex items-center justify-center hover:opacity-90"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
                    <Building2 className="w-8 h-8 text-gray-400" />
                  </div>
                )}
                <div className="flex-1 space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Upload your company logo. It will appear on all printed documents (quotations, invoices, delivery notes).
                    Recommended: PNG or SVG with transparent background, minimum 200×200px.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileRef.current?.click()}
                  >
                    <Upload className="w-3.5 h-3.5 mr-1.5" />
                    {form.logo ? "Change Logo" : "Upload Logo"}
                  </Button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoFile}
                  />
                </div>
              </div>
            </div>

            {/* Stamp Upload */}
            <div className="col-span-2 space-y-2">
              <Label>Company Stamp</Label>
              <div className="flex items-start gap-3">
                {form.stamp ? (
                  <div className="relative">
                    <img src={form.stamp} alt="Stamp preview" className="w-20 h-20 object-contain border rounded-lg bg-white p-1" />
                    <button
                      onClick={() => setForm(p => ({ ...p, stamp: "" }))}
                      className="absolute -top-1.5 -right-1.5 bg-destructive text-white rounded-full w-5 h-5 flex items-center justify-center hover:opacity-90"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
                    <Stamp className="w-8 h-8 text-gray-400" />
                  </div>
                )}
                <div className="flex-1 space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Upload the company stamp / seal image. It will be automatically overlaid on every page of LPO PDFs.
                    Recommended: PNG with transparent background so the stamp blends naturally over the document.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => stampRef.current?.click()}
                  >
                    <Stamp className="w-3.5 h-3.5 mr-1.5" />
                    {form.stamp ? "Change Stamp" : "Upload Stamp"}
                  </Button>
                  <input
                    ref={stampRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleStampFile}
                  />
                </div>
              </div>
            </div>

            {/* Stamp placement controls + live preview */}
            <div className="col-span-2 space-y-3">
              <Label>Stamp Placement</Label>
              <div className="flex gap-4 items-start">
                {/* Controls */}
                <div className="flex-1 space-y-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-normal text-muted-foreground">Width %</Label>
                      <span className="text-xs font-mono text-foreground">{form.stampWidthPct}%</span>
                    </div>
                    <input
                      type="range"
                      min={5}
                      max={80}
                      step={1}
                      value={form.stampWidthPct}
                      onChange={e => { const v = parseFloat(e.target.value); setForm(p => ({ ...p, stampWidthPct: Number.isNaN(v) ? 30 : Math.min(80, Math.max(5, v)) })); }}
                      className="w-full accent-[#1e6ab0]"
                    />
                    <Input
                      type="number"
                      min={5}
                      max={80}
                      step={1}
                      value={form.stampWidthPct}
                      onChange={e => { const v = parseFloat(e.target.value); setForm(p => ({ ...p, stampWidthPct: Number.isNaN(v) ? 30 : Math.min(80, Math.max(5, v)) })); }}
                      className="h-7 text-xs"
                    />
                    <p className="text-[11px] text-muted-foreground">Width of stamp relative to page width (default 30, range 5–80).</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-normal text-muted-foreground">Bottom margin %</Label>
                      <span className="text-xs font-mono text-foreground">{form.stampMarginPct}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={30}
                      step={0.5}
                      value={form.stampMarginPct}
                      onChange={e => { const v = parseFloat(e.target.value); setForm(p => ({ ...p, stampMarginPct: Number.isNaN(v) ? 3 : Math.min(30, Math.max(0, v)) })); }}
                      className="w-full accent-[#1e6ab0]"
                    />
                    <Input
                      type="number"
                      min={0}
                      max={30}
                      step={0.5}
                      value={form.stampMarginPct}
                      onChange={e => { const v = parseFloat(e.target.value); setForm(p => ({ ...p, stampMarginPct: Number.isNaN(v) ? 3 : Math.min(30, Math.max(0, v)) })); }}
                      className="h-7 text-xs"
                    />
                    <p className="text-[11px] text-muted-foreground">Gap from page bottom as % of page height (default 3, range 0–30).</p>
                  </div>
                </div>

                {/* Live A4 preview */}
                <div className="flex flex-col items-center gap-1.5">
                  <StampPlacementPreview
                    stampUrl={form.stamp}
                    stampWidthPct={form.stampWidthPct}
                    stampMarginPct={form.stampMarginPct}
                  />
                  <p className="text-[10px] text-muted-foreground">Live preview</p>
                </div>
              </div>
            </div>
          </div>

          <Button
            className={`mt-4 ${primeBtnCls} text-white w-full`}
            disabled={update.isPending || !editId}
            onClick={() => editId && update.mutate({ id: editId, data: form })}
          >
            {update.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
