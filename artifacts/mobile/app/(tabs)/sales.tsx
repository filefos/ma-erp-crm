import React from "react";
import { useRouter } from "expo-router";
import { useListQuotations, useListProformaInvoices, useListLpos } from "@workspace/api-client-react";
import { DashboardScreen } from "@/components/Dashboard";
import { KpiGrid, KpiTile, QuickLink, SectionHeading } from "@/components/ui";
import { fmtCompact, num } from "@/lib/format";

function count<T>(data: T[] | undefined, predicate?: (t: T) => boolean): number {
  if (!data) return 0;
  return predicate ? data.filter(predicate).length : data.length;
}

export default function SalesHub() {
  const router = useRouter();
  const quotations = useListQuotations();
  const pis = useListProformaInvoices();
  const lpos = useListLpos();

  const qValue = (quotations.data ?? []).reduce((s, q) => s + num(q.grandTotal), 0);
  const lpoValue = (lpos.data ?? []).reduce((s, l) => s + num(l.lpoValue), 0);
  const drafts = count(quotations.data, q => (q.status ?? "").toLowerCase() === "draft");

  return (
    <DashboardScreen title="Sales" subtitle="Quotations, proforma invoices and LPOs">
      <SectionHeading title="This pipeline" />
      <KpiGrid>
        <KpiTile label="Quotations"     value={count(quotations.data)} icon="file-text" tone="navy"   hint={`AED ${fmtCompact(qValue)} total`} />
        <KpiTile label="Drafts"         value={drafts}                 icon="edit-3"    tone="orange" />
        <KpiTile label="Proforma invoices" value={count(pis.data)}     icon="file"      tone="blue" />
        <KpiTile label="Active LPOs"    value={count(lpos.data, l => (l.status ?? "").toLowerCase() === "active")} icon="check-square" tone="muted" hint={`AED ${fmtCompact(lpoValue)} value`} />
      </KpiGrid>

      <SectionHeading title="Workspaces" />
      <QuickLink icon="bar-chart-2" label="Sales dashboard"   hint="Targets + breakdown"            onPress={() => router.push("/sales/dashboard")} />
      <QuickLink icon="file-text"   label="Quotations"        hint={`${count(quotations.data)} total`}  onPress={() => router.push("/sales/quotations")} />
      <QuickLink icon="file"        label="Proforma invoices" hint={`${count(pis.data)} total`}     onPress={() => router.push("/sales/proforma-invoices")} />
      <QuickLink icon="check-square" label="Local Purchase Orders" hint={`${count(lpos.data)} total`} onPress={() => router.push("/sales/lpos")} />
    </DashboardScreen>
  );
}
