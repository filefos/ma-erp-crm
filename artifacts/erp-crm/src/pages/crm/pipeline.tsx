import { useMemo, useState } from "react";
  import { Link, useLocation } from "wouter";
  import {
    useListLeads, useUpdateLead,
    useListProformaInvoices, useListTaxInvoices, useListDeliveryNotes,
  } from "@workspace/api-client-react";
  import { FileText, Receipt, Package, GripVertical, Search, TrendingUp, DollarSign, Briefcase, AlertTriangle } from "lucide-react";
  import { useActiveCompany } from "@/hooks/useActiveCompany";
  import { useQueryClient } from "@tanstack/react-query";
  import { Badge } from "@/components/ui/badge";
  import { Input } from "@/components/ui/input";
  import { useToast } from "@/hooks/use-toast";
  import { ExecutiveHeader, Avatar } from "@/components/crm/premium";

  interface Stage { key: string; label: string; description: string; accent: string; badge: string }

  const STAGES: Stage[] = [
    { key: "new",                label: "New",          description: "Just created",     accent: "border-blue-500",    badge: "bg-blue-100 text-blue-700" },
    { key: "contacted",          label: "Contacted",    description: "Reached out",      accent: "border-indigo-500",  badge: "bg-indigo-100 text-indigo-700" },
    { key: "qualified",          label: "Qualified",    description: "Discovery done",   accent: "border-purple-500",  badge: "bg-purple-100 text-purple-700" },
    { key: "quotation_sent",     label: "Proposal",     description: "Quotation sent",   accent: "border-orange-500",  badge: "bg-orange-100 text-orange-700" },
    { key: "negotiation",        label: "Negotiation",  description: "Closing",          accent: "border-orange-500",  badge: "bg-orange-100 text-orange-700" },
    { key: "won",                label: "Won",          description: "Closed-won",       accent: "border-emerald-500", badge: "bg-emerald-100 text-emerald-700" },
    { key: "lost",               label: "Lost",         description: "Closed-lost",      accent: "border-red-500",     badge: "bg-red-100 text-red-700" },
  ];

  export function SalesPipeline() {
    const { data: leadsRaw, isLoading } = useListLeads({});
    const { data: piRaw } = useListProformaInvoices();
    const { data: tiRaw } = useListTaxInvoices();
    const { data: dnRaw } = useListDeliveryNotes();
    const { filterByCompany } = useActiveCompany();
    const [, navigate] = useLocation();
    const [search, setSearch] = useState("");
    const [draggingId, setDraggingId] = useState<number | null>(null);
    const [dragOverStage, setDragOverStage] = useState<string | null>(null);
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const update = useUpdateLead({
      mutation: {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/leads"] }),
        onError: (err: any) => toast({ title: "Could not move lead", description: err?.message ?? "Update failed", variant: "destructive" }),
      },
    });

    const leads = useMemo(() => {
      let rows = filterByCompany(leadsRaw ?? []);
      if (search) {
        const s = search.toLowerCase();
        rows = rows.filter((l: any) =>
          (l.leadName ?? "").toLowerCase().includes(s)
          || (l.companyName ?? "").toLowerCase().includes(s)
          || (l.leadNumber ?? "").toLowerCase().includes(s),
        );
      }
      return rows;
    }, [leadsRaw, filterByCompany, search]);

    const leadsByStage = useMemo(() => {
      const map: Record<string, any[]> = {};
      for (const s of STAGES) map[s.key] = [];
      for (const l of leads as any[]) {
        const k = map[l.status] ? l.status : "new";
        map[k].push(l);
      }
      return map;
    }, [leads]);

    const piByLead = useMemo(() => indexBy(piRaw, "leadId"), [piRaw]);
    const tiByLead = useMemo(() => indexBy(tiRaw, "leadId"), [tiRaw]);
    const dnByLead = useMemo(() => indexBy(dnRaw, "leadId"), [dnRaw]);

    const totalValue = leads.reduce((s: number, l: any) => s + Number(l.budget ?? 0), 0);
    const openValue = leads.filter((l: any) => !["won", "lost"].includes(l.status)).reduce((s: number, l: any) => s + Number(l.budget ?? 0), 0);
    const wonValue = leads.filter((l: any) => l.status === "won").reduce((s: number, l: any) => s + Number(l.budget ?? 0), 0);

    const STUCK_DAYS = 7;
    const isStuck = (l: any): boolean => {
      if (["won", "lost"].includes(l.status)) return false;
      const last = new Date(l.updatedAt ?? l.createdAt ?? Date.now()).getTime();
      return (Date.now() - last) / 86_400_000 >= STUCK_DAYS;
    };
    const stuckCount = leads.filter(isStuck).length;

    const handleDragStart = (e: React.DragEvent, id: number) => {
      setDraggingId(id);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(id));
    };
    const handleDragOver = (e: React.DragEvent, stage: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (dragOverStage !== stage) setDragOverStage(stage);
    };
    const handleDragLeave = (stage: string) => {
      if (dragOverStage === stage) setDragOverStage(null);
    };
    const handleDrop = (e: React.DragEvent, stage: string) => {
      e.preventDefault();
      setDragOverStage(null);
      setDraggingId(null);
      const id = parseInt(e.dataTransfer.getData("text/plain"), 10);
      if (!Number.isFinite(id)) return;
      const lead = (leads as any[]).find(l => l.id === id);
      if (!lead || lead.status === stage) return;
      update.mutate(
        { id, data: { ...lead, status: stage } as any },
        { onSuccess: () => toast({ title: "Lead moved", description: `${lead.leadName} → ${STAGES.find(s => s.key === stage)?.label}` }) },
      );
    };

    return (
      <div className="space-y-4">
        <ExecutiveHeader icon={Briefcase} title="Sales Pipeline" subtitle="Drag leads between stages to update them in real time">
          <PipelineStat icon={Briefcase}  label="All leads" value={leads.length} />
          <PipelineStat icon={TrendingUp} label="Open value" value={`AED ${openValue.toLocaleString()}`} tone="blue" />
          <PipelineStat icon={DollarSign} label="Won value"  value={`AED ${wonValue.toLocaleString()}`} tone="green" />
          {stuckCount > 0 && <PipelineStat icon={AlertTriangle} label="Stuck" value={stuckCount} tone="amber" />}
        </ExecutiveHeader>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search leads…" className="pl-8" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-pipeline-search" />
          </div>
          <span className="text-xs text-muted-foreground">Total budget across pipeline: <strong>AED {totalValue.toLocaleString()}</strong></span>
        </div>

        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3 min-w-max">
            {STAGES.map(stage => {
              const stageLeads = leadsByStage[stage.key] ?? [];
              const stageValue = stageLeads.reduce((s: number, l: any) => s + Number(l.budget ?? 0), 0);
              const isOver = dragOverStage === stage.key;
              return (
                <div
                  key={stage.key}
                  onDragOver={e => handleDragOver(e, stage.key)}
                  onDragLeave={() => handleDragLeave(stage.key)}
                  onDrop={e => handleDrop(e, stage.key)}
                  className={`w-72 shrink-0 bg-muted/30 rounded-xl border-2 border-t-4 ${stage.accent} ${isOver ? "ring-2 ring-[#1e6ab0] bg-[#1e6ab0]/5" : "border-transparent"} transition-all`}
                  data-testid={`pipeline-column-${stage.key}`}
                >
                  <div className="p-3 border-b border-border/50">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-sm">{stage.label}</div>
                      <Badge variant="secondary" className={`${stage.badge} text-[10px]`}>{stageLeads.length}</Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{stage.description}</div>
                    <div className="text-[11px] font-medium text-foreground/80 mt-1">AED {stageValue.toLocaleString()}</div>
                  </div>
                  <div className="p-2 space-y-2 min-h-[300px] max-h-[calc(100vh-340px)] overflow-y-auto">
                    {isLoading ? (
                      <div className="text-xs text-muted-foreground text-center py-6">Loading…</div>
                    ) : stageLeads.length === 0 ? (
                      <div className="text-xs text-muted-foreground/60 text-center py-8 italic">Drop leads here</div>
                    ) : stageLeads.map((l: any) => {
                      const stuck = isStuck(l);
                      const pi = piByLead.get(l.id);
                      const ti = tiByLead.get(l.id);
                      const dn = dnByLead.get(l.id);
                      return (
                        <div
                          key={l.id}
                          draggable
                          onDragStart={e => handleDragStart(e, l.id)}
                          onDragEnd={() => setDraggingId(null)}
                          className={`bg-card border rounded-xl p-2.5 cursor-grab active:cursor-grabbing hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 ${draggingId === l.id ? "opacity-40" : ""} ${stuck ? "ring-1 ring-orange-300 dark:ring-orange-700" : ""}`}
                          data-testid={`pipeline-card-${l.id}`}
                        >
                          <div className="flex items-start gap-1.5">
                            <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <Link href={`/crm/leads/${l.id}`} className="block">
                                <div className="flex items-center justify-between gap-1 mb-1">
                                  <span className="text-[11px] font-mono text-primary truncate">{l.leadNumber}</span>
                                  <div className="flex items-center gap-1 shrink-0">
                                    {stuck && <span title="Stuck — no movement in 7+ days"><AlertTriangle className="w-3 h-3 text-orange-500" /></span>}
                                    {l.assignedToName && <Avatar name={l.assignedToName} size={20} />}
                                  </div>
                                </div>
                                <div className="text-sm font-semibold leading-tight truncate">{l.leadName}</div>
                                {l.companyName && <div className="text-[11px] text-muted-foreground truncate">{l.companyName}</div>}
                              </Link>
                              <div className="flex items-center justify-between mt-2 gap-2">
                                <span className="text-xs font-bold text-emerald-600 truncate">AED {Number(l.budget ?? 0).toLocaleString()}</span>
                              </div>
                              {l.nextFollowUp && (
                                <div className="text-[10px] text-muted-foreground mt-0.5">Follow-up: {l.nextFollowUp}</div>
                              )}
                              {(pi || ti || dn) && (
                                <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                                  {pi && (
                                    <Link href={`/sales/proforma-invoices/${pi.id}`} onClick={e => e.stopPropagation()} title="Proforma">
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] hover:bg-blue-100"><FileText className="w-2.5 h-2.5" />PI</span>
                                    </Link>
                                  )}
                                  {ti && (
                                    <Link href={`/accounts/invoices/${ti.id}`} onClick={e => e.stopPropagation()} title="Tax Invoice">
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-green-50 text-green-700 text-[10px] hover:bg-green-100"><Receipt className="w-2.5 h-2.5" />INV</span>
                                    </Link>
                                  )}
                                  {dn && (
                                    <Link href={`/accounts/delivery-notes/${dn.id}`} onClick={e => e.stopPropagation()} title="Delivery Note">
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 text-[10px] hover:bg-purple-100"><Package className="w-2.5 h-2.5" />DN</span>
                                    </Link>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  function indexBy<T extends { id: number }>(rows: T[] | undefined, key: string): Map<number, T> {
    const m = new Map<number, T>();
    for (const r of (rows ?? []) as any[]) {
      const k = r[key];
      if (typeof k === "number" && !m.has(k)) m.set(k, r);
    }
    return m;
  }

  function PipelineStat({ icon: Icon, label, value, tone = "slate" }: {
    icon: React.ComponentType<{ className?: string }>;
    label: string; value: string | number; tone?: "slate" | "blue" | "green" | "amber";
  }) {
    const colors = {
      slate: "bg-slate-100 text-slate-700",
      blue:  "bg-blue-100 text-blue-700",
      green: "bg-emerald-100 text-emerald-700",
      amber: "bg-orange-100 text-orange-700",
    }[tone];
    return (
      <div className="bg-card border rounded-lg px-3 py-2 flex items-center gap-2">
        <div className={`w-7 h-7 rounded-md flex items-center justify-center ${colors}`}><Icon className="w-3.5 h-3.5" /></div>
        <div>
          <div className="text-sm font-bold leading-none">{value}</div>
          <div className="text-[10px] text-muted-foreground">{label}</div>
        </div>
      </div>
    );
  }
  