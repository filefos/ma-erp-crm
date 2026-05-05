import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useListExpenses, useListPaymentsReceived, useListPaymentsMade, useListJournalEntries } from "@workspace/api-client-react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import {
  Bot, Sparkles, TrendingUp, TrendingDown, AlertTriangle, FileText, Tag, Bell,
  CheckCircle, Search, BarChart3, Lightbulb, DollarSign, Send,
} from "lucide-react";

type Message = { role: "user" | "assistant"; content: string; ts: number };

const QUICK_ACTIONS = [
  { icon: Tag, label: "Categorize Expenses", prompt: "Analyze my recent expenses and suggest better categories for each one." },
  { icon: AlertTriangle, label: "Cash Flow Warning", prompt: "Analyze the payment data and warn me about any cash flow risks." },
  { icon: TrendingUp, label: "Profit/Loss Explanation", prompt: "Summarize the financial position based on income and expenses." },
  { icon: Bell, label: "Payment Reminder", prompt: "Generate professional payment reminder messages for overdue accounts receivable." },
  { icon: Search, label: "Detect Duplicates", prompt: "Check for any potential duplicate payments or transactions." },
  { icon: CheckCircle, label: "VAT Check", prompt: "Review VAT calculations and flag any discrepancies or missing VAT entries." },
  { icon: FileText, label: "Journal Suggestion", prompt: "Suggest a journal entry for the latest expense transaction." },
  { icon: BarChart3, label: "Expense Summary", prompt: "Summarize expense trends by category and identify the top spending areas." },
];

function generateResponse(prompt: string, data: { expenses: any[]; paymentsReceived: any[]; paymentsMade: any[]; journalEntries: any[] }): string {
  const { expenses, paymentsReceived, paymentsMade, journalEntries } = data;
  const totalExpenses = expenses.reduce((s, e) => s + (e.total ?? 0), 0);
  const totalVat = expenses.reduce((s, e) => s + (e.vatAmount ?? 0), 0);
  const totalReceived = paymentsReceived.reduce((s, p) => s + (p.amount ?? 0), 0);
  const totalPaid = paymentsMade.reduce((s, p) => s + (p.amount ?? 0), 0);
  const netCashFlow = totalReceived - totalPaid;

  const lower = prompt.toLowerCase();

  if (lower.includes("categor")) {
    const cats: Record<string, number> = expenses.reduce((m: Record<string, number>, e) => { m[e.category] = (m[e.category] ?? 0) + (e.total ?? 0); return m; }, {});
    const sorted: [string, number][] = Object.entries(cats).sort((a, b) => b[1] - a[1]);
    return `**Expense Categorization Analysis**\n\nBased on your ${expenses.length} recorded expenses (Total: AED ${totalExpenses.toFixed(2)}):\n\n${sorted.map(([cat, amt]) => `• **${cat}**: AED ${amt.toFixed(2)} (${((amt / totalExpenses) * 100).toFixed(1)}%)`).join("\n")}\n\n**Recommendations:**\n• Consider creating sub-categories under "other" for better tracking\n• Labour and material expenses could be project-coded for better profitability analysis\n• Transport and fuel should be separated if possible — useful for fleet cost reporting`;
  }

  if (lower.includes("cash flow") || lower.includes("risk")) {
    const risk = netCashFlow < 0 ? "⚠️ HIGH RISK" : netCashFlow < 5000 ? "⚠️ MODERATE RISK" : "✅ HEALTHY";
    return `**Cash Flow Analysis — ${risk}**\n\n• Total Received: AED ${totalReceived.toFixed(2)}\n• Total Paid Out: AED ${totalPaid.toFixed(2)}\n• Net Cash Flow: AED ${netCashFlow.toFixed(2)} ${netCashFlow >= 0 ? "(Positive)" : "(Negative — action needed)"}\n\n${netCashFlow < 0 ? "**⚠️ Warning:** Your outgoing payments exceed incoming receipts. Immediate actions:\n1. Follow up on outstanding receivables\n2. Defer non-critical payments\n3. Review credit terms with suppliers\n4. Consider short-term financing if needed" : "**✅ Position is healthy.** Continue monitoring weekly. Consider:\n1. Investing surplus in short-term deposits\n2. Paying down high-interest liabilities\n3. Building 3-month cash reserve"}`;
  }

  if (lower.includes("profit") || lower.includes("loss") || lower.includes("financial")) {
    return `**Financial Position Summary**\n\n📊 **Revenue & Receipts**\n• Total Payments Received: AED ${totalReceived.toFixed(2)}\n\n💸 **Costs & Payments**\n• Total Expenses (incl. VAT): AED ${totalExpenses.toFixed(2)}\n• Total Payments Made: AED ${totalPaid.toFixed(2)}\n\n🧾 **VAT Position**\n• Input VAT (Paid): AED ${totalVat.toFixed(2)}\n• Estimated Output VAT (5%): AED ${(totalReceived * 0.05).toFixed(2)}\n• Net VAT: AED ${((totalReceived * 0.05) - totalVat).toFixed(2)}\n\n📈 **Net Position**\n• Estimated Net: AED ${(totalReceived - totalExpenses).toFixed(2)}\n\n*Note: This is an estimate based on recorded transactions. Consult your accountant for official P&L.`;
  }

  if (lower.includes("reminder") || lower.includes("overdue") || lower.includes("receivable")) {
    return `**Payment Reminder Templates**\n\nHere are professional payment reminder messages you can use:\n\n**First Reminder (7 days overdue):**\n"Dear [Client Name], this is a friendly reminder that Invoice [#] for AED [Amount] was due on [Date]. Please process the payment at your earliest convenience. For any queries, contact us at [contact]. Thank you."\n\n**Second Reminder (14 days overdue):**\n"Dear [Client Name], we note that Invoice [#] (AED [Amount]) remains outstanding. Please arrange immediate payment to avoid service disruption. Bank details: [IBAN]. Ref: [Invoice No.]"\n\n**Final Notice (30+ days overdue):**\n"URGENT: Invoice [#] for AED [Amount] is significantly overdue. Failure to settle by [Date+7] may result in legal action and credit hold. Please contact us immediately at [phone]."`;
  }

  if (lower.includes("duplicate")) {
    const amounts: Record<number, number> = {};
    payments: for (const p of paymentsReceived) {
      amounts[p.amount] = (amounts[p.amount] ?? 0) + 1;
    }
    const dups = Object.entries(amounts).filter(([, c]) => c > 1);
    return `**Duplicate Payment Check**\n\n${dups.length === 0 ? "✅ No obvious duplicate payment amounts detected in payments received." : `⚠️ Possible duplicates found — same amounts received multiple times:\n${dups.map(([amt, cnt]) => `• AED ${amt} appeared ${cnt} times`).join("\n")}\n\nRecommendation: Cross-reference these with invoice numbers to confirm.`}\n\n**Also check:**\n• Same payee + same amount within 7 days\n• Same invoice reference used twice\n• Matching bank reference numbers`;
  }

  if (lower.includes("vat") || lower.includes("tax")) {
    const missingVat = expenses.filter(e => (e.vatAmount ?? 0) === 0 && (e.amount ?? 0) > 0);
    return `**VAT Compliance Check**\n\n• Total Input VAT Recorded: AED ${totalVat.toFixed(2)}\n• Expenses without VAT recorded: ${missingVat.length}\n${missingVat.length > 0 ? `\n⚠️ ${missingVat.length} expense(s) have no VAT recorded — review these:\n${missingVat.slice(0, 5).map(e => `  • ${e.expenseNumber}: ${e.category} — AED ${(e.amount ?? 0).toFixed(2)}`).join("\n")}${missingVat.length > 5 ? "\n  ... and more" : ""}` : "\n✅ All expenses have VAT recorded."}\n\n**UAE VAT Reminders:**\n• VAT return is filed quarterly with FTA\n• Keep all tax invoices for 5 years\n• Ensure supplier TRN is on all purchase invoices\n• Self-supply rules apply for construction goods`;
  }

  if (lower.includes("journal")) {
    const lastExpense = expenses[0];
    if (lastExpense) {
      return `**Suggested Journal Entry for Latest Expense**\n\nExpense: ${lastExpense.expenseNumber} — ${lastExpense.category}\n\n| Account | Debit (AED) | Credit (AED) |\n|---------|-------------|---------------|\n| ${lastExpense.category} Expense | ${(lastExpense.amount ?? 0).toFixed(2)} | — |\n| VAT Input Account | ${(lastExpense.vatAmount ?? 0).toFixed(2)} | — |\n| Bank / Cash | — | ${(lastExpense.total ?? 0).toFixed(2)} |\n\n**Total: AED ${(lastExpense.total ?? 0).toFixed(2)} (balanced)**\n\nReference: ${lastExpense.expenseNumber}\nDate: ${lastExpense.paymentDate ?? "today"}`;
    }
    return `**Journal Entry Suggestion**\n\nNo recent expenses found. A typical journal entry structure:\n\n| Account | Debit | Credit |\n|---------|-------|--------|\n| Expense Account | Amount | — |\n| VAT Input | VAT Amt | — |\n| Bank Account | — | Total |`;
  }

  if (lower.includes("expense") || lower.includes("summar") || lower.includes("trend")) {
    const cats: Record<string, number> = expenses.reduce((m: Record<string, number>, e) => { m[e.category] = (m[e.category] ?? 0) + (e.total ?? 0); return m; }, {});
    const top: [string, number][] = Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return `**Expense Summary & Trend Analysis**\n\n📊 **Overview**\n• Total Transactions: ${expenses.length}\n• Total Amount: AED ${totalExpenses.toFixed(2)}\n• Total VAT: AED ${totalVat.toFixed(2)}\n\n🏆 **Top 5 Spending Categories:**\n${top.map(([cat, amt], i) => `${i + 1}. **${cat}**: AED ${amt.toFixed(2)} (${((amt / totalExpenses) * 100).toFixed(1)}%)`).join("\n")}\n\n💡 **AI Insights:**\n• Consider negotiating better payment terms with top vendors\n• Material and labour costs should be tracked per project\n• Monthly budgets per category would help control spending`;
  }

  return `**AI Accounting Assistant**\n\nI analyzed your financial data:\n• ${expenses.length} expenses totaling AED ${totalExpenses.toFixed(2)}\n• ${paymentsReceived.length} payments received totaling AED ${totalReceived.toFixed(2)}\n• ${paymentsMade.length} payments made totaling AED ${totalPaid.toFixed(2)}\n• ${journalEntries.length} journal entries\n\nYou asked: "${prompt}"\n\nPlease try one of the quick action buttons, or ask me about:\n• Expense categorization\n• Cash flow analysis\n• VAT compliance\n• Payment reminders\n• Journal entry suggestions\n• Duplicate detection`;
}

export function AiAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hello! I'm your AI accounting assistant. I can help you analyze expenses, check VAT compliance, detect duplicate payments, suggest journal entries, and more. What would you like to know?", ts: Date.now() },
  ]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);

  const { data: expenses = [] } = useListExpenses();
  const { data: paymentsReceived = [] } = useListPaymentsReceived();
  const { data: paymentsMade = [] } = useListPaymentsMade();
  const { data: journalEntries = [] } = useListJournalEntries();
  const { filterByCompany } = useActiveCompany();

  const data = {
    expenses: filterByCompany(expenses),
    paymentsReceived: filterByCompany(paymentsReceived),
    paymentsMade: filterByCompany(paymentsMade),
    journalEntries: filterByCompany(journalEntries),
  };

  const callAccountsAI = async (path: string, body: Record<string, unknown>): Promise<string | null> => {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) return null;
      const j = await res.json();
      return typeof j?.result === "string" ? j.result : null;
    } catch { return null; }
  };

  const sendMessage = async (prompt: string) => {
    if (!prompt.trim()) return;
    const userMsg: Message = { role: "user", content: prompt, ts: Date.now() };
    setMessages(p => [...p, userMsg]);
    setInput("");
    setIsThinking(true);

    const lower = prompt.toLowerCase();
    let aiText: string | null = null;
    if (lower.includes("categor")) {
      aiText = await callAccountsAI("/ai/accounts/categorize-expenses", { expenses: data.expenses.slice(0, 30) });
    } else if (lower.includes("vat") || lower.includes("tax")) {
      const totalVat = data.expenses.reduce((s, e: any) => s + (e.vatAmount ?? 0), 0);
      const totalReceived = data.paymentsReceived.reduce((s, p: any) => s + (p.amount ?? 0), 0);
      aiText = await callAccountsAI("/ai/accounts/vat-check", {
        summary: { inputVat: totalVat, estimatedOutputVat: totalReceived * 0.05, expenseCount: data.expenses.length },
      });
    } else if (lower.includes("journal")) {
      const last = data.expenses[0];
      aiText = await callAccountsAI("/ai/accounts/suggest-journal", { docType: "expense", doc: last ?? {} });
    } else if (lower.includes("invoice") && (lower.includes("validate") || lower.includes("check"))) {
      aiText = await callAccountsAI("/ai/accounts/validate-invoice", { invoice: {} });
    }

    const response = aiText ?? generateResponse(prompt, data);
    setMessages(p => [...p, { role: "assistant", content: response, ts: Date.now() }]);
    setIsThinking(false);
  };

  const formatContent = (text: string) => {
    return text.split("\n").map((line, i) => {
      if (line.startsWith("**") && line.endsWith("**")) {
        return <p key={i} className="font-bold text-[#0f2d5a] mt-2 first:mt-0">{line.replace(/\*\*/g, "")}</p>;
      }
      if (line.startsWith("• ")) {
        const parts = line.slice(2).split(/\*\*(.*?)\*\*/g);
        return <p key={i} className="flex gap-1.5 text-sm leading-relaxed">
          <span className="text-[#1e6ab0] flex-shrink-0">•</span>
          <span>{parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p)}</span>
        </p>;
      }
      if (line.match(/^\d+\./)) {
        const parts = line.split(/\*\*(.*?)\*\*/g);
        return <p key={i} className="text-sm leading-relaxed pl-2">{parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p)}</p>;
      }
      if (line.startsWith("|")) {
        return null;
      }
      if (!line.trim()) return <div key={i} className="h-1" />;
      const parts = line.split(/\*\*(.*?)\*\*/g);
      return <p key={i} className="text-sm leading-relaxed">{parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p)}</p>;
    });
  };

  return (
    <div className="space-y-4 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bot className="w-6 h-6 text-[#1e6ab0]" />
            AI Accounting Assistant
          </h1>
          <p className="text-muted-foreground">Intelligent financial analysis powered by your real accounting data.</p>
        </div>
        <Badge variant="secondary" className="bg-[#0f2d5a]/10 text-[#0f2d5a] px-3 py-1">
          <Sparkles className="w-3.5 h-3.5 mr-1.5" />AI Powered
        </Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {QUICK_ACTIONS.map(a => (
          <button
            key={a.label}
            className="flex items-center gap-2 px-3 py-2.5 bg-card border border-gray-200 rounded-xl text-sm font-medium hover:bg-[#0f2d5a]/5 hover:border-[#1e6ab0] transition-all text-left"
            onClick={() => sendMessage(a.prompt)}
          >
            <div className="p-1.5 bg-[#0f2d5a]/10 rounded-lg flex-shrink-0">
              <a.icon className="w-3.5 h-3.5 text-[#1e6ab0]" />
            </div>
            <span className="text-xs leading-tight">{a.label}</span>
          </button>
        ))}
      </div>

      <Card className="flex flex-col" style={{ height: "420px" }}>
        <CardHeader className="py-3 px-4 border-b flex flex-row items-center gap-2">
          <Bot className="w-4 h-4 text-[#1e6ab0]" />
          <CardTitle className="text-sm font-medium">Chat</CardTitle>
          <Badge variant="secondary" className="ml-auto text-xs bg-green-100 text-green-700">Live</Badge>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center ${m.role === "assistant" ? "bg-[#0f2d5a] text-white" : "bg-[#1e6ab0] text-white"}`}>
                {m.role === "assistant" ? <Bot className="w-4 h-4" /> : <DollarSign className="w-4 h-4" />}
              </div>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 space-y-0.5 ${m.role === "assistant" ? "bg-white border border-gray-100 shadow-sm rounded-tl-sm" : "bg-[#0f2d5a] text-white rounded-tr-sm"}`}>
                {m.role === "assistant" ? formatContent(m.content) : <p className="text-sm">{m.content}</p>}
              </div>
            </div>
          ))}
          {isThinking && (
            <div className="flex gap-2.5">
              <div className="w-7 h-7 rounded-full bg-[#0f2d5a] text-white flex-shrink-0 flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-white border border-gray-100 shadow-sm rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1">
                {[0, 1, 2].map(d => (
                  <span key={d} className="w-2 h-2 bg-[#1e6ab0] rounded-full animate-bounce" style={{ animationDelay: `${d * 0.15}s` }} />
                ))}
              </div>
            </div>
          )}
        </CardContent>
        <div className="p-4 border-t flex gap-2">
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
            placeholder="Ask about expenses, VAT, cash flow, journal entries..."
            className="resize-none text-sm"
            rows={2}
          />
          <Button
            className="bg-[#0f2d5a] hover:bg-[#1e6ab0] self-end"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isThinking}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: TrendingUp, label: "Total Received", value: `AED ${data.paymentsReceived.reduce((s, p) => s + (p.amount ?? 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, color: "text-green-700" },
          { icon: TrendingDown, label: "Total Paid Out", value: `AED ${data.paymentsMade.reduce((s, p) => s + (p.amount ?? 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, color: "text-red-700" },
          { icon: Lightbulb, label: "Total Expenses", value: `AED ${data.expenses.reduce((s, e) => s + (e.total ?? 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, color: "text-orange-700" },
          { icon: FileText, label: "Journal Entries", value: String(data.journalEntries.length), color: "text-[#0f2d5a]" },
        ].map(k => (
          <div key={k.label} className="bg-card border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <k.icon className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-medium">{k.label}</span>
            </div>
            <div className={`text-lg font-bold ${k.color}`}>{k.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
