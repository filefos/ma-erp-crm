import { useState } from "react";
import {
  useGetLead, useUpdateLead, getGetLeadQueryKey, getListLeadsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft, Pencil, MessageCircle, Phone, Mail, MapPin, Calendar, Building2, X, Save,
  Sparkles, Copy, Wand2, Brain, Trophy, FileText,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import {
  scoreLead, suggestNextAction, generateFollowUpMessage, summarizeClient,
  predictDealSuccess, analyzeLostDeal, improveNotes,
} from "@/lib/ai-crm";
import { suggestFollowUp, type FollowUpSuggestion } from "@/lib/ai-client";

const scoreColors: Record<string, string> = {
  hot: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  warm: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  cold: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
};

const statusColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  contacted: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
  qualified: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  site_visit: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400",
  quotation_required: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  quotation_sent: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  negotiation: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400",
  won: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  lost: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const STATUSES = ["new","contacted","qualified","site_visit","quotation_required","quotation_sent","negotiation","won","lost"];

interface Props { id: string }

export function LeadDetail({ id }: Props) {
  const lid = parseInt(id, 10);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { data: lead, isLoading } = useGetLead(lid);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [aiText, setAiText] = useState<string>("");
  const [aiTitle, setAiTitle] = useState<string>("");
  const [aiFollowUp, setAiFollowUp] = useState<FollowUpSuggestion | null>(null);
  const [aiFollowUpBusy, setAiFollowUpBusy] = useState(false);

  const update = useUpdateLead({
    mutation: {
      onSuccess: (resp: any) => {
        queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetLeadQueryKey(lid) });
        setEditing(false);
        toast({ title: "Lead updated" });
        if (resp?.createdQuotation && resp?.quotationId) {
          const newQid = resp.quotationId as number;
          toast({
            title: "Draft Quotation auto-created",
            description: "Open the new quotation to add line items and send it.",
            action: (
              <ToastAction altText="Open quotation" onClick={() => navigate(`/sales/quotations/${newQid}`)}>
                Open
              </ToastAction>
            ),
          });
          queryClient.invalidateQueries({ queryKey: ["/quotations"] });
        }
        for (const w of (resp?.warnings ?? []) as string[]) {
          toast({ title: "Heads-up", description: w });
        }
      },
    },
  });

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading lead details...</div>;
  if (!lead) return <div className="text-muted-foreground p-8">Lead not found.</div>;

  const l = lead as any;
  const leadActivities: any[] = [];

  const startEditing = () => {
    setForm({
      leadName: l.leadName ?? "", companyName: l.companyName ?? "",
      contactPerson: l.contactPerson ?? "", phone: l.phone ?? "", whatsapp: l.whatsapp ?? "",
      email: l.email ?? "", location: l.location ?? "", requirementType: l.requirementType ?? "",
      budget: String(l.budget ?? ""), leadScore: l.leadScore ?? "cold", status: l.status ?? "new",
      notes: l.notes ?? "", nextFollowUp: l.nextFollowUp ?? "",
    });
    setEditing(true);
  };

  const saveEdit = () => {
    update.mutate({ id: lid, data: { ...form, budget: form.budget ? parseFloat(form.budget) : undefined } as any });
  };

  const ai = scoreLead(l, leadActivities);

  const showAi = (title: string, text: string) => { setAiTitle(title); setAiText(text); };
  const copyText = (txt: string) => { navigator.clipboard.writeText(txt); toast({ title: "Copied to clipboard" }); };

  const onSuggestFollowUp = async () => {
    setAiFollowUpBusy(true);
    try {
      const r = await suggestFollowUp({ leadId: lid });
      setAiFollowUp(r);
    } catch (err) {
      toast({
        title: "Could not draft follow-up",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setAiFollowUpBusy(false);
    }
  };

  const applyAiFollowUpDate = () => {
    if (!aiFollowUp?.recommendedDate) return;
    const data: Partial<typeof l> & { nextFollowUp: string } = { ...l, nextFollowUp: aiFollowUp.recommendedDate };
    update.mutate({ id: lid, data: data as Parameters<typeof update.mutate>[0]["data"] });
    toast({ title: "Follow-up date applied", description: aiFollowUp.recommendedDate });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/crm/leads"><ArrowLeft className="w-4 h-4 mr-1" />Back to Leads</Link>
        </Button>
        <div className="ml-auto flex gap-2 flex-wrap">
          {!editing && l.status !== "won" && l.status !== "lost" && (
            <Button variant="outline" size="sm" asChild data-testid="button-convert-quotation" className="border-blue-500 text-blue-700 hover:bg-blue-50">
              <Link href={`/sales/quotations/new?leadId=${l.id}`}>
                <FileText className="w-4 h-4 mr-1.5" />Convert to Quotation
              </Link>
            </Button>
          )}
          {!editing && (
            <Button variant="outline" size="sm" onClick={startEditing} data-testid="button-edit-lead">
              <Pencil className="w-4 h-4 mr-1.5" />Edit Lead
            </Button>
          )}
          {editing && (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditing(false)}><X className="w-4 h-4 mr-1.5" />Cancel</Button>
              <Button size="sm" className="bg-[#0f2d5a] hover:bg-[#1e6ab0]" onClick={saveEdit} disabled={update.isPending} data-testid="button-save-lead">
                <Save className="w-4 h-4 mr-1.5" />{update.isPending ? "Saving..." : "Save"}
              </Button>
            </>
          )}
          {(l.whatsapp || l.phone) && (
            <Button variant="outline" size="sm" asChild className="text-green-700 border-green-500 hover:bg-green-50" data-testid="button-wa-lead-detail">
              <a href={`https://wa.me/${(l.whatsapp || l.phone).replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer">
                <MessageCircle className="w-4 h-4 mr-1.5 text-green-600" />WhatsApp
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Header card */}
      <div className="bg-card border rounded-xl p-6 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            {editing ? (
              <div className="space-y-1">
                <Label>Lead / Client Name</Label>
                <Input value={form.leadName} onChange={e => setForm(p => ({...p, leadName: e.target.value}))} className="text-xl font-bold h-auto py-1" />
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold">{l.leadName}</h1>
                {l.companyName && <p className="text-muted-foreground text-sm mt-0.5">{l.companyName}</p>}
              </>
            )}
            <div className="font-mono text-sm text-primary mt-1">{l.leadNumber}</div>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {editing ? (
              <Select value={form.leadScore} onValueChange={v => setForm(p => ({...p, leadScore: v}))}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hot">Hot</SelectItem>
                  <SelectItem value="warm">Warm</SelectItem>
                  <SelectItem value="cold">Cold</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Badge variant="secondary" className={scoreColors[l.leadScore ?? ""] ?? "bg-slate-100 text-slate-700"}>{l.leadScore}</Badge>
            )}
            {editing ? (
              <Select value={form.status} onValueChange={v => setForm(p => ({...p, status: v}))}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace("_"," ")}</SelectItem>)}</SelectContent>
              </Select>
            ) : (
              <Badge variant="secondary" className={`${statusColors[l.status] ?? ""} capitalize`}>{l.status?.replace("_"," ")}</Badge>
            )}
            <div className="flex items-center gap-1 bg-gradient-to-r from-[#0f2d5a] to-[#1e6ab0] text-white rounded-full px-2.5 py-0.5 text-xs font-semibold" title={`AI score: ${ai.score}/100 (${ai.band})`}>
              <Sparkles className="w-3 h-3" />AI {ai.score}
            </div>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contact Information</h3>
            {editing ? (
              <div className="space-y-3">
                <div className="space-y-1"><Label>Contact Person</Label><Input value={form.contactPerson} onChange={e => setForm(p => ({...p, contactPerson: e.target.value}))} /></div>
                <div className="space-y-1"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(p => ({...p, phone: e.target.value}))} /></div>
                <div className="space-y-1"><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={e => setForm(p => ({...p, whatsapp: e.target.value}))} /></div>
                <div className="space-y-1"><Label>Email</Label><Input value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} /></div>
              </div>
            ) : (
              <div className="space-y-3">
                {l.contactPerson && <div className="flex items-center gap-2 text-sm"><Building2 className="w-4 h-4 text-muted-foreground" />{l.contactPerson}</div>}
                {l.phone && <div className="flex items-center gap-2 text-sm"><Phone className="w-4 h-4 text-muted-foreground" /><a href={`tel:${l.phone}`} className="hover:underline text-primary">{l.phone}</a></div>}
                {l.whatsapp && <div className="flex items-center gap-2 text-sm"><MessageCircle className="w-4 h-4 text-green-600" /><a href={`https://wa.me/${l.whatsapp.replace(/[^0-9]/g,"")}`} target="_blank" rel="noreferrer" className="hover:underline text-green-600">{l.whatsapp}</a></div>}
                {l.email && <div className="flex items-center gap-2 text-sm"><Mail className="w-4 h-4 text-muted-foreground" /><a href={`mailto:${l.email}`} className="hover:underline text-primary">{l.email}</a></div>}
                {l.location && <div className="flex items-center gap-2 text-sm"><MapPin className="w-4 h-4 text-muted-foreground" />{l.location}</div>}
              </div>
            )}
          </div>
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Requirement Details</h3>
            {editing ? (
              <div className="space-y-3">
                <div className="space-y-1"><Label>Company Name</Label><Input value={form.companyName} onChange={e => setForm(p => ({...p, companyName: e.target.value}))} /></div>
                <div className="space-y-1"><Label>Location</Label><Input value={form.location} onChange={e => setForm(p => ({...p, location: e.target.value}))} /></div>
                <div className="space-y-1"><Label>Requirement Type</Label><Input value={form.requirementType} onChange={e => setForm(p => ({...p, requirementType: e.target.value}))} placeholder="Villa, Labour Camp, Warehouse..." /></div>
                <div className="space-y-1"><Label>Budget (AED)</Label><Input type="number" value={form.budget} onChange={e => setForm(p => ({...p, budget: e.target.value}))} /></div>
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Requirement</span><span className="font-medium">{l.requirementType || "-"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Budget</span><span className="font-medium">{l.budget ? `AED ${parseFloat(l.budget).toLocaleString()}` : "-"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Source</span><span className="font-medium capitalize">{l.source?.replace("_"," ") || "-"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Assigned To</span><span className="font-medium">{l.assignedToName || "-"}</span></div>
              </div>
            )}
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Follow-up</h3>
            {editing ? (
              <div className="space-y-1"><Label>Next Follow-up Date</Label><Input type="date" value={form.nextFollowUp} onChange={e => setForm(p => ({...p, nextFollowUp: e.target.value}))} /></div>
            ) : (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span>{l.nextFollowUp ? new Date(l.nextFollowUp).toLocaleDateString("en-AE", { dateStyle: "long" }) : "No follow-up scheduled"}</span>
              </div>
            )}
          </div>
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Timeline</h3>
            <div className="text-sm text-muted-foreground space-y-1">
              <div>Created: {new Date(l.createdAt).toLocaleDateString("en-AE", { dateStyle: "long" })}</div>
              {l.updatedAt && <div>Last updated: {new Date(l.updatedAt).toLocaleDateString("en-AE", { dateStyle: "long" })}</div>}
            </div>
          </div>
        </div>

        {!editing && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</h3>
            <div className="p-3 bg-muted/30 rounded-lg text-sm min-h-[60px] whitespace-pre-wrap">
              {l.notes || <span className="text-muted-foreground italic">No notes added.</span>}
            </div>
          </div>
        )}
        {editing && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</h3>
            <Textarea value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} rows={4} placeholder="Additional notes..." />
          </div>
        )}
      </div>

      {/* AI Assistant tab */}
      <Tabs defaultValue="ai" className="w-full">
        <TabsList>
          <TabsTrigger value="ai" data-testid="tab-ai"><Brain className="w-4 h-4 mr-1.5" />AI Assistant</TabsTrigger>
        </TabsList>

        <TabsContent value="ai" className="space-y-3">
          <div className="bg-card border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0f2d5a] to-[#1e6ab0] flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">AI Sales Assistant</h3>
                <p className="text-xs text-muted-foreground">Heuristic-powered insights — swap to a generative model when you connect an API key.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <div className="border rounded-lg p-3 bg-gradient-to-br from-[#0f2d5a]/5 to-[#1e6ab0]/5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">AI Lead Score</span>
                  <Badge variant="secondary" className={`capitalize ${scoreColors[ai.band]}`}>{ai.band}</Badge>
                </div>
                <div className="text-2xl font-bold mt-1">{ai.score}<span className="text-sm text-muted-foreground">/100</span></div>
              </div>
              <div className="border rounded-lg p-3">
                <div className="text-xs text-muted-foreground mb-1">Reasoning</div>
                <ul className="text-[11px] space-y-0.5 list-disc pl-4 max-h-20 overflow-y-auto">
                  {ai.reasons.slice(0, 5).map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
              <div className="border rounded-lg p-3 bg-orange-50/50 dark:bg-orange-900/5">
                <div className="text-xs text-orange-700 dark:text-orange-400 font-semibold flex items-center gap-1 mb-1"><Trophy className="w-3 h-3" />Next best action</div>
                <p className="text-xs leading-snug">{suggestNextAction(l, leadActivities)}</p>
              </div>
            </div>

            <div className="flex items-center flex-wrap gap-2">
              <Button
                size="sm"
                onClick={onSuggestFollowUp}
                disabled={aiFollowUpBusy}
                className="bg-gradient-to-r from-[#0f2d5a] to-[#1e6ab0] text-white hover:opacity-95"
                data-testid="button-ai-suggest-followup"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                {aiFollowUpBusy ? "Drafting…" : "Suggest next follow-up"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => showAi("Suggested Follow-up Email", generateFollowUpMessage(l))} data-testid="button-ai-followup">
                <Wand2 className="w-3.5 h-3.5 mr-1.5" />Draft Follow-up Email
              </Button>
              <Button size="sm" variant="outline" onClick={() => showAi("Client Snapshot", summarizeClient(l, leadActivities))} data-testid="button-ai-summary">
                <Brain className="w-3.5 h-3.5 mr-1.5" />Summarize Client
              </Button>
              <Button size="sm" variant="outline" onClick={() => {
                const r = predictDealSuccess(l, leadActivities);
                showAi("Deal Success Prediction",
                  `Estimated probability of closing: ${r.probability}%\n\nReasoning:\n${r.rationale.map(x => "• " + x).join("\n")}`);
              }} data-testid="button-ai-predict">
                <Trophy className="w-3.5 h-3.5 mr-1.5" />Predict Success
              </Button>
              {l.status === "lost" && (
                <Button size="sm" variant="outline" onClick={() => showAi("Lost Lead Analysis", analyzeLostDeal(l, leadActivities))} data-testid="button-ai-lost">
                  <Brain className="w-3.5 h-3.5 mr-1.5 text-red-600" />Analyze Lost Lead
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => showAi("Improved Notes", improveNotes(l.notes ?? ""))} data-testid="button-ai-notes">
                <Wand2 className="w-3.5 h-3.5 mr-1.5" />Improve Notes
              </Button>
              <Button size="sm" variant="ghost" onClick={() => update.mutate({ id: lid, data: { ...l, leadScore: ai.band } as any })} data-testid="button-ai-apply-score">
                Apply AI score → {ai.band}
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* AI Suggested Follow-up dialog */}
      <Dialog open={aiFollowUp != null} onOpenChange={(o) => !o && setAiFollowUp(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-[#1e6ab0]" />AI Suggested Next Follow-up</DialogTitle></DialogHeader>
          {aiFollowUp && (
            <div className="space-y-4 pt-1">
              <div className="grid grid-cols-3 gap-3">
                <div className="border rounded-lg p-3 bg-muted/30">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Recommended Date</div>
                  <div className="font-semibold mt-0.5">{aiFollowUp.recommendedDate ?? "—"}</div>
                </div>
                <div className="border rounded-lg p-3 bg-muted/30">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Channel</div>
                  <div className="font-semibold mt-0.5 capitalize">{aiFollowUp.channel ?? "—"}</div>
                </div>
                <div className="border rounded-lg p-3 bg-muted/30 col-span-1">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Why</div>
                  <div className="text-xs mt-0.5">{aiFollowUp.reason ?? "—"}</div>
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs font-semibold flex items-center gap-1"><Mail className="w-3.5 h-3.5" />Email — {aiFollowUp.emailSubject ?? "(no subject)"}</div>
                <Textarea value={aiFollowUp.emailBody ?? ""} onChange={(e) => setAiFollowUp(p => p ? { ...p, emailBody: e.target.value } : p)} rows={6} className="text-sm" />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => copyText(`${aiFollowUp.emailSubject ?? ""}\n\n${aiFollowUp.emailBody ?? ""}`)}><Copy className="w-3.5 h-3.5 mr-1.5" />Copy</Button>
                </div>
              </div>
              <div className="flex justify-between">
                <Button variant="ghost" size="sm" onClick={() => setAiFollowUp(null)}>Close</Button>
                <Button size="sm" className="bg-[#0f2d5a] hover:bg-[#1e6ab0]" onClick={applyAiFollowUpDate} disabled={!aiFollowUp.recommendedDate}>
                  Apply date to lead
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* AI text dialog */}
      <Dialog open={!!aiText} onOpenChange={open => !open && setAiText("")}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-[#1e6ab0]" />{aiTitle}</DialogTitle></DialogHeader>
          <Textarea value={aiText} onChange={e => setAiText(e.target.value)} rows={10} className="font-mono text-sm" />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setAiText("")}>Close</Button>
            <Button size="sm" className="bg-[#0f2d5a] hover:bg-[#1e6ab0]" onClick={() => copyText(aiText)}><Copy className="w-3.5 h-3.5 mr-1.5" />Copy</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
