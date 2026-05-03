import React, { useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  type CreateTaxInvoiceBody,
  getListTaxInvoicesQueryKey,
  useCreateTaxInvoice,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, BrandInput } from "@/components/ui";
import { FormCell, FormRow } from "@/components/forms";
import { useApp } from "@/contexts/AppContext";

export default function NewInvoice() {
  const c = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const { activeCompanyId } = useApp();
  const [form, setForm] = useState<CreateTaxInvoiceBody>({
    companyId: activeCompanyId ?? 1,
    clientName: "",
    clientTrn: "",
    invoiceDate: "",
    supplyDate: "",
    subtotal: 0,
    vatPercent: 5,
    vatAmount: 0,
    grandTotal: 0,
    paymentStatus: "unpaid",
  });
  const upd = (p: Partial<CreateTaxInvoiceBody>) => setForm(f => ({ ...f, ...p }));

  const totals = useMemo(() => {
    const sub = Number(form.subtotal) || 0;
    const pct = Number(form.vatPercent) || 0;
    const vat = Math.round(sub * pct) / 100;
    return { sub, vat, grand: Math.round((sub + vat) * 100) / 100 };
  }, [form.subtotal, form.vatPercent]);

  const create = useCreateTaxInvoice({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListTaxInvoicesQueryKey() }); router.back(); },
      onError: (e: unknown) => Alert.alert("Could not save", (e as Error).message ?? ""),
    },
  });

  const submit = () => {
    if (!form.clientName.trim()) return Alert.alert("Client name is required");
    if (totals.grand <= 0) return Alert.alert("Subtotal must be greater than zero");
    create.mutate({
      data: {
        ...form,
        companyId: activeCompanyId ?? form.companyId,
        subtotal: totals.sub,
        vatAmount: totals.vat,
        grandTotal: totals.grand,
      },
    });
  };

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="New invoice" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <BrandInput label="Client name *" icon="user" value={form.clientName} onChangeText={v => upd({ clientName: v })} />
        <BrandInput label="Client TRN" value={form.clientTrn ?? ""} onChangeText={v => upd({ clientTrn: v })} />
        <FormRow>
          <FormCell><BrandInput label="Invoice date (YYYY-MM-DD)" icon="calendar" value={form.invoiceDate ?? ""} onChangeText={v => upd({ invoiceDate: v })} /></FormCell>
          <FormCell><BrandInput label="Supply date" value={form.supplyDate ?? ""} onChangeText={v => upd({ supplyDate: v })} /></FormCell>
        </FormRow>
        <FormRow>
          <FormCell><BrandInput label="Subtotal (AED) *" keyboardType="numeric" value={String(form.subtotal ?? 0)} onChangeText={v => upd({ subtotal: Number(v) || 0 })} /></FormCell>
          <FormCell><BrandInput label="VAT %" keyboardType="numeric" value={String(form.vatPercent ?? 5)} onChangeText={v => upd({ vatPercent: Number(v) || 0 })} /></FormCell>
        </FormRow>
        <BrandInput label="VAT amount" editable={false} value={String(totals.vat)} />
        <BrandInput label="Grand total" editable={false} value={String(totals.grand)} />
        <BrandButton label="Create invoice" icon="check" loading={create.isPending} onPress={submit} />
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({ flex: { flex: 1 }, content: { padding: 16, gap: 12, paddingBottom: 120 } });
