import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useListDeals, useUpdateDeal, getListDealsQueryKey } from "@workspace/api-client-react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GripVertical, Search, TrendingUp, DollarSign, Briefcase, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Stage {
  key: string;
  label: string;
  description: string;
  accent: string;       // tailwind border colour for the column header
  badge: string;        // tailwind classes for the count badge
}

// 6 stages — matches the existing dealsTable.stage values so no migration is needed.
const STAGES: Stage[] = [
  { key: "new",           label: "New",           description: "Just created", accent: "border-blue-500",   badge: "bg-blue-100 text-blue-700" },
  { key: "qualification", label: "Qualification", description: "Discovery",    accent: "border-purple-500", badge: "bg-purple-100 text-purple-700" },
  { key: "proposal",      label: "Proposal",      description: "Quotation sent", accent: "border-amber-500",  badge: "bg-amber-100 text-amber-700" },
  { key: "negotiation",   label: "Negotiation",   description: "Closing",      accent: "border-orange-500", badge: "bg-orange-100 text-orange-700" },
  { key: "won",           label: "Won",           description: "Closed-won",   accent: "border-emerald-500", badge: "bg-emerald-100 text-emerald-700" },
  { key: "lost",          label: "Lost",          description: "Closed-lost",  accent: "border-red-500",    badge: "bg-red-100 text-red-700" },
];

export function SalesPipeline() {
  const { data: dealsRaw, isLoading } = useListDeals();
  const { filterByCompany } = useActiveCompany();
  const [search, setSearch] = useState("");
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const update = useUpdateDeal({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListDealsQueryKey() }),
      onError: (err: any) => toast({ title: "Could not move deal", description: err?.message ?? "Update failed", variant: "destructive" }),
    },
  });

  const deals = useMemo(() => {
    let rows = filterByCompany(dealsRaw ?? []);
    if (search) {
      const s = search.toLowerCase();
      rows = rows.filter(d => d.title?.toLowerCase().includes(s) || d.clientName?.toLowerCase().includes(s) || d.dealNumber?.toLowerCase().includes(s));
    }
    return rows;
  }, [dealsRaw, filterByCompany, search]);

  const dealsByStage = useMemo(() => {
    const map: Record<string, typeof deals> = {};
    for (const s of STAGES) map[s.key] = [];
    for (const d of deals) {
      const k = map[d.stage] ? d.stage : "new";
      map[k].push(d);
    }
    return map;
  }, [deals]);

  const totalValue = deals.reduce((s, d) => s + Number(d.value ?? 0), 0);
  const openValue = deals.filter(d => !["won", "lost"].includes(d.stage)).reduce((s, d) => s + Number(d.value ?? 0), 0);
  const wonValue = deals.filter(d => d.stage === "won").reduce((s, d) => s + Number(d.value ?? 0), 0);

  // A deal is "stuck" if it hasn't been updated for 7+ days and isn't in a closed stage.
  const STUCK_DAYS = 7;
  const isStuck = (d: any): boolean => {
    if (["won", "lost"].includes(d.stage)) return false;
    const last = new Date(d.updatedAt ?? d.createdAt ?? Date.now()).getTime();
    return (Date.now() - last) / 86_400_000 >= STUCK_DAYS;
  };
  const stuckCount = deals.filter(isStuck).length;

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
    const deal = deals.find(d => d.id === id);
    if (!deal || deal.stage === stage) return;
    // The PUT /deals/:id endpoint expects a CreateDealBody-shaped payload,
    // not a full Deal (which has read-only fields like id, dealNumber,
    // createdAt, updatedAt that the server will reject). Build a clean
    // payload with only the writable fields.
    const payload = {
      title: deal.title,
      clientName: (deal as any).clientName ?? undefined,
      value: deal.value !== undefined && deal.value !== null ? Number(deal.value) : undefined,
      stage,
      probability: deal.probability !== undefined && deal.probability !== null ? Number(deal.probability) : undefined,
      expectedCloseDate: (deal as any).expectedCloseDate ?? undefined,
      assignedToId: (deal as any).assignedToId ?? undefined,
      companyId: (deal as any).companyId ?? undefined,
      leadId: (deal as any).leadId ?? undefined,
      notes: (deal as any).notes ?? undefined,
    };
    update.mutate(
      { id, data: payload as any },
      { onSuccess: () => toast({ title: "Deal moved", description: `${deal.title} → ${STAGES.find(s => s.key === stage)?.label}` }) },
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales Pipeline</h1>
          <p className="text-muted-foreground text-sm">Drag deals between stages to update them in real time.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <PipelineStat icon={Briefcase}  label="All deals"     value={deals.length} />
          <PipelineStat icon={TrendingUp} label="Open value"    value={`AED ${openValue.toLocaleString()}`} tone="blue" />
          <PipelineStat icon={DollarSign} label="Won value"     value={`AED ${wonValue.toLocaleString()}`} tone="green" />
          {stuckCount > 0 && <PipelineStat icon={AlertTriangle} label="Stuck deals" value={stuckCount} tone="amber" />}
        </div>
      </div>

      {stuckCount > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-lg p-2.5 text-sm flex items-center gap-2 text-amber-800 dark:text-amber-300" data-testid="banner-stuck-deals">
          <AlertTriangle className="w-4 h-4" />
          <span><strong>{stuckCount}</strong> deal{stuckCount === 1 ? " has" : "s have"} been stuck for {STUCK_DAYS}+ days — review and act.</span>
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search deals…" className="pl-8" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-pipeline-search" />
        </div>
        <span className="text-xs text-muted-foreground">Total value across pipeline: <strong>AED {totalValue.toLocaleString()}</strong></span>
      </div>

      <div className="overflow-x-auto pb-4">
        <div className="flex gap-3 min-w-max">
          {STAGES.map(stage => {
            const stageDeals = dealsByStage[stage.key] ?? [];
            const stageValue = stageDeals.reduce((s, d) => s + Number(d.value ?? 0), 0);
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
                    <Badge variant="secondary" className={`${stage.badge} text-[10px]`}>{stageDeals.length}</Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{stage.description}</div>
                  <div className="text-[11px] font-medium text-foreground/80 mt-1">AED {stageValue.toLocaleString()}</div>
                </div>
                <div className="p-2 space-y-2 min-h-[300px] max-h-[calc(100vh-340px)] overflow-y-auto">
                  {isLoading ? (
                    <div className="text-xs text-muted-foreground text-center py-6">Loading…</div>
                  ) : stageDeals.length === 0 ? (
                    <div className="text-xs text-muted-foreground/60 text-center py-8 italic">Drop deals here</div>
                  ) : stageDeals.map(d => {
                    const stuck = isStuck(d);
                    return (
                      <div
                        key={d.id}
                        draggable
                        onDragStart={e => handleDragStart(e, d.id)}
                        onDragEnd={() => setDraggingId(null)}
                        className={`bg-card border rounded-lg p-2.5 cursor-grab active:cursor-grabbing hover:shadow-md transition-all ${draggingId === d.id ? "opacity-50" : ""} ${stuck ? "ring-1 ring-amber-300 dark:ring-amber-700" : ""}`}
                        data-testid={`pipeline-card-${d.id}`}
                      >
                        <div className="flex items-start gap-1.5">
                          <GripVertical className="w-3.5 h-3.5 text-muted-foreground/50 mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <Link href={`/crm/deals`} className="block">
                              <div className="flex items-center gap-1">
                                <span className="text-[11px] font-mono text-primary truncate">{d.dealNumber}</span>
                                {stuck && <span title="Stuck — no movement in 7+ days"><AlertTriangle className="w-3 h-3 text-amber-500" /></span>}
                              </div>
                              <div className="text-sm font-semibold leading-tight truncate">{d.title}</div>
                              {d.clientName && <div className="text-[11px] text-muted-foreground truncate">{d.clientName}</div>}
                            </Link>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-xs font-bold text-emerald-600">AED {Number(d.value ?? 0).toLocaleString()}</span>
                              <span className="text-[10px] text-muted-foreground">{d.probability ?? 0}%</span>
                            </div>
                            {d.expectedCloseDate && (
                              <div className="text-[10px] text-muted-foreground mt-0.5">Close: {d.expectedCloseDate}</div>
                            )}
                            {(d as any).assignedToName && (
                              <div className="text-[10px] text-muted-foreground mt-0.5">@ {(d as any).assignedToName}</div>
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

function PipelineStat({ icon: Icon, label, value, tone = "slate" }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string | number; tone?: "slate" | "blue" | "green" | "amber";
}) {
  const colors = {
    slate: "bg-slate-100 text-slate-700",
    blue:  "bg-blue-100 text-blue-700",
    green: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
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
