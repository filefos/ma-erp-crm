import React, { useMemo } from "react";
import { useRouter } from "expo-router";
import {
  useListBankAccounts,
  useListCheques,
  useListExpenses,
  useListJournalEntries,
  useListPaymentsMade,
  useListPaymentsReceived,
  useListTaxInvoices,
} from "@workspace/api-client-react";
import { DashboardScreen } from "@/components/Dashboard";
import { KpiGrid, KpiTile, QuickLink, SectionHeading } from "@/components/ui";
import { fmtCompact, num } from "@/lib/format";
import { useApp } from "@/contexts/AppContext";

export default function AccountsHub() {
  const router = useRouter();
  const { activeCompanyId } = useApp();
  const cid = activeCompanyId ?? undefined;

  const invoices = useListTaxInvoices({ companyId: cid });
  const expenses = useListExpenses({ companyId: cid });
  const cheques = useListCheques({ companyId: cid });
  const banks = useListBankAccounts({ companyId: cid });
  const recv = useListPaymentsReceived({ companyId: cid });
  const made = useListPaymentsMade({ companyId: cid });
  const journals = useListJournalEntries({ companyId: cid });

  const totals = useMemo(() => {
    const inv = invoices.data ?? [];
    const totalInv = inv.reduce((s, i) => s + num(i.grandTotal), 0);
    const totalPaid = inv.reduce((s, i) => s + num(i.amountPaid), 0);
    const outstanding = totalInv - totalPaid;
    const exp = (expenses.data ?? []).reduce((s, e) => s + num(e.total), 0);
    const pendingChq = (cheques.data ?? []).filter(c => ["draft", "approved", "printed"].includes((c.status ?? "").toLowerCase())).length;
    const pendingJe = (journals.data ?? []).filter(j => (j.status ?? "").toLowerCase() === "draft").length;
    return { totalInv, totalPaid, outstanding, exp, pendingChq, pendingJe };
  }, [invoices.data, expenses.data, cheques.data, journals.data]);

  return (
    <DashboardScreen title="Accounts" subtitle="Invoicing, payments, ledger and VAT">
      <SectionHeading title="KPIs" />
      <KpiGrid>
        <KpiTile label="Invoiced" value={fmtCompact(totals.totalInv)} icon="file-text" tone="navy" hint="AED" />
        <KpiTile label="Collected" value={fmtCompact(totals.totalPaid)} icon="check" tone="blue" hint="AED" />
        <KpiTile label="Outstanding" value={fmtCompact(totals.outstanding)} icon="alert-circle" tone="orange" hint="AED" />
        <KpiTile label="Expenses" value={fmtCompact(totals.exp)} icon="trending-down" tone="muted" hint="AED" />
        <KpiTile label="Pending cheques" value={totals.pendingChq} icon="credit-card" tone="orange" />
        <KpiTile label="Draft journals" value={totals.pendingJe} icon="book" tone="muted" />
        <KpiTile label="Bank accounts" value={(banks.data ?? []).length} icon="briefcase" tone="navy" />
        <KpiTile label="Payments in/out" value={`${(recv.data ?? []).length}/${(made.data ?? []).length}`} icon="repeat" tone="blue" />
      </KpiGrid>

      <SectionHeading title="Receivables" />
      <QuickLink icon="file-text" label="Tax invoices" hint="Issue, track and record payments" onPress={() => router.push("/accounts/invoices")} />
      <QuickLink icon="download" label="Payments received" hint="From customers" onPress={() => router.push("/accounts/payments-received")} />

      <SectionHeading title="Payables" />
      <QuickLink icon="trending-down" label="Expenses" hint="Bills with receipt photo" onPress={() => router.push("/accounts/expenses")} />
      <QuickLink icon="upload" label="Payments made" hint="To suppliers" onPress={() => router.push("/accounts/payments-made")} />
      <QuickLink icon="credit-card" label="Cheques" hint="Issue and track cheques" onPress={() => router.push("/accounts/cheques")} />

      <SectionHeading title="Banking & ledger" />
      <QuickLink icon="briefcase" label="Bank accounts" onPress={() => router.push("/accounts/bank-accounts")} />
      <QuickLink icon="list" label="Chart of accounts" onPress={() => router.push("/accounts/chart-of-accounts")} />
      <QuickLink icon="book" label="Journal entries" hint="Double-entry, balanced" onPress={() => router.push("/accounts/journal-entries")} />

      <SectionHeading title="Reports & tools" />
      <QuickLink icon="bar-chart-2" label="VAT report" hint="Output, input and net VAT" onPress={() => router.push("/accounts/vat-report")} />
      <QuickLink icon="message-circle" label="AI assistant" hint="Ask about your accounts" onPress={() => router.push("/accounts/ai-assistant")} />
    </DashboardScreen>
  );
}
