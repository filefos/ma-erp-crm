import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useListExpenses, useListTaxInvoices } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandInput, Card, KpiGrid, KpiTile, SectionHeading } from "@/components/ui";
import { FormCell, FormRow } from "@/components/forms";
import { fmtAed, fmtCompact, num } from "@/lib/format";
import { useApp } from "@/contexts/AppContext";

function inRange(date: string | undefined, from: string, to: string): boolean {
  if (!date) return false;
  const d = date.slice(0, 10);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

export default function VatReport() {
  const c = useColors();
  const { activeCompanyId } = useApp();
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + "01";
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);

  const invoices = useListTaxInvoices({ companyId: activeCompanyId ?? undefined });
  const expenses = useListExpenses({ companyId: activeCompanyId ?? undefined });

  const totals = useMemo(() => {
    const inv = (invoices.data ?? []).filter(i => activeCompanyId == null || i.companyId === activeCompanyId);
    const exp = (expenses.data ?? []).filter(e => activeCompanyId == null || e.companyId === activeCompanyId || e.companyId == null);
    const filteredInv = inv.filter(i => inRange(i.invoiceDate ?? i.createdAt, from, to));
    const filteredExp = exp.filter(e => inRange(e.paymentDate ?? e.createdAt, from, to));
    const outputBase = filteredInv.reduce((s, i) => s + num(i.subtotal), 0);
    const outputVat = filteredInv.reduce((s, i) => s + num(i.vatAmount), 0);
    const inputBase = filteredExp.reduce((s, e) => s + num(e.amount), 0);
    const inputVat = filteredExp.reduce((s, e) => s + num(e.vatAmount), 0);
    const netVat = outputVat - inputVat;
    return { outputBase, outputVat, inputBase, inputVat, netVat, invCount: filteredInv.length, expCount: filteredExp.length };
  }, [invoices.data, expenses.data, from, to, activeCompanyId]);

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="VAT report" subtitle="Output, input and net VAT" />
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <FormRow>
            <FormCell><BrandInput label="From (YYYY-MM-DD)" value={from} onChangeText={setFrom} /></FormCell>
            <FormCell><BrandInput label="To (YYYY-MM-DD)" value={to} onChangeText={setTo} /></FormCell>
          </FormRow>
        </Card>

        <SectionHeading title="Summary" />
        <KpiGrid>
          <KpiTile label="Output VAT" value={fmtCompact(totals.outputVat)} icon="arrow-up-right" tone="navy" hint={`${totals.invCount} invoices`} />
          <KpiTile label="Input VAT" value={fmtCompact(totals.inputVat)} icon="arrow-down-left" tone="blue" hint={`${totals.expCount} expenses`} />
          <KpiTile label="Net VAT" value={fmtCompact(totals.netVat)} icon="dollar-sign" tone={totals.netVat >= 0 ? "orange" : "muted"} hint={totals.netVat >= 0 ? "Payable" : "Refund"} />
        </KpiGrid>

        <SectionHeading title="Output (sales)" />
        <Card>
          <View style={styles.row}><Text style={[styles.lbl, { color: c.mutedForeground }]}>Net sales (5%)</Text><Text style={[styles.val, { color: c.foreground }]}>{fmtAed(totals.outputBase)}</Text></View>
          <View style={styles.row}><Text style={[styles.lbl, { color: c.mutedForeground }]}>VAT collected</Text><Text style={[styles.val, { color: c.primary }]}>{fmtAed(totals.outputVat)}</Text></View>
        </Card>

        <SectionHeading title="Input (expenses)" />
        <Card>
          <View style={styles.row}><Text style={[styles.lbl, { color: c.mutedForeground }]}>Net expenses</Text><Text style={[styles.val, { color: c.foreground }]}>{fmtAed(totals.inputBase)}</Text></View>
          <View style={styles.row}><Text style={[styles.lbl, { color: c.mutedForeground }]}>VAT recoverable</Text><Text style={[styles.val, { color: c.primary }]}>{fmtAed(totals.inputVat)}</Text></View>
        </Card>

        <SectionHeading title="Net VAT due" />
        <Card>
          <View style={styles.row}>
            <Text style={[styles.lbl, { color: c.foreground, fontFamily: "Inter_700Bold" }]}>{totals.netVat >= 0 ? "Payable to FTA" : "Refund from FTA"}</Text>
            <Text style={{ color: totals.netVat >= 0 ? c.accent : c.success, fontFamily: "Inter_700Bold", fontSize: 18 }}>{fmtAed(Math.abs(totals.netVat))}</Text>
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 120 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  lbl: { fontFamily: "Inter_500Medium", fontSize: 13 },
  val: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
});
