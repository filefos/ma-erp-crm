import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import {
  useListBankAccounts, useListCheques, useListExpenses,
  useListJournalEntries, useListPaymentsMade, useListPaymentsReceived,
  useListTaxInvoices,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, BrandInput, Card, SectionHeading } from "@/components/ui";
import { fmtAed, num } from "@/lib/format";
import { useApp } from "@/contexts/AppContext";

interface Msg { role: "user" | "assistant"; text: string }

const SUGGESTIONS = [
  "What is my outstanding balance?",
  "Show pending cheques",
  "Top expenses by category",
  "Net VAT this month",
  "Recent payments received",
];

export default function AiAssistant() {
  const c = useColors();
  const { activeCompanyId } = useApp();
  const cid = activeCompanyId ?? undefined;
  const invoices = useListTaxInvoices({ companyId: cid });
  const expenses = useListExpenses({ companyId: cid });
  const cheques = useListCheques({ companyId: cid });
  const banks = useListBankAccounts({ companyId: cid });
  const recv = useListPaymentsReceived({ companyId: cid });
  const made = useListPaymentsMade({ companyId: cid });
  const journals = useListJournalEntries({ companyId: cid });

  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", text: "Hi! I can answer questions about your accounts. Try one of the suggestions below or type your own." },
  ]);
  const [input, setInput] = useState("");

  const generateResponse = useMemo(() => (q: string): string => {
    const s = q.toLowerCase();
    const inv = invoices.data ?? [];
    const exp = expenses.data ?? [];
    const chq = cheques.data ?? [];

    if (s.includes("outstanding") || s.includes("balance") || s.includes("receivable")) {
      const total = inv.reduce((sum, i) => sum + num(i.grandTotal), 0);
      const paid = inv.reduce((sum, i) => sum + num(i.amountPaid), 0);
      const out = total - paid;
      return `Outstanding receivables: ${fmtAed(out)}. Total invoiced ${fmtAed(total)}, collected ${fmtAed(paid)} across ${inv.length} invoices.`;
    }
    if (s.includes("cheque") || s.includes("check")) {
      const pending = chq.filter(x => ["draft", "approved", "printed"].includes((x.status ?? "").toLowerCase()));
      const sum = pending.reduce((t, x) => t + num(x.amount), 0);
      const lines = pending.slice(0, 5).map(x => `• #${x.chequeNumber} to ${x.payeeName} — ${fmtAed(x.amount)} (${x.status})`).join("\n");
      return `${pending.length} pending cheque(s) totalling ${fmtAed(sum)}.\n${lines}`;
    }
    if (s.includes("expense") || s.includes("category")) {
      const buckets = new Map<string, number>();
      for (const e of exp) buckets.set(e.category, (buckets.get(e.category) ?? 0) + num(e.total));
      const sorted = [...buckets.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
      return `Top expense categories:\n${sorted.map(([k, v]) => `• ${k}: ${fmtAed(v)}`).join("\n")}\nTotal expenses: ${fmtAed(exp.reduce((t, e) => t + num(e.total), 0))}.`;
    }
    if (s.includes("vat")) {
      const today = new Date().toISOString().slice(0, 10);
      const monthStart = today.slice(0, 8) + "01";
      const monthInv = inv.filter(i => (i.invoiceDate ?? "").slice(0, 10) >= monthStart);
      const monthExp = exp.filter(e => (e.paymentDate ?? e.createdAt ?? "").slice(0, 10) >= monthStart);
      const out = monthInv.reduce((t, i) => t + num(i.vatAmount), 0);
      const inp = monthExp.reduce((t, e) => t + num(e.vatAmount), 0);
      return `This month — Output VAT ${fmtAed(out)}, Input VAT ${fmtAed(inp)}, Net VAT ${fmtAed(out - inp)} ${out - inp >= 0 ? "(payable)" : "(refund)"}.`;
    }
    if (s.includes("payment") && (s.includes("receive") || s.includes("received") || s.includes("collected"))) {
      const r = recv.data ?? [];
      const total = r.reduce((t, p) => t + num(p.amount), 0);
      const recent = r.slice(0, 5).map(p => `• ${p.paymentNumber} from ${p.customerName} — ${fmtAed(p.amount)}`).join("\n");
      return `${r.length} payment(s) received totalling ${fmtAed(total)}.\n${recent}`;
    }
    if (s.includes("payment") && (s.includes("made") || s.includes("paid") || s.includes("supplier"))) {
      const m = made.data ?? [];
      const total = m.reduce((t, p) => t + num(p.amount), 0);
      return `${m.length} payment(s) made totalling ${fmtAed(total)}.`;
    }
    if (s.includes("bank")) {
      const b = banks.data ?? [];
      return `${b.length} bank account(s):\n${b.map(x => `• ${x.bankName} — ${x.accountNumber}`).join("\n")}`;
    }
    if (s.includes("journal") || s.includes("ledger")) {
      const j = journals.data ?? [];
      const draft = j.filter(x => (x.status ?? "").toLowerCase() === "draft").length;
      return `${j.length} journal entr${j.length === 1 ? "y" : "ies"} on file (${draft} draft).`;
    }
    return "I can help with: outstanding balance, pending cheques, top expenses, VAT, payments, bank accounts, and journals. Try one of the suggestions below.";
  }, [invoices.data, expenses.data, cheques.data, banks.data, recv.data, made.data, journals.data]);

  const ask = (q: string) => {
    if (!q.trim()) return;
    const reply = generateResponse(q);
    setMessages(m => [...m, { role: "user", text: q }, { role: "assistant", text: reply }]);
    setInput("");
  };

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="AI assistant" subtitle="Ask about your accounts" />
      <ScrollView contentContainerStyle={styles.content}>
        {messages.map((m, i) => (
          <Card key={i} style={{ backgroundColor: m.role === "user" ? c.secondary : c.card }}>
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>{m.role === "user" ? "You" : "Assistant"}</Text>
            <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 14 }}>{m.text}</Text>
          </Card>
        ))}

        <SectionHeading title="Suggestions" />
        {SUGGESTIONS.map(s => (
          <BrandButton key={s} label={s} variant="secondary" icon="message-circle" onPress={() => ask(s)} />
        ))}

        <BrandInput label="Your question" value={input} onChangeText={setInput} placeholder="Type your question…" multiline style={{ minHeight: 60, textAlignVertical: "top" }} />
        <BrandButton label="Ask" icon="send" onPress={() => ask(input)} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 120 },
});
