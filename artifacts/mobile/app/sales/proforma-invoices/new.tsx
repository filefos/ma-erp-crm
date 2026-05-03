import React, { useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  type CreateProformaInvoiceBody,
  getListProformaInvoicesQueryKey,
  useCreateProformaInvoice,
  useListQuotations,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, BrandInput, Card } from "@/components/ui";
import { FormCell, FormRow, Select } from "@/components/forms";
import { PI_STATUSES, fmtAed } from "@/lib/format";
import { useApp } from "@/contexts/AppContext";

export default function NewPi() {
  const c = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const { activeCompanyId } = useApp();
  const quotes = useListQuotations({ status: "approved" });
  const [form, setForm] = useState<CreateProformaInvoiceBody>({
    companyId: activeCompanyId ?? 1,
    clientName: "",
    projectName: "",
    quotationId: undefined,
    subtotal: 0,
    vatAmount: 0,
    total: 0,
    paymentTerms: "",
    validityDate: "",
    status: "draft",
  });
  const upd = (p: Partial<CreateProformaInvoiceBody>) => setForm(f => ({ ...f, ...p }));

  const totals = useMemo(() => {
    const sub = Number(form.subtotal ?? 0);
    const vat = Number(form.vatAmount ?? 0);
    return { sub, vat, total: sub + vat };
  }, [form.subtotal, form.vatAmount]);

  const create = useCreateProformaInvoice({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListProformaInvoicesQueryKey() }); router.back(); },
      onError: (e: unknown) => Alert.alert("Could not save", (e as Error).message ?? ""),
    },
  });

  const submit = () => {
    if (!form.clientName.trim()) return Alert.alert("Client name is required");
    create.mutate({ data: { ...form, total: totals.total } });
  };

  const quoteOpts = [{ value: "", label: "No source quotation" }, ...((quotes.data ?? []).map(q => ({ value: String(q.id), label: q.quotationNumber, hint: q.clientName })))];

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="New proforma invoice" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Select
          label="Source quotation" value={form.quotationId ? String(form.quotationId) : ""}
          options={quoteOpts}
          onChange={v => {
            const id = v ? Number(v) : undefined;
            const src = (quotes.data ?? []).find(q => q.id === id);
            if (src) {
              upd({
                quotationId: id, clientName: src.clientName, projectName: src.projectName,
                subtotal: Number(src.subtotal ?? 0), vatAmount: Number(src.vatAmount ?? 0),
                total: Number(src.grandTotal ?? 0),
                paymentTerms: src.paymentTerms ?? "",
              });
            } else {
              upd({ quotationId: id });
            }
          }}
        />
        <BrandInput label="Client name *" icon="user" value={form.clientName} onChangeText={v => upd({ clientName: v })} />
        <BrandInput label="Project name" value={form.projectName ?? ""} onChangeText={v => upd({ projectName: v })} />
        <FormRow>
          <FormCell><BrandInput label="Subtotal (AED)" keyboardType="numeric" value={String(form.subtotal ?? 0)} onChangeText={v => upd({ subtotal: Number(v) || 0 })} /></FormCell>
          <FormCell><BrandInput label="VAT (AED)" keyboardType="numeric" value={String(form.vatAmount ?? 0)} onChangeText={v => upd({ vatAmount: Number(v) || 0 })} /></FormCell>
        </FormRow>
        <Select label="Status" value={form.status ?? "draft"} options={PI_STATUSES} onChange={v => upd({ status: v })} />
        <BrandInput label="Validity (YYYY-MM-DD)" icon="calendar" value={form.validityDate ?? ""} onChangeText={v => upd({ validityDate: v })} />
        <BrandInput label="Payment terms" multiline value={form.paymentTerms ?? ""} onChangeText={v => upd({ paymentTerms: v })} style={{ minHeight: 80, textAlignVertical: "top" }} />

        <Card style={{ backgroundColor: c.secondary }}>
          <View style={styles.totalRow}><Text>Subtotal</Text><Text style={styles.bold}>{fmtAed(totals.sub)}</Text></View>
          <View style={styles.totalRow}><Text>VAT</Text><Text style={styles.bold}>{fmtAed(totals.vat)}</Text></View>
          <View style={styles.totalRow}><Text style={styles.bold}>Total</Text><Text style={styles.bold}>{fmtAed(totals.total)}</Text></View>
        </Card>

        <BrandButton label="Create proforma" icon="check" loading={create.isPending} onPress={submit} />
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 120 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
  bold: { fontFamily: "Inter_700Bold" },
});
