import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { HelpCircle, ChevronRight, Loader2, RotateCcw } from "lucide-react";
import { authHeaders } from "@/lib/ai-client";

type PageKey =
  | "lpos"
  | "quotations"
  | "proforma_invoices"
  | "tax_invoices"
  | "delivery_notes"
  | "customer_profile"
  | "crm_contacts"
  | "crm_leads"
  | "sales_pipeline"
  | "accounts_dashboard"
  | "handover_notes"
  | "undertaking_letters"
  | "expenses"
  | "payments"
  | "journal_entries"
  | "vat_report"
  | "purchase_orders"
  | "inventory"
  | "projects"
  | "hr_employees"
  | "general";

interface PageMeta {
  title: string;
  description: string;
  module: string;
  steps: string[];
  tips: string[];
  questions: string[];
}

const PAGE_META: Record<PageKey, PageMeta> = {
  lpos: {
    title: "LPO Register",
    description: "This page manages Local Purchase Orders (LPOs) received from your clients. An LPO is a formal purchase order document that your client sends to you, confirming they want to buy your goods/services.",
    module: "sales",
    steps: [
      "Click 'Register LPO' to enter a new client LPO",
      "Link it to your Quotation using the 'Our Quotation #' picker — this auto-fills payment terms, client name, and value",
      "Enter the client's LPO number exactly as it appears on their document",
      "Save — a draft Proforma Invoice and Tax Invoice are auto-created",
      "View details by clicking any LPO row in the table",
    ],
    tips: [
      "The LPO number must be the client's original reference, not a system number",
      "Payment terms are locked to the linked quotation — they cannot be changed manually",
      "Use the AI Extract button to auto-fill fields by uploading a photo of the LPO document",
    ],
    questions: [
      "How do I link an LPO to a quotation?",
      "Why is payment terms read-only?",
      "How do I download the LPO as a PDF?",
      "What happens when I register an LPO?",
    ],
  },
  quotations: {
    title: "Quotations",
    description: "Manage commercial quotations sent to clients. Quotations define the scope of work, pricing, VAT, and payment terms for each project.",
    module: "sales",
    steps: [
      "Click 'New Quotation' to create a fresh commercial offer",
      "Fill in client name, project details, and line items",
      "Set payment terms — these flow through to all linked LPOs and invoices",
      "Approve the quotation once it is finalized",
      "Use 'Send Email' to email the PDF directly to the client",
    ],
    tips: [
      "Payment terms set here will be locked into any LPO that links to this quotation",
      "The quotation number (e.g. PM-Q-2025-001) is used as the reference throughout the system",
    ],
    questions: [
      "How do I approve a quotation?",
      "How do I add line items with VAT?",
      "What payment terms should I use?",
    ],
  },
  proforma_invoices: {
    title: "Proforma Invoices",
    description: "Proforma invoices are draft invoices issued before the final tax invoice. They are typically sent to request advance payment or to confirm order details.",
    module: "sales",
    steps: [
      "Proformas are auto-created when you register an LPO",
      "Review the auto-created proforma and edit if needed",
      "Approve it and send to the client via email",
      "Once payment is received, raise the final Tax Invoice",
    ],
    tips: [
      "Proforma invoices are not VAT-compliant tax documents — always issue a Tax Invoice after payment",
      "Payment terms are inherited from the linked quotation",
    ],
    questions: [
      "When should I issue a proforma vs a tax invoice?",
      "How do I edit a proforma invoice?",
    ],
  },
  tax_invoices: {
    title: "Tax Invoices",
    description: "VAT-compliant tax invoices for UAE FTA requirements. These are the official billing documents you issue to clients for completed work.",
    module: "accounts",
    steps: [
      "Tax invoices are auto-created when you register an LPO",
      "Verify all amounts — VAT is calculated automatically",
      "Approve and send the invoice to the client",
      "Mark as Paid when payment is received",
      "Check the VAT Report to see tax summary for the period",
    ],
    tips: [
      "UAE VAT is currently 5% — verify this is applied correctly",
      "Your company TRN must appear on every tax invoice",
      "Keep copies of all tax invoices for FTA audit purposes",
    ],
    questions: [
      "How do I mark an invoice as paid?",
      "How does VAT appear on the invoice?",
      "Where do I see outstanding invoices?",
    ],
  },
  delivery_notes: {
    title: "Delivery Notes",
    description: "Track delivery of goods/services to clients. Once signed by the client, upload the signed copy to confirm delivery completion.",
    module: "accounts",
    steps: [
      "A delivery note is created when goods are dispatched to the client",
      "Print or download the delivery note and send with the delivery",
      "After delivery, get the client's signature on the physical copy",
      "Upload the signed copy using the 'Upload Signed Copy' button on the detail page",
      "Mark the delivery note as 'Delivered' once signed copy is received",
    ],
    tips: [
      "Always keep a signed copy — it is your proof of delivery",
      "Signed copies are visible in the Customer Profile page under Delivery Notes",
      "Link the delivery note to the correct Tax Invoice for proper tracking",
    ],
    questions: [
      "How do I upload a signed delivery note?",
      "How do I print a delivery note?",
      "Where can I see all delivery notes for a customer?",
    ],
  },
  customer_profile: {
    title: "Customer Profile (360° View)",
    description: "A single page that shows all documents, transactions, and history for one customer — quotations, LPOs, invoices, delivery notes, and outstanding balance.",
    module: "crm",
    steps: [
      "Navigate to CRM → Contacts and click the profile icon for any contact",
      "The Overview shows KPIs: total invoiced, paid, and outstanding balance",
      "Use the tabs to browse Quotations, LPOs, Proforma Invoices, Tax Invoices, and Delivery Notes",
      "Use the search box to filter documents within each tab",
      "Click 'View' on any document to open its detail page",
    ],
    tips: [
      "The outstanding balance is calculated from tax invoices — paid vs unpaid",
      "Signed delivery note status is visible in the Delivery Notes tab",
      "Use this page for client meetings — all project history is in one place",
    ],
    questions: [
      "Why don't I see all documents for this customer?",
      "How is the outstanding balance calculated?",
      "Can I download all documents for a customer?",
    ],
  },
  crm_contacts: {
    title: "Contacts",
    description: "Your client and contact directory. Store contact details, link them to companies, and view their full document history.",
    module: "crm",
    steps: [
      "Click 'Add Contact' to create a new contact record",
      "Fill in name, company, phone, email, and WhatsApp number",
      "Each contact gets a unique client code (e.g. PM-C-001) automatically",
      "Click the profile icon to view all documents for that contact",
      "Use 'Convert to Lead' to move a contact into the sales pipeline",
    ],
    tips: [
      "Client codes link contacts to their quotations, invoices, and LPOs",
      "Use WhatsApp button to send template messages directly from the contact row",
    ],
    questions: [
      "How do I find all invoices for a contact?",
      "How do I convert a contact to a lead?",
      "What is the client code used for?",
    ],
  },
  crm_leads: {
    title: "Leads",
    description: "Track potential sales opportunities. Move leads through stages from initial contact to won or lost.",
    module: "crm",
    steps: [
      "Add a lead with client name, value estimate, and stage",
      "Update the stage as the conversation progresses",
      "Use AI scoring to prioritize which leads to focus on",
      "Convert won leads to quotations",
    ],
    tips: ["Use the Kanban board in Sales Pipeline for a visual view of all active leads"],
    questions: ["How do I score a lead?", "How do I convert a lead to a quotation?"],
  },
  sales_pipeline: {
    title: "Sales Pipeline",
    description: "Kanban board showing all leads organized by stage.",
    module: "crm",
    steps: ["Drag cards between columns to update lead stages", "Click a card to view lead details"],
    tips: ["Color coding shows lead score — red is cold, green is hot"],
    questions: ["How do I move a lead to Won?"],
  },
  accounts_dashboard: {
    title: "Accounts Dashboard",
    description: "Overview of financial KPIs — revenue, outstanding receivables, expenses, and VAT summary.",
    module: "accounts",
    steps: ["Review revenue and outstanding balance widgets", "Check the recent invoices list for overdue items"],
    tips: ["Run the VAT Report monthly before FTA filing deadline"],
    questions: ["How do I see overdue invoices?", "Where is the VAT report?"],
  },
  handover_notes: {
    title: "Handover Notes",
    description: "Formal project handover documents issued when a project is completed and handed over to the client.",
    module: "accounts",
    steps: ["Create a handover note when the project is complete", "Get client signature", "File for project closure"],
    tips: ["Handover notes trigger the final payment milestone in most contracts"],
    questions: ["How do I create a handover note?"],
  },
  undertaking_letters: {
    title: "Undertaking Letters",
    description: "Legal undertaking documents issued to clients for specific commitments.",
    module: "accounts",
    steps: ["Create an undertaking letter", "Download as PDF", "Send to client for signing"],
    tips: ["Keep signed copies in the document record"],
    questions: ["When do I issue an undertaking letter?"],
  },
  expenses: {
    title: "Expenses",
    description: "Track company expenses and costs. Link expenses to projects for accurate cost reporting.",
    module: "accounts",
    steps: ["Add an expense with category, amount, and date", "Attach receipts where possible", "Approve expenses to include them in reports"],
    tips: ["Categorize expenses correctly for accurate VAT and cost reports"],
    questions: ["How do I categorize an expense?", "How do I attach a receipt?"],
  },
  payments: {
    title: "Payments",
    description: "Track payments received from clients and payments made to suppliers.",
    module: "accounts",
    steps: ["Record a payment received by linking it to the invoice", "Record a payment made by linking it to a purchase order"],
    tips: ["Always link payments to the correct document for accurate outstanding balance calculation"],
    questions: ["How do I record a payment?"],
  },
  journal_entries: {
    title: "Journal Entries",
    description: "Manual accounting entries for adjustments, corrections, and non-standard transactions.",
    module: "accounts",
    steps: ["Create a journal entry with debit and credit lines", "Ensure debits equal credits", "Post the entry"],
    tips: ["Use the AI Assistant to suggest journal entries for complex transactions"],
    questions: ["How do I post a journal entry?"],
  },
  vat_report: {
    title: "VAT Report",
    description: "UAE FTA VAT summary report. Shows VAT collected on sales and VAT paid on purchases for a period.",
    module: "accounts",
    steps: ["Select the period (e.g. Q1 2025)", "Review output VAT (from sales) and input VAT (from purchases)", "Export for FTA filing"],
    tips: ["File VAT returns quarterly unless you are on monthly filing", "The current UAE VAT rate is 5%"],
    questions: ["How do I file VAT?", "What is output vs input VAT?"],
  },
  purchase_orders: {
    title: "Purchase Orders",
    description: "Internal purchase orders issued to suppliers for goods and services needed for projects.",
    module: "procurement",
    steps: ["Raise a PR (Purchase Request) first", "Get quotes from suppliers", "Approve the best quote and raise a PO", "Receive goods against the PO"],
    tips: ["Always get at least 3 quotes for significant purchases"],
    questions: ["How do I raise a purchase order?", "How do I receive goods?"],
  },
  inventory: {
    title: "Inventory",
    description: "Track stock levels, receive goods, and issue materials to projects.",
    module: "inventory",
    steps: ["Add items to the item register", "Record stock receipts when goods arrive", "Issue stock to projects when used"],
    tips: ["Set minimum stock levels to get low-stock alerts"],
    questions: ["How do I check stock levels?", "How do I issue stock to a project?"],
  },
  projects: {
    title: "Projects",
    description: "Track project progress, costs, and milestones for each client project.",
    module: "projects",
    steps: ["Projects are auto-created when an LPO is registered", "Update project status as work progresses", "Track costs and compare to budget"],
    tips: ["Project codes (PM-PROJ-001) link projects to invoices and delivery notes"],
    questions: ["How is a project created?", "How do I update project status?"],
  },
  hr_employees: {
    title: "Employees",
    description: "Manage employee records, attendance, leave, and payroll.",
    module: "hr",
    steps: ["Add employee records with personal and contract details", "Record attendance daily or import from timesheet", "Process payroll at month end"],
    tips: ["Keep WPS (Wage Protection System) records for UAE compliance"],
    questions: ["How do I add an employee?", "How do I process payroll?"],
  },
  general: {
    title: "ERP Guide",
    description: "Welcome to Prime Max ERP. This system manages your entire business — from quotations to delivery, from HR to accounts.",
    module: "general",
    steps: [
      "Start from the Dashboard for an overview of today's activity",
      "Use CRM for leads and contacts",
      "Use Sales for quotations, LPOs, and proforma invoices",
      "Use Accounts for tax invoices, delivery notes, and payments",
      "Use Reports for analytics and summaries",
    ],
    tips: ["The 'Ask AI' button in the top bar can answer questions about any module"],
    questions: ["Where do I find overdue invoices?", "How does the document flow work?"],
  },
};

interface HelpButtonProps {
  pageKey: PageKey;
  className?: string;
  size?: "sm" | "default";
}

export function HelpButton({ pageKey, className, size = "sm" }: HelpButtonProps) {
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeQ, setActiveQ] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const meta = PAGE_META[pageKey] ?? PAGE_META.general;

  const ask = async (question: string) => {
    setActiveQ(question);
    setLoading(true);
    setErr(null);
    setAnswer(null);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/ai/ask`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          module: meta.module,
          question,
          context: `User is on the ${meta.title} page of the Prime Max ERP system. ${meta.description}`,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) setErr(j?.message ?? `Error ${res.status}`);
      else setAnswer(String(j.result ?? ""));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => { setAnswer(null); setActiveQ(null); setErr(null); };

  return (
    <>
      <Button
        variant="outline"
        size={size}
        onClick={() => setOpen(true)}
        className={`h-8 gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50 ${className ?? ""}`}
      >
        <HelpCircle className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Help Guide</span>
      </Button>

      <Sheet open={open} onOpenChange={v => { setOpen(v); if (!v) reset(); }}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0 gap-0">
          <SheetHeader className="px-4 py-3 border-b bg-amber-50">
            <SheetTitle className="flex items-center gap-2 text-base text-amber-900">
              <HelpCircle className="w-4 h-4 text-amber-600" />
              {meta.title} — Help Guide
            </SheetTitle>
            <SheetDescription className="text-xs text-amber-700">
              {meta.description}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
            {/* How to use */}
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-2">How to use this page</h3>
              <ol className="space-y-1.5">
                {meta.steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="w-5 h-5 rounded-full bg-[#0f2d5a] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-gray-700">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Tips */}
            {meta.tips.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-2">Tips & common mistakes</h3>
                <ul className="space-y-1.5">
                  {meta.tips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="text-amber-500 mt-0.5 flex-shrink-0">•</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* AI Answer section */}
            {(answer || loading || err) && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
                {activeQ && (
                  <p className="text-xs font-medium text-blue-800">Q: {activeQ}</p>
                )}
                {loading && (
                  <div className="flex items-center gap-2 text-sm text-blue-700">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />Asking AI…
                  </div>
                )}
                {answer && (
                  <p className="text-sm text-blue-900 whitespace-pre-wrap leading-relaxed">{answer}</p>
                )}
                {err && (
                  <p className="text-sm text-red-700">{err}</p>
                )}
                <button onClick={reset} className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                  <RotateCcw className="w-3 h-3" />Ask another question
                </button>
              </div>
            )}

            {/* Quick questions */}
            {!answer && !loading && !err && (
              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-2">Common questions — click to get AI answer</h3>
                <div className="space-y-1.5">
                  {meta.questions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => ask(q)}
                      className="w-full text-left flex items-center gap-2 text-sm px-3 py-2 rounded-lg border bg-white hover:bg-blue-50 hover:border-blue-300 transition-colors group"
                    >
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-blue-600 flex-shrink-0" />
                      <span className="group-hover:text-blue-800">{q}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
