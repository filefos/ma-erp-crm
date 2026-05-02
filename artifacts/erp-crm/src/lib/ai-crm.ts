// AI helper module for Elite & Prime Max Pro CRM.
//
// Phase 1 ships pure heuristic logic so the UX can be built end-to-end
// today without an external API. The function signatures are stable so a
// future upgrade can swap the implementations to call OpenAI / Anthropic
// using OPENAI_API_KEY without changing any caller.

export interface LeadLike {
  leadName?: string | null;
  companyName?: string | null;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  location?: string | null;
  source?: string | null;
  requirementType?: string | null;
  budget?: number | string | null;
  status?: string | null;
  leadScore?: string | null;
  nextFollowUp?: string | null;
  notes?: string | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
}

export interface ActivityLike {
  id: number;
  type: string;
  subject: string;
  isDone?: boolean;
  dueDate?: string | null;
  description?: string | null;
  createdAt?: string | Date | null;
}

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
};

const daysSince = (d: string | Date | null | undefined): number => {
  if (!d) return Infinity;
  const ms = typeof d === "string" ? Date.parse(d) : d.getTime();
  if (!Number.isFinite(ms)) return Infinity;
  return Math.floor((Date.now() - ms) / 86_400_000);
};

const HIGH_VALUE_SOURCES = new Set(["referral", "tender", "exhibition"]);

/** Returns a 0-100 score, a hot/warm/cold band, and a list of reasons. */
export function scoreLead(lead: LeadLike, activities: ActivityLike[] = []) {
  let score = 30;
  const reasons: string[] = [];

  const budget = num(lead.budget);
  if (budget >= 1_000_000)        { score += 30; reasons.push(`Strong budget (AED ${budget.toLocaleString()})`); }
  else if (budget >= 250_000)     { score += 20; reasons.push(`Healthy budget (AED ${budget.toLocaleString()})`); }
  else if (budget >= 50_000)      { score += 10; reasons.push(`Moderate budget (AED ${budget.toLocaleString()})`); }
  else if (budget > 0)            { score += 5;  reasons.push(`Small budget (AED ${budget.toLocaleString()})`); }
  else                            { reasons.push("No budget captured"); }

  if (lead.source && HIGH_VALUE_SOURCES.has(lead.source)) {
    score += 15;
    reasons.push(`High-quality source (${lead.source.replace(/_/g, " ")})`);
  }

  const recencyDays = daysSince(lead.updatedAt ?? lead.createdAt);
  if (recencyDays <= 3)        { score += 15; reasons.push("Updated within the last 3 days"); }
  else if (recencyDays <= 14)  { score += 5;  reasons.push("Active in the last 2 weeks"); }
  else if (recencyDays > 30)   { score -= 10; reasons.push(`Stale (${recencyDays} days since last update)`); }

  const completed = activities.filter(a => a.isDone).length;
  if (completed >= 3)          { score += 10; reasons.push(`${completed} completed activities`); }
  else if (completed >= 1)     { score += 5;  reasons.push(`${completed} completed activities`); }

  if (lead.email && lead.phone) { score += 5; reasons.push("Full contact info on file"); }
  if (lead.whatsapp)            { score += 3; reasons.push("WhatsApp available"); }
  if (lead.requirementType)     { score += 5; reasons.push(`Requirement defined: ${lead.requirementType}`); }
  if (lead.nextFollowUp)        { score += 5; reasons.push("Next follow-up scheduled"); }

  if (lead.status === "negotiation" || lead.status === "quotation_sent") {
    score += 10; reasons.push(`Advanced stage (${lead.status.replace(/_/g, " ")})`);
  }
  if (lead.status === "lost") { score = Math.min(score, 25); reasons.push("Marked as lost"); }
  if (lead.status === "won")  { score = 100; reasons.push("Deal already won"); }

  score = Math.max(0, Math.min(100, score));
  const band: "hot" | "warm" | "cold" =
    score >= 70 ? "hot" : score >= 45 ? "warm" : "cold";

  return { score, band, reasons };
}

/** Suggest the next best action for the salesperson. */
export function suggestNextAction(lead: LeadLike, activities: ActivityLike[] = []): string {
  const today = new Date().toISOString().slice(0, 10);
  const overdue = lead.nextFollowUp && lead.nextFollowUp < today;
  const last = activities[0];

  if (lead.status === "won")  return "Hand over to Projects and create a Sales Order from the won deal.";
  if (lead.status === "lost") return "Capture the lost-reason in notes and archive — review for win-back in 90 days.";
  if (overdue)                return `OVERDUE follow-up since ${lead.nextFollowUp}. Call ${lead.contactPerson ?? lead.leadName ?? "the contact"} now and reschedule.`;

  switch (lead.status) {
    case "new":                return "Make first contact within 24 hours — call, then send a WhatsApp introduction.";
    case "contacted":          return "Qualify the requirement: confirm scope, timeline, decision-maker, and budget.";
    case "qualified":          return "Book a site visit to scope the project and meet the decision-maker.";
    case "site_visit":         return "Issue a detailed quotation within 48 hours of the visit.";
    case "quotation_required": return "Prepare quotation with itemised pricing and a clear delivery timeline.";
    case "quotation_sent":     return last?.type === "follow_up"
      ? "Quote was followed up. Push for a meeting to negotiate and close."
      : "Follow up on the sent quotation in 2 business days.";
    case "negotiation":        return "Offer a closing concession (payment terms, free delivery, schedule lock-in) to win the deal.";
    default:                   return "Review the lead, set a clear next-step and a follow-up date within the week.";
  }
}

/** Templated, professional follow-up email/note body. */
export function generateFollowUpMessage(lead: LeadLike): string {
  const name = lead.contactPerson || lead.leadName || "there";
  const company = lead.companyName ? ` at ${lead.companyName}` : "";
  const req = lead.requirementType ? ` regarding your ${lead.requirementType.toLowerCase()} requirement` : "";
  return [
    `Dear ${name},`,
    "",
    `Thank you for your interest in Prime Max & Elite Prefab${req}.`,
    "",
    "I wanted to follow up and check whether you've had a chance to review our proposal, and if you have any clarifications or adjustments you'd like us to incorporate. We're ready to support you on timeline, technical specifications and on-site coordination as needed.",
    "",
    `Could we schedule a short call this week to walk through the next steps for ${company || "your project"}?`,
    "",
    "Best regards,",
    "Sales Team — Elite & Prime Max",
  ].join("\n");
}

/** Short, friendly WhatsApp message. */
export function generateWhatsAppMessage(lead: LeadLike): string {
  const name = lead.contactPerson || lead.leadName || "there";
  const req = lead.requirementType ? ` for your ${lead.requirementType.toLowerCase()}` : "";
  return `Hi ${name}, this is the sales team at Prime Max & Elite Prefab. Following up${req} — happy to share an updated quote or schedule a quick site visit at your convenience. When works best for you?`;
}

/** Plain-language client summary suitable for an executive briefing. */
export function summarizeClient(lead: LeadLike, activities: ActivityLike[] = []): string {
  const lines: string[] = [];
  lines.push(`${lead.leadName ?? "Unknown lead"}${lead.companyName ? ` (${lead.companyName})` : ""} — current stage: ${(lead.status ?? "new").replace(/_/g, " ")}.`);
  if (lead.requirementType) lines.push(`Requirement: ${lead.requirementType}${lead.location ? ` in ${lead.location}` : ""}.`);
  const budget = num(lead.budget);
  if (budget > 0) lines.push(`Stated budget: AED ${budget.toLocaleString()}.`);
  if (lead.source) lines.push(`Source: ${lead.source.replace(/_/g, " ")}.`);
  if (activities.length) {
    const done = activities.filter(a => a.isDone).length;
    lines.push(`${activities.length} touchpoints recorded (${done} completed). Last: ${activities[0]?.subject ?? "-"}.`);
  } else {
    lines.push("No activities logged yet — start by logging the first call or meeting.");
  }
  if (lead.nextFollowUp) lines.push(`Next follow-up scheduled for ${lead.nextFollowUp}.`);
  return lines.join(" ");
}

/** Heuristic duplicate detector — returns leads with same phone/email/whatsapp. */
export function findDuplicates<T extends LeadLike & { id: number }>(target: T, all: T[]): T[] {
  const norm = (s: string | null | undefined) => (s ?? "").replace(/[^a-z0-9]/gi, "").toLowerCase();
  const phone = norm(target.phone);
  const wa    = norm(target.whatsapp);
  const email = norm(target.email);
  if (!phone && !wa && !email) return [];
  return all.filter(l => {
    if (l.id === target.id) return false;
    return (phone && norm(l.phone) === phone)
        || (wa    && norm(l.whatsapp) === wa)
        || (email && norm(l.email) === email);
  });
}
