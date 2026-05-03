import React, { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  type CreateQuotationBody, type CreateQuotationBodyItemsItem, type Quotation,
  getGetQuotationQueryKey, getListQuotationsQueryKey,
  useCreateQuotation, useUpdateQuotation,
} from "@workspace/api-client-react";
import { BrandButton, BrandInput, Card, SectionHeading } from "@/components/ui";
import { DatePickerField, FormCell, FormRow, Select } from "@/components/forms";
import { QUOTATION_STATUSES, fmtAed } from "@/lib/format";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

interface Props { initial?: Quotation | null }

interface DraftItem extends CreateQuotationBodyItemsItem {
  key: string;
}

function newItem(): DraftItem {
  return { key: Math.random().toString(36).slice(2), description: "", quantity: 1, unit: "nos", rate: 0, discount: 0 };
}

export function QuotationForm({ initial }: Props) {
  const c = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { activeCompanyId } = useApp();
  const [form, setForm] = useState<CreateQuotationBody>(() => ({
    companyId: initial?.companyId ?? activeCompanyId ?? 1,
    clientName: initial?.clientName ?? "",
    clientEmail: initial?.clientEmail ?? "",
    clientPhone: initial?.clientPhone ?? "",
    clientContactPerson: initial?.clientContactPerson ?? "",
    customerTrn: initial?.customerTrn ?? "",
    projectName: initial?.projectName ?? "",
    projectLocation: initial?.projectLocation ?? "",
    status: initial?.status ?? "draft",
    discount: initial?.discount ?? 0,
    vatPercent: initial?.vatPercent ?? 5,
    paymentTerms: initial?.paymentTerms ?? "",
    deliveryTerms: initial?.deliveryTerms ?? "",
    validity: initial?.validity ?? "",
    termsConditions: initial?.termsConditions ?? "",
    leadId: initial?.leadId,
    dealId: initial?.dealId,
  }));
  const [items, setItems] = useState<DraftItem[]>(() => {
    const seeded = (initial?.items ?? []).map(it => ({
      key: String(it.id),
      description: it.description, quantity: Number(it.quantity), unit: it.unit,
      rate: Number(it.rate), discount: Number(it.discount ?? 0), sortOrder: it.sortOrder,
    }));
    return seeded.length ? seeded : [newItem()];
  });

  const upd = (p: Partial<CreateQuotationBody>) => setForm(f => ({ ...f, ...p }));
  const updItem = (key: string, p: Partial<DraftItem>) => setItems(prev => prev.map(it => it.key === key ? { ...it, ...p } : it));
  const removeItem = (key: string) => setItems(prev => prev.filter(it => it.key !== key));

  const totals = useMemo(() => {
    const subtotal = items.reduce((s, it) => s + Number(it.quantity || 0) * Number(it.rate || 0) * (1 - Number(it.discount ?? 0) / 100), 0);
    const docDisc = Number(form.discount ?? 0);
    const discounted = subtotal * (1 - docDisc / 100);
    const vat = discounted * Number(form.vatPercent ?? 0) / 100;
    return { subtotal, discounted, vat, grand: discounted + vat };
  }, [items, form.discount, form.vatPercent]);

  const create = useCreateQuotation({
    mutation: {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListQuotationsQueryKey() }); router.back(); },
      onError: (e: unknown) => Alert.alert("Could not save", (e as Error).message ?? ""),
    },
  });
  const update = useUpdateQuotation({
    mutation: {
      onSuccess: (_d, vars) => {
        queryClient.invalidateQueries({ queryKey: getListQuotationsQueryKey() });
        if (vars?.id) queryClient.invalidateQueries({ queryKey: getGetQuotationQueryKey(vars.id) });
        router.back();
      },
      onError: (e: unknown) => Alert.alert("Could not save", (e as Error).message ?? ""),
    },
  });

  const submit = () => {
    if (!form.clientName.trim()) return Alert.alert("Client name is required");
    if (items.length === 0) return Alert.alert("Add at least one line item");
    const payload: CreateQuotationBody = {
      ...form,
      items: items.map(({ key: _key, ...rest }, i) => ({
        ...rest,
        quantity: Number(rest.quantity || 0),
        rate: Number(rest.rate || 0),
        discount: Number(rest.discount ?? 0),
        sortOrder: i,
      })),
    };
    if (initial) update.mutate({ id: initial.id, data: payload });
    else create.mutate({ data: payload });
  };

  const busy = create.isPending || update.isPending;

  return (
    <View style={{ gap: 12 }}>
      <SectionHeading title="Client" />
      <BrandInput label="Client name *" icon="user" value={form.clientName} onChangeText={v => upd({ clientName: v })} />
      <FormRow>
        <FormCell><BrandInput label="Contact person" value={form.clientContactPerson ?? ""} onChangeText={v => upd({ clientContactPerson: v })} /></FormCell>
        <FormCell><BrandInput label="Phone" keyboardType="phone-pad" value={form.clientPhone ?? ""} onChangeText={v => upd({ clientPhone: v })} /></FormCell>
      </FormRow>
      <FormRow>
        <FormCell><BrandInput label="Email" autoCapitalize="none" keyboardType="email-address" value={form.clientEmail ?? ""} onChangeText={v => upd({ clientEmail: v })} /></FormCell>
        <FormCell><BrandInput label="Customer TRN" value={form.customerTrn ?? ""} onChangeText={v => upd({ customerTrn: v })} /></FormCell>
      </FormRow>

      <SectionHeading title="Project" />
      <FormRow>
        <FormCell><BrandInput label="Project name" value={form.projectName ?? ""} onChangeText={v => upd({ projectName: v })} /></FormCell>
        <FormCell><BrandInput label="Location" value={form.projectLocation ?? ""} onChangeText={v => upd({ projectLocation: v })} /></FormCell>
      </FormRow>

      <SectionHeading title={`Items (${items.length})`} action={
        <Pressable onPress={() => setItems(prev => [...prev, newItem()])}><Text style={{ color: c.primary, fontFamily: "Inter_600SemiBold" }}>+ Add</Text></Pressable>
      } />
      {items.map((it, idx) => (
        <Card key={it.key}>
          <View style={styles.row}>
            <Text style={[styles.itemIdx, { color: c.mutedForeground }]}>#{idx + 1}</Text>
            <Pressable onPress={() => removeItem(it.key)} hitSlop={10}>
              <Feather name="x" size={16} color={c.destructive} />
            </Pressable>
          </View>
          <BrandInput label="Description" value={it.description} onChangeText={v => updItem(it.key, { description: v })} />
          <FormRow>
            <FormCell><BrandInput label="Qty" keyboardType="numeric" value={String(it.quantity ?? "")} onChangeText={v => updItem(it.key, { quantity: Number(v) || 0 })} /></FormCell>
            <FormCell><BrandInput label="Unit" value={it.unit} onChangeText={v => updItem(it.key, { unit: v })} /></FormCell>
          </FormRow>
          <FormRow>
            <FormCell><BrandInput label="Rate (AED)" keyboardType="numeric" value={String(it.rate ?? "")} onChangeText={v => updItem(it.key, { rate: Number(v) || 0 })} /></FormCell>
            <FormCell><BrandInput label="Discount %" keyboardType="numeric" value={String(it.discount ?? 0)} onChangeText={v => updItem(it.key, { discount: Number(v) || 0 })} /></FormCell>
          </FormRow>
          <Text style={[styles.lineTotal, { color: c.primary }]}>
            Line: {fmtAed(Number(it.quantity || 0) * Number(it.rate || 0) * (1 - Number(it.discount ?? 0) / 100))}
          </Text>
        </Card>
      ))}

      <SectionHeading title="Pricing & status" />
      <FormRow>
        <FormCell><BrandInput label="Doc discount %" keyboardType="numeric" value={String(form.discount ?? 0)} onChangeText={v => upd({ discount: Number(v) || 0 })} /></FormCell>
        <FormCell><BrandInput label="VAT %" keyboardType="numeric" value={String(form.vatPercent ?? 5)} onChangeText={v => upd({ vatPercent: Number(v) || 0 })} /></FormCell>
      </FormRow>
      <Select label="Status" value={form.status ?? "draft"} options={QUOTATION_STATUSES} onChange={v => upd({ status: v })} />
      <DatePickerField label="Validity" value={form.validity ?? ""} onChange={v => upd({ validity: v || undefined })} />
      <BrandInput label="Payment terms" multiline value={form.paymentTerms ?? ""} onChangeText={v => upd({ paymentTerms: v })} style={{ minHeight: 60, textAlignVertical: "top" }} />
      <BrandInput label="Delivery terms" multiline value={form.deliveryTerms ?? ""} onChangeText={v => upd({ deliveryTerms: v })} style={{ minHeight: 60, textAlignVertical: "top" }} />
      <BrandInput label="Terms & conditions" multiline value={form.termsConditions ?? ""} onChangeText={v => upd({ termsConditions: v })} style={{ minHeight: 80, textAlignVertical: "top" }} />

      <Card style={{ backgroundColor: c.secondary }}>
        <View style={styles.totalRow}><Text style={{ color: c.foreground }}>Subtotal</Text><Text style={[styles.totalText, { color: c.foreground }]}>{fmtAed(totals.subtotal)}</Text></View>
        <View style={styles.totalRow}><Text style={{ color: c.foreground }}>After discount</Text><Text style={[styles.totalText, { color: c.foreground }]}>{fmtAed(totals.discounted)}</Text></View>
        <View style={styles.totalRow}><Text style={{ color: c.foreground }}>VAT ({form.vatPercent ?? 0}%)</Text><Text style={[styles.totalText, { color: c.foreground }]}>{fmtAed(totals.vat)}</Text></View>
        <View style={styles.totalRow}><Text style={[styles.grand, { color: c.navy }]}>Grand total</Text><Text style={[styles.grand, { color: c.navy }]}>{fmtAed(totals.grand)}</Text></View>
      </Card>

      <BrandButton label={initial ? "Save changes" : "Create quotation"} onPress={submit} loading={busy} icon="check" />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  itemIdx: { fontFamily: "Inter_700Bold", fontSize: 13 },
  lineTotal: { fontFamily: "Inter_700Bold", fontSize: 14, textAlign: "right", marginTop: 4 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
  totalText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  grand: { fontFamily: "Inter_700Bold", fontSize: 16 },
});
