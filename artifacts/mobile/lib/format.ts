// Shared formatting / status helpers for CRM + Sales screens.

export type Tone = "navy" | "blue" | "orange" | "muted" | "success" | "destructive";

export function fmtAed(n: number | string | undefined | null): string {
  const v = typeof n === "string" ? parseFloat(n) : n;
  if (v == null || !Number.isFinite(v)) return "AED 0";
  return `AED ${v.toLocaleString("en-AE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function fmtCompact(n: number | string | undefined | null): string {
  const v = typeof n === "string" ? parseFloat(n) : n;
  if (v == null || !Number.isFinite(v)) return "—";
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return v.toFixed(0);
}

export function num(v: unknown, fallback = 0): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

export function fmtDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateShort(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export function fmtRelative(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const diff = (d.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (Math.abs(diff) < 1) return diff < 0 ? "Today (overdue)" : "Today";
  if (diff < 0) return `${Math.round(-diff)}d overdue`;
  if (diff < 7) return `In ${Math.round(diff)}d`;
  return fmtDate(value);
}

export function isOverdue(value?: string | null): boolean {
  if (!value) return false;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() < Date.now() - 60_000;
}

// ---------------------------------------------------------------------------
// Status / stage metadata
// ---------------------------------------------------------------------------

export interface StatusMeta { label: string; tone: Tone }

export const LEAD_STATUSES: { value: string; label: string; tone: Tone }[] = [
  { value: "new",                 label: "New",               tone: "blue" },
  { value: "contacted",           label: "Contacted",         tone: "navy" },
  { value: "qualified",           label: "Qualified",         tone: "orange" },
  { value: "site_visit",          label: "Site visit",        tone: "orange" },
  { value: "quotation_required",  label: "Quote required",    tone: "orange" },
  { value: "quotation_sent",      label: "Quote sent",        tone: "orange" },
  { value: "negotiation",         label: "Negotiation",       tone: "orange" },
  { value: "won",                 label: "Won",               tone: "success" },
  { value: "lost",                label: "Lost",              tone: "destructive" },
];

export const LEAD_SCORES: { value: string; label: string; tone: Tone }[] = [
  { value: "hot",  label: "Hot",  tone: "destructive" },
  { value: "warm", label: "Warm", tone: "orange" },
  { value: "cold", label: "Cold", tone: "blue" },
];

export const DEAL_STAGES: { value: string; label: string; tone: Tone }[] = [
  { value: "new",            label: "New",            tone: "blue" },
  { value: "qualification",  label: "Qualification",  tone: "navy" },
  { value: "proposal",       label: "Proposal",       tone: "orange" },
  { value: "negotiation",    label: "Negotiation",    tone: "orange" },
  { value: "won",            label: "Won",            tone: "success" },
  { value: "lost",           label: "Lost",           tone: "destructive" },
];

export const ACTIVITY_TYPES: { value: string; label: string }[] = [
  { value: "call",       label: "Call" },
  { value: "email",      label: "Email" },
  { value: "meeting",    label: "Meeting" },
  { value: "site_visit", label: "Site visit" },
  { value: "follow_up",  label: "Follow-up" },
  { value: "task",       label: "Task" },
  { value: "note",       label: "Note" },
  { value: "other",      label: "Other" },
];

export const QUOTATION_STATUSES: { value: string; label: string; tone: Tone }[] = [
  { value: "draft",     label: "Draft",     tone: "muted" },
  { value: "sent",      label: "Sent",      tone: "blue" },
  { value: "approved",  label: "Approved",  tone: "success" },
  { value: "rejected",  label: "Rejected",  tone: "destructive" },
  { value: "expired",   label: "Expired",   tone: "muted" },
];

export const PI_STATUSES: { value: string; label: string; tone: Tone }[] = [
  { value: "draft",     label: "Draft",     tone: "muted" },
  { value: "sent",      label: "Sent",      tone: "blue" },
  { value: "paid",      label: "Paid",      tone: "success" },
  { value: "cancelled", label: "Cancelled", tone: "destructive" },
];

export const LPO_STATUSES: { value: string; label: string; tone: Tone }[] = [
  { value: "active",    label: "Active",    tone: "success" },
  { value: "closed",    label: "Closed",    tone: "muted" },
  { value: "cancelled", label: "Cancelled", tone: "destructive" },
];

function find(list: { value: string; label: string; tone: Tone }[], v?: string): StatusMeta {
  const hit = list.find(x => x.value === (v ?? "").toLowerCase());
  return hit ?? { label: v ?? "—", tone: "muted" };
}

export function leadStatusMeta(s?: string): StatusMeta { return find(LEAD_STATUSES, s); }
export function leadScoreMeta(s?: string): StatusMeta { return find(LEAD_SCORES, s); }
export function dealStageMeta(s?: string): StatusMeta { return find(DEAL_STAGES, s); }
export function quotationStatusMeta(s?: string): StatusMeta { return find(QUOTATION_STATUSES, s); }
export function piStatusMeta(s?: string): StatusMeta { return find(PI_STATUSES, s); }
export function lpoStatusMeta(s?: string): StatusMeta { return find(LPO_STATUSES, s); }

export function activityTypeLabel(t?: string): string {
  return ACTIVITY_TYPES.find(x => x.value === (t ?? "").toLowerCase())?.label ?? (t ?? "—");
}

// ---------------------------------------------------------------------------
// Accounts module statuses & meta
// ---------------------------------------------------------------------------

export const PAYMENT_STATUSES: { value: string; label: string; tone: Tone }[] = [
  { value: "unpaid",  label: "Unpaid",  tone: "destructive" },
  { value: "partial", label: "Partial", tone: "orange" },
  { value: "paid",    label: "Paid",    tone: "success" },
];

export const CHEQUE_STATUSES: { value: string; label: string; tone: Tone }[] = [
  { value: "draft",     label: "Draft",     tone: "muted" },
  { value: "approved",  label: "Approved",  tone: "blue" },
  { value: "printed",   label: "Printed",   tone: "navy" },
  { value: "issued",    label: "Issued",    tone: "orange" },
  { value: "cleared",   label: "Cleared",   tone: "success" },
  { value: "bounced",   label: "Bounced",   tone: "destructive" },
  { value: "cancelled", label: "Cancelled", tone: "destructive" },
];

export const EXPENSE_STATUSES: { value: string; label: string; tone: Tone }[] = [
  { value: "pending",  label: "Pending",  tone: "orange" },
  { value: "approved", label: "Approved", tone: "success" },
  { value: "rejected", label: "Rejected", tone: "destructive" },
];

export const JE_STATUSES: { value: string; label: string; tone: Tone }[] = [
  { value: "draft",    label: "Draft",    tone: "muted" },
  { value: "approved", label: "Approved", tone: "success" },
  { value: "rejected", label: "Rejected", tone: "destructive" },
];

export const ACCOUNT_TYPES: { value: string; label: string }[] = [
  { value: "asset",     label: "Asset" },
  { value: "liability", label: "Liability" },
  { value: "equity",    label: "Equity" },
  { value: "revenue",   label: "Revenue" },
  { value: "expense",   label: "Expense" },
];

export const EXPENSE_CATEGORIES: { value: string; label: string }[] = [
  { value: "office",        label: "Office" },
  { value: "travel",        label: "Travel" },
  { value: "fuel",          label: "Fuel" },
  { value: "utilities",     label: "Utilities" },
  { value: "rent",          label: "Rent" },
  { value: "salary",        label: "Salary" },
  { value: "materials",     label: "Materials" },
  { value: "subcontractor", label: "Subcontractor" },
  { value: "marketing",     label: "Marketing" },
  { value: "professional",  label: "Professional fees" },
  { value: "other",         label: "Other" },
];

export const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: "cash",          label: "Cash" },
  { value: "cheque",        label: "Cheque" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "card",          label: "Card" },
  { value: "online",        label: "Online" },
  { value: "other",         label: "Other" },
];

export function paymentStatusMeta(s?: string): StatusMeta { return find(PAYMENT_STATUSES, s); }
export function chequeStatusMeta(s?: string): StatusMeta { return find(CHEQUE_STATUSES, s); }
export function expenseStatusMeta(s?: string): StatusMeta { return find(EXPENSE_STATUSES, s); }
export function jeStatusMeta(s?: string): StatusMeta { return find(JE_STATUSES, s); }

export function accountTypeLabel(t?: string): string {
  return ACCOUNT_TYPES.find(x => x.value === (t ?? "").toLowerCase())?.label ?? (t ?? "—");
}
export function expenseCategoryLabel(t?: string): string {
  return EXPENSE_CATEGORIES.find(x => x.value === (t ?? "").toLowerCase())?.label ?? (t ?? "—");
}
export function paymentMethodLabel(t?: string): string {
  return PAYMENT_METHODS.find(x => x.value === (t ?? "").toLowerCase())?.label ?? (t ?? "—");
}

// ---------------------------------------------------------------------------
// Procurement / Inventory / Assets statuses
// ---------------------------------------------------------------------------

export const SUPPLIER_STATUSES: { value: string; label: string; tone: Tone }[] = [
  { value: "active",   label: "Active",   tone: "success" },
  { value: "inactive", label: "Inactive", tone: "muted" },
  { value: "blocked",  label: "Blocked",  tone: "destructive" },
];

export const PR_STATUSES: { value: string; label: string; tone: Tone }[] = [
  { value: "draft",     label: "Draft",     tone: "muted" },
  { value: "submitted", label: "Submitted", tone: "blue" },
  { value: "approved",  label: "Approved",  tone: "success" },
  { value: "rejected",  label: "Rejected",  tone: "destructive" },
];

export const PR_PRIORITIES: { value: string; label: string; tone: Tone }[] = [
  { value: "low",    label: "Low",    tone: "muted" },
  { value: "normal", label: "Normal", tone: "blue" },
  { value: "high",   label: "High",   tone: "orange" },
  { value: "urgent", label: "Urgent", tone: "destructive" },
];

export const RFQ_STATUSES: { value: string; label: string; tone: Tone }[] = [
  { value: "draft",              label: "Draft",              tone: "muted" },
  { value: "sent",               label: "Sent",               tone: "blue" },
  { value: "quotation_received", label: "Quotation received", tone: "orange" },
  { value: "closed",             label: "Closed",             tone: "muted" },
];

export const SQ_STATUSES: { value: string; label: string; tone: Tone }[] = [
  { value: "received", label: "Received", tone: "blue" },
  { value: "selected", label: "Selected", tone: "success" },
  { value: "rejected", label: "Rejected", tone: "destructive" },
];

export const PO_STATUSES: { value: string; label: string; tone: Tone }[] = [
  { value: "draft",     label: "Draft",     tone: "muted" },
  { value: "submitted", label: "Submitted", tone: "blue" },
  { value: "approved",  label: "Approved",  tone: "success" },
  { value: "rejected",  label: "Rejected",  tone: "destructive" },
  { value: "received",  label: "Received",  tone: "navy" },
  { value: "closed",    label: "Closed",    tone: "muted" },
];

export const STOCK_ENTRY_TYPES: { value: string; label: string; tone: Tone }[] = [
  { value: "stock_in",         label: "Stock in",         tone: "success" },
  { value: "stock_out",        label: "Stock out",        tone: "destructive" },
  { value: "material_return",  label: "Return",           tone: "blue" },
  { value: "adjustment",       label: "Adjustment",       tone: "muted" },
];

export const ASSET_CONDITIONS: { value: string; label: string; tone: Tone }[] = [
  { value: "excellent", label: "Excellent", tone: "success" },
  { value: "good",      label: "Good",      tone: "blue" },
  { value: "fair",      label: "Fair",      tone: "orange" },
  { value: "poor",      label: "Poor",      tone: "destructive" },
];

export const ASSET_STATUSES: { value: string; label: string; tone: Tone }[] = [
  { value: "active",       label: "In use",       tone: "success" },
  { value: "in_use",       label: "In use",       tone: "success" },
  { value: "maintenance",  label: "Maintenance",  tone: "orange" },
  { value: "retired",      label: "Retired",      tone: "muted" },
  { value: "disposed",     label: "Disposed",     tone: "destructive" },
];

export function supplierStatusMeta(s?: string): StatusMeta { return find(SUPPLIER_STATUSES, s); }
export function prStatusMeta(s?: string): StatusMeta { return find(PR_STATUSES, s); }
export function prPriorityMeta(s?: string): StatusMeta { return find(PR_PRIORITIES, s); }
export function rfqStatusMeta(s?: string): StatusMeta { return find(RFQ_STATUSES, s); }
export function sqStatusMeta(s?: string): StatusMeta { return find(SQ_STATUSES, s); }
export function poStatusMeta(s?: string): StatusMeta { return find(PO_STATUSES, s); }
export function stockEntryTypeMeta(s?: string): StatusMeta { return find(STOCK_ENTRY_TYPES, s); }
export function assetConditionMeta(s?: string): StatusMeta { return find(ASSET_CONDITIONS, s); }
export function assetStatusMeta(s?: string): StatusMeta { return find(ASSET_STATUSES, s); }

export function activityTypeIcon(t?: string): "phone" | "mail" | "users" | "map-pin" | "rotate-cw" | "check-square" | "edit-3" | "circle" {
  switch ((t ?? "").toLowerCase()) {
    case "call":       return "phone";
    case "email":      return "mail";
    case "meeting":    return "users";
    case "site_visit": return "map-pin";
    case "follow_up":  return "rotate-cw";
    case "task":       return "check-square";
    case "note":       return "edit-3";
    default:           return "circle";
  }
}
