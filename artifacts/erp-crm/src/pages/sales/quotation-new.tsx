import { useState } from "react";
import { useCreateQuotation, useListCompanies } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListQuotationsQueryKey } from "@workspace/api-client-react";

interface Item { description: string; quantity: number; unit: string; rate: number; amount: number; discount: number; }
const emptyItem = (): Item => ({ description: "", quantity: 1, unit: "nos", rate: 0, amount: 0, discount: 0 });

const DEFAULT_TECH_SPECS = `BASE FRAME
• Steel base & top frame: MS I-BEAM 120×64, full perimeter beams with central runner and cross members.
• Lifting eyes at intermediate points at base of cabin; painted with 01 coat red oxide primer and 01 coat matt enamel paint.
• Base frame painted with 02 coats: one red oxide, one rust-free enamel paint.

FLOOR SYSTEM
• Floor Frame: MS angle 50×50×2.7mm welded into base/top frame (400mm joist spacing). Grit blasted SA2.5 + 02 coat epoxy paint.
• Floor Decking: 18mm thick cement board, bottom painted with bitumen paint.
• Floor Finish – Dry Area: 1.5mm PVC vinyl sheet.
• Floor Finish – Wet Area: 1.5mm PVC vinyl sheet.

WALL SYSTEM
• External Finish: 6mm cement board with heavy texture paint (approved colour); joints covered by 6mm CFB strips.
• Internal Finish (Dry): 12.5mm gypsum board + emulsion paint (off-white). MDF 50mm / PVC 75mm skirting.
• Internal Finish (Wet): 12mm MR gypsum board on LGS framing + MDF 5cm skirting.
• Wall Framing: LGS GI studs 70×35×0.45mm at 610mm vertical / 1200mm horizontal spacing.
• Wall Insulation: 50mm glass-wool, 12 kg/m³ density.

ROOFING & CEILING
• Roof: 0.5mm GI corrugated steel on furry-channel purlins; trusses from MS Angle 40×40×2.7mm.
• Ceiling (Dry & Wet): 12mm gypsum board with fine texture paint.

DOORS
• External Door: Aluminium/PVC, 900×2100mm. Mortice lockset with cylinder and SS handles.
• Internal / Toilet Door: 900/700×2100mm PVC door. Single cylinder with thumb-turn latch for toilet doors.

WINDOWS
• External: Powder-coated aluminium (non-thermal break), 6mm clear glass, hinged, 900×900mm.
• Exhaust: Powder-coated aluminium, fixed, obscure glass, 400×400mm.

ELECTRICAL
• Conduits and wiring: National / Du-Cab / RR brands.
• Ceiling lights: 36W tube light by MAX.`;

const DEFAULT_TC = `1. COMMERCIAL BASIS
• Prices are quoted per the attached specification. Any revision or additional requirement is a variation priced separately.
• Unless included, the customer shall provide crane support, foundation, safe offloading access, and all site arrangements.
• Commercial basis: Ex-factory. All cheques in favour of the company name above.

2. EXCLUSIONS
• Offloading, excavation, foundation works, and on-site civil works (unless included).
• Third-party inspections, testing, statutory approvals, and authority clearances.
• Window blinds, fire extinguishers, smoke detectors, fire alarm systems, and similar items unless expressly included.
• Third-party certification costs for welding, painting, and lifting eye inspections.
• Design calculations and certifications (live load, dead load, wind load).
• Replaceable wear items: lights, wash-basin/shower mixers, cistern covers, door handles.

3. PAYMENT TERMS
• 75% advance upon receipt of LPO and approved drawings.
• 25% balance before delivery.
• All cheques in favour of the company name above.

4. TECHNICAL & GENERAL NOTES
• Drawings remain subject to client approval. The attached specification is the governing manufacturing reference.
• We reserve the right to upgrade or substitute materials with equal or better performance.
• For queries, contact our sales team.`;

export function QuotationNew() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { data: companies } = useListCompanies();
  const create = useCreateQuotation({ mutation: { onSuccess: (data) => { queryClient.invalidateQueries({ queryKey: getListQuotationsQueryKey() }); navigate(`/sales/quotations/${data.id}`); } } });

  const [form, setForm] = useState({
    companyId: "", clientName: "", clientEmail: "", clientPhone: "",
    projectName: "", projectLocation: "", status: "draft",
    vatPercent: 5, discount: 0, paymentTerms: "", validity: "30 days",
    termsConditions: DEFAULT_TC, techSpecs: DEFAULT_TECH_SPECS,
  });
  const [items, setItems] = useState<Item[]>([emptyItem()]);
  const [showTechSpecs, setShowTechSpecs] = useState(false);
  const [showTC, setShowTC] = useState(false);

  const updateItem = (i: number, field: keyof Item, val: string | number) => {
    setItems(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: val };
      const qty = field === "quantity" ? Number(val) : next[i].quantity;
      const rate = field === "rate" ? Number(val) : next[i].rate;
      const disc = field === "discount" ? Number(val) : next[i].discount;
      next[i].amount = qty * rate * (1 - disc / 100);
      return next;
    });
  };

  const subtotal = items.reduce((s, it) => s + it.amount, 0);
  const discountedSubtotal = subtotal * (1 - form.discount / 100);
  const vatAmount = discountedSubtotal * form.vatPercent / 100;
  const grandTotal = discountedSubtotal + vatAmount;

  const handleSubmit = (status: string) => {
    if (!form.companyId || !form.clientName) return;
    create.mutate({ data: { ...form, status, companyId: parseInt(form.companyId, 10), items } as any });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild><Link href="/sales/quotations"><ArrowLeft className="w-4 h-4 mr-1" />Back</Link></Button>
        <h1 className="text-2xl font-bold tracking-tight">New Quotation</h1>
      </div>

      <Card>
        <CardHeader><CardTitle>Client Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1 col-span-2 sm:col-span-1">
            <Label>Company *</Label>
            <Select value={form.companyId} onValueChange={v => setForm(p => ({...p, companyId: v}))}>
              <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
              <SelectContent>{companies?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Client Name *</Label><Input value={form.clientName} onChange={e => setForm(p => ({...p, clientName: e.target.value}))} /></div>
          <div className="space-y-1"><Label>Client Email</Label><Input type="email" value={form.clientEmail} onChange={e => setForm(p => ({...p, clientEmail: e.target.value}))} /></div>
          <div className="space-y-1"><Label>Client Phone</Label><Input value={form.clientPhone} onChange={e => setForm(p => ({...p, clientPhone: e.target.value}))} /></div>
          <div className="space-y-1"><Label>Project Name</Label><Input value={form.projectName} onChange={e => setForm(p => ({...p, projectName: e.target.value}))} /></div>
          <div className="space-y-1"><Label>Project Location</Label><Input value={form.projectLocation} onChange={e => setForm(p => ({...p, projectLocation: e.target.value}))} /></div>
          <div className="space-y-1"><Label>Validity</Label><Input value={form.validity} onChange={e => setForm(p => ({...p, validity: e.target.value}))} /></div>
          <div className="space-y-1"><Label>Payment Terms</Label><Input value={form.paymentTerms} onChange={e => setForm(p => ({...p, paymentTerms: e.target.value}))} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Line Items</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setItems(p => [...p, emptyItem()])}><Plus className="w-4 h-4 mr-1" />Add Row</Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b">
                <th className="text-left pb-2 font-semibold">Description</th>
                <th className="text-right pb-2 font-semibold w-20">Qty</th>
                <th className="text-left pb-2 font-semibold w-20 pl-2">Unit</th>
                <th className="text-right pb-2 font-semibold w-28">Rate</th>
                <th className="text-right pb-2 font-semibold w-24">Disc%</th>
                <th className="text-right pb-2 font-semibold w-32">Amount</th>
                <th className="w-8"></th>
              </tr></thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-1 pr-2"><Input value={item.description} onChange={e => updateItem(i, "description", e.target.value)} className="h-8" /></td>
                    <td className="py-1 px-1"><Input type="number" value={item.quantity} onChange={e => updateItem(i, "quantity", e.target.value)} className="h-8 text-right w-full" /></td>
                    <td className="py-1 px-1"><Input value={item.unit} onChange={e => updateItem(i, "unit", e.target.value)} className="h-8" /></td>
                    <td className="py-1 px-1"><Input type="number" value={item.rate} onChange={e => updateItem(i, "rate", e.target.value)} className="h-8 text-right w-full" /></td>
                    <td className="py-1 px-1"><Input type="number" value={item.discount} onChange={e => updateItem(i, "discount", e.target.value)} className="h-8 text-right w-full" /></td>
                    <td className="py-1 pl-1 text-right font-medium">AED {item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="py-1 pl-1">
                      {items.length > 1 && <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setItems(p => p.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" /></Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex justify-end">
            <div className="w-72 space-y-3">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>AED {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">Discount (%)</span>
                <Input type="number" className="w-20 h-7 text-right text-sm" value={form.discount} onChange={e => setForm(p => ({...p, discount: parseFloat(e.target.value) || 0}))} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">VAT (%)</span>
                <Input type="number" className="w-20 h-7 text-right text-sm" value={form.vatPercent} onChange={e => setForm(p => ({...p, vatPercent: parseFloat(e.target.value) || 5}))} />
              </div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">VAT Amount</span><span>AED {vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
              <Separator />
              <div className="flex justify-between font-bold text-lg"><span>Grand Total</span><span className="text-primary">AED {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Technical Specifications */}
      <Card>
        <CardHeader
          className="flex flex-row items-center justify-between cursor-pointer py-3"
          onClick={() => setShowTechSpecs(s => !s)}
        >
          <CardTitle className="text-base">Technical Specifications</CardTitle>
          {showTechSpecs ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </CardHeader>
        {showTechSpecs && (
          <CardContent>
            <p className="text-xs text-muted-foreground mb-2">Edit the technical specifications that will appear in the printed quotation document.</p>
            <Textarea
              value={form.techSpecs}
              onChange={e => setForm(p => ({...p, techSpecs: e.target.value}))}
              rows={18}
              className="font-mono text-xs"
            />
          </CardContent>
        )}
      </Card>

      {/* Terms & Conditions */}
      <Card>
        <CardHeader
          className="flex flex-row items-center justify-between cursor-pointer py-3"
          onClick={() => setShowTC(s => !s)}
        >
          <CardTitle className="text-base">Terms &amp; Conditions</CardTitle>
          {showTC ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </CardHeader>
        {showTC && (
          <CardContent>
            <p className="text-xs text-muted-foreground mb-2">Edit the terms and conditions that will appear in the printed quotation document.</p>
            <Textarea
              value={form.termsConditions}
              onChange={e => setForm(p => ({...p, termsConditions: e.target.value}))}
              rows={14}
              className="font-mono text-xs"
            />
          </CardContent>
        )}
      </Card>

      <div className="flex gap-3 justify-end">
        <Button variant="outline" asChild><Link href="/sales/quotations">Cancel</Link></Button>
        <Button variant="outline" onClick={() => handleSubmit("draft")} disabled={create.isPending || !form.companyId || !form.clientName}>Save as Draft</Button>
        <Button onClick={() => handleSubmit("sent")} disabled={create.isPending || !form.companyId || !form.clientName}>
          {create.isPending ? "Creating..." : "Create & Send"}
        </Button>
      </div>
    </div>
  );
}
