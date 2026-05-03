import React, { useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  type CreateLpoBody,
  getListLposQueryKey,
  useCreateLpo,
  useListQuotations,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, BrandInput } from "@/components/ui";
import { FormCell, FormRow, Select } from "@/components/forms";
import { LPO_STATUSES } from "@/lib/format";
import { useApp } from "@/contexts/AppContext";

const PAYMENT_PRESETS: { value: string; label: string }[] = [
  { value: "30 days credit", label: "30 days credit" },
  { value: "50% advance, 50% on delivery", label: "50% advance, 50% on delivery" },
  { value: "100% advance", label: "100% advance" },
  { value: "Net 60", label: "Net 60" },
];

export default function NewLpo() {
  const c = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const { activeCompanyId } = useApp();
  const quotes = useListQuotations({ status: "approved" });
  const [form, setForm] = useState<CreateLpoBody>({
    companyId: activeCompanyId ?? 1,
    clientName: "",
    projectRef: "",
    quotationId: undefined,
    lpoDate: "",
    lpoValue: 0,
    scope: "",
    deliverySchedule: "",
    paymentTerms: "",
    status: "active",
    notes: "",
  });
  const upd = (p: Partial<CreateLpoBody>) => setForm(f => ({ ...f, ...p }));

  const create = useCreateLpo({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListLposQueryKey() }); router.back(); },
      onError: (e: unknown) => Alert.alert("Could not save", (e as Error).message ?? ""),
    },
  });

  const submit = () => {
    if (!form.clientName.trim()) return Alert.alert("Client name is required");
    if (!Number.isFinite(Number(form.lpoValue)) || Number(form.lpoValue) <= 0) return Alert.alert("LPO value must be greater than zero");
    create.mutate({ data: { ...form, lpoValue: Number(form.lpoValue) } });
  };

  const quoteOpts = [{ value: "", label: "No source quotation" }, ...((quotes.data ?? []).map(q => ({ value: String(q.id), label: q.quotationNumber, hint: q.clientName })))];

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="New LPO" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Select label="Source quotation" value={form.quotationId ? String(form.quotationId) : ""} options={quoteOpts}
          onChange={v => {
            const id = v ? Number(v) : undefined;
            const src = (quotes.data ?? []).find(q => q.id === id);
            if (src) upd({ quotationId: id, clientName: src.clientName, lpoValue: Number(src.grandTotal ?? 0), paymentTerms: src.paymentTerms ?? "" });
            else upd({ quotationId: id });
          }} />
        <BrandInput label="Client name *" icon="user" value={form.clientName} onChangeText={v => upd({ clientName: v })} />
        <FormRow>
          <FormCell><BrandInput label="Project ref" value={form.projectRef ?? ""} onChangeText={v => upd({ projectRef: v })} /></FormCell>
          <FormCell><BrandInput label="LPO date (YYYY-MM-DD)" icon="calendar" value={form.lpoDate ?? ""} onChangeText={v => upd({ lpoDate: v })} /></FormCell>
        </FormRow>
        <BrandInput label="LPO value (AED) *" keyboardType="numeric" value={String(form.lpoValue ?? 0)} onChangeText={v => upd({ lpoValue: Number(v) || 0 })} />
        <Select label="Status" value={form.status ?? "active"} options={LPO_STATUSES} onChange={v => upd({ status: v })} />
        <Select label="Payment terms preset" value={form.paymentTerms ?? ""} options={[{ value: "", label: "Custom (free text below)" }, ...PAYMENT_PRESETS]} onChange={v => upd({ paymentTerms: v })} />
        <BrandInput label="Payment terms (free text)" multiline value={form.paymentTerms ?? ""} onChangeText={v => upd({ paymentTerms: v })} style={{ minHeight: 60, textAlignVertical: "top" }} />
        <BrandInput label="Scope" multiline value={form.scope ?? ""} onChangeText={v => upd({ scope: v })} style={{ minHeight: 80, textAlignVertical: "top" }} />
        <BrandInput label="Delivery schedule" multiline value={form.deliverySchedule ?? ""} onChangeText={v => upd({ deliverySchedule: v })} style={{ minHeight: 60, textAlignVertical: "top" }} />
        <BrandInput label="Notes" multiline value={form.notes ?? ""} onChangeText={v => upd({ notes: v })} style={{ minHeight: 60, textAlignVertical: "top" }} />
        <BrandButton label="Create LPO" icon="check" loading={create.isPending} onPress={submit} />
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({ flex: { flex: 1 }, content: { padding: 16, gap: 12, paddingBottom: 120 } });
