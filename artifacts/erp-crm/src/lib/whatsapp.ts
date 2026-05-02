export type WaContext =
  | "lead"
  | "contact"
  | "deal"
  | "quotation"
  | "proforma"
  | "invoice"
  | "project"
  | "general";

export interface WaTemplateVars {
  name?: string;
  companyName?: string;
  number?: string;
  amount?: string;
  dueDate?: string;
  date?: string;
  link?: string;
  custom?: string;
  sender?: string;
}

export interface WaTemplate {
  id: string;
  label: string;
  description: string;
  contexts: WaContext[];
  render: (v: WaTemplateVars) => string;
}

const aed = (a?: string) => (a ? `AED ${a}` : "");
const greet = (n?: string) => (n ? `Hi ${n}` : "Hello");
const sign = (s?: string) => (s ? `\n\nBest regards,\n${s}\nPrime Max & Elite Prefab` : "\n\nBest regards,\nPrime Max & Elite Prefab");

export const WA_TEMPLATES: WaTemplate[] = [
  {
    id: "lead_intro",
    label: "Lead — Introduction",
    description: "First-touch intro to a new lead",
    contexts: ["lead", "contact", "general"],
    render: v => `${greet(v.name)},\n\nThank you for your interest in Prime Max & Elite Prefab. We specialise in high-quality prefabricated buildings, portable cabins, and modular construction across the UAE.\n\nCould we schedule a quick call to understand your project requirements?${sign(v.sender)}`,
  },
  {
    id: "lead_followup",
    label: "Lead — Follow-up",
    description: "Polite follow-up if no reply",
    contexts: ["lead", "contact", "deal", "general"],
    render: v => `${greet(v.name)},\n\nJust following up on our earlier conversation. Is there a good time this week to discuss your prefab requirements? Happy to share references and arrange a site visit if useful.${sign(v.sender)}`,
  },
  {
    id: "site_visit_confirm",
    label: "Site visit — Confirmation",
    description: "Confirm a scheduled site visit",
    contexts: ["lead", "deal", "project", "general"],
    render: v => `${greet(v.name)},\n\nConfirming our site visit${v.date ? ` on ${v.date}` : ""}. Our team will arrive at the agreed time. Please let us know if anything changes.${sign(v.sender)}`,
  },
  {
    id: "quote_sent",
    label: "Quotation — Sent",
    description: "Notify client a quote was sent",
    contexts: ["quotation", "deal", "lead", "general"],
    render: v => `${greet(v.name)},\n\nYour quotation${v.number ? ` ${v.number}` : ""}${v.amount ? ` for ${aed(v.amount)}` : ""} has been sent to your email. Please review at your convenience and let us know if you have any questions or would like adjustments.${sign(v.sender)}`,
  },
  {
    id: "quote_followup",
    label: "Quotation — Follow-up",
    description: "Check on quote acceptance",
    contexts: ["quotation", "deal", "general"],
    render: v => `${greet(v.name)},\n\nChecking in on quotation${v.number ? ` ${v.number}` : ""}. Would you like to proceed, or are there any clarifications we can help with?${sign(v.sender)}`,
  },
  {
    id: "proforma_sent",
    label: "Proforma Invoice — Sent",
    description: "Proforma issued (advance payment)",
    contexts: ["proforma", "invoice", "general"],
    render: v => `${greet(v.name)},\n\nProforma invoice${v.number ? ` ${v.number}` : ""}${v.amount ? ` for ${aed(v.amount)}` : ""} has been issued.${v.dueDate ? ` Kindly arrange payment by ${v.dueDate}` : " Kindly arrange payment at your earliest convenience"} so we can begin production. Bank details are on the invoice.${sign(v.sender)}`,
  },
  {
    id: "invoice_sent",
    label: "Tax Invoice — Sent",
    description: "Tax invoice issued",
    contexts: ["invoice", "general"],
    render: v => `${greet(v.name)},\n\nTax invoice${v.number ? ` ${v.number}` : ""}${v.amount ? ` for ${aed(v.amount)}` : ""} has been issued and emailed.${v.dueDate ? ` Payment due by ${v.dueDate}.` : ""} Thank you for your business.${sign(v.sender)}`,
  },
  {
    id: "payment_reminder",
    label: "Payment — Friendly reminder",
    description: "Soft reminder for due/overdue invoice",
    contexts: ["invoice", "proforma", "general"],
    render: v => `${greet(v.name)},\n\nThis is a friendly reminder that invoice${v.number ? ` ${v.number}` : ""}${v.amount ? ` for ${aed(v.amount)}` : ""} is pending${v.dueDate ? ` (due ${v.dueDate})` : ""}. Could you kindly confirm the payment status? Happy to share the invoice copy again if needed.${sign(v.sender)}`,
  },
  {
    id: "payment_received",
    label: "Payment — Receipt confirmation",
    description: "Acknowledge a payment received",
    contexts: ["invoice", "proforma", "general"],
    render: v => `${greet(v.name)},\n\nThank you${v.amount ? ` — we have received your payment of ${aed(v.amount)}` : " for your payment"}${v.number ? ` against invoice ${v.number}` : ""}. Your official receipt will follow by email.${sign(v.sender)}`,
  },
  {
    id: "delivery_update",
    label: "Project — Delivery update",
    description: "Share a project / delivery update",
    contexts: ["project", "deal", "general"],
    render: v => `${greet(v.name)},\n\nUpdate on project${v.number ? ` ${v.number}` : ""}: ${v.custom || "we are progressing on schedule and will share the next milestone shortly."}${sign(v.sender)}`,
  },
  {
    id: "project_milestone",
    label: "Project — Milestone reached",
    description: "Notify a milestone completion",
    contexts: ["project", "general"],
    render: v => `${greet(v.name)},\n\nGood news — project${v.number ? ` ${v.number}` : ""} has reached an important milestone. Our team will share full details and the next steps shortly.${sign(v.sender)}`,
  },
  {
    id: "thank_you",
    label: "Thank you / closing",
    description: "Closing / thank-you message",
    contexts: ["lead", "contact", "deal", "quotation", "proforma", "invoice", "project", "general"],
    render: v => `${greet(v.name)},\n\nThank you — it was a pleasure working with you. We look forward to our continued partnership.${sign(v.sender)}`,
  },
  {
    id: "custom",
    label: "Custom message",
    description: "Write your own",
    contexts: ["lead", "contact", "deal", "quotation", "proforma", "invoice", "project", "general"],
    render: v => v.custom || "",
  },
];

export function templatesForContext(ctx: WaContext): WaTemplate[] {
  return WA_TEMPLATES.filter(t => t.contexts.includes(ctx));
}

export function normalizeWaPhone(raw?: string | null): string {
  if (!raw) return "";
  const trimmed = String(raw).trim();
  if (!trimmed) return "";
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/[^0-9]/g, "");
  if (!digits) return "";
  if (hasPlus) return digits;
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("971")) return digits;
  if (digits.startsWith("0") && digits.length === 10) return "971" + digits.slice(1);
  if (digits.length === 9 && (digits.startsWith("5") || digits.startsWith("4") || digits.startsWith("2") || digits.startsWith("3") || digits.startsWith("6") || digits.startsWith("7") || digits.startsWith("9"))) return "971" + digits;
  return digits;
}

export function isValidWaPhone(raw?: string | null): boolean {
  const n = normalizeWaPhone(raw);
  return n.length >= 8 && n.length <= 15;
}

export function buildWaUrl(phone: string, message: string): string {
  const p = normalizeWaPhone(phone);
  const text = encodeURIComponent(message ?? "");
  if (!p) return `https://wa.me/?text=${text}`;
  return `https://wa.me/${p}?text=${text}`;
}

export const WA_ACTIVITY_TYPE = "whatsapp";

export function buildActivitySubject(ctx: WaContext, template: WaTemplate, vars: WaTemplateVars): string {
  const who = vars.name || vars.companyName || "client";
  const ref = vars.number ? ` (${vars.number})` : "";
  const ctxLabel = ctx === "general" ? "" : ` · ${ctx}`;
  return `WhatsApp: ${template.label} → ${who}${ref}${ctxLabel}`;
}

export function previewActivityDescription(message: string, phone?: string | null): string {
  const head = phone ? `To: +${normalizeWaPhone(phone)}\n\n` : "";
  const body = message.length > 800 ? message.slice(0, 800) + "…" : message;
  return head + body;
}
