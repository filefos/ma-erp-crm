import React, { useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  type CreateRfqBody, type CreateRfqBodyItemsItem, type Rfq,
  getGetRfqQueryKey, getListRfqsQueryKey,
  useCreateRfq, useListPurchaseRequests, useListSuppliers, useUpdateRfq,
} from "@workspace/api-client-react";
import { BrandButton, BrandInput, Card, SectionHeading } from "@/components/ui";
import { FormCell, FormRow, Select, StatusPill } from "@/components/forms";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

interface Props { initial?: Rfq | null; sourcePrId?: number }

interface DraftItem extends CreateRfqBodyItemsItem { key: string }
function newItem(): DraftItem {
  return { key: Math.random().toString(36).slice(2), itemName: "", quantity: 1, unit: "nos", specifications: "" };
}

export function RfqForm({ initial, sourcePrId }: Props) {
  const c = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const { activeCompanyId } = useApp();
  const suppliers = useListSuppliers();
  const prs = useListPurchaseRequests({ status: "approved" });

  const [form, setForm] = useState<CreateRfqBody>(() => ({
    companyId: initial?.companyId ?? activeCompanyId ?? 1,
    purchaseRequestId: initial?.purchaseRequestId ?? sourcePrId,
    requiredDeliveryDate: initial?.requiredDeliveryDate ?? "",
    paymentTerms: initial?.paymentTerms ?? "",
    notes: initial?.notes ?? "",
    supplierIds: initial?.supplierIds ?? [],
  }));
  const [items, setItems] = useState<DraftItem[]>(() => {
    const seeded = (initial?.items ?? []).map((it, i) => ({
      key: `${i}-${Math.random()}`,
      itemName: it.itemName, quantity: Number(it.quantity), unit: it.unit,
      specifications: it.specifications ?? "",
    }));
    return seeded.length ? seeded : [newItem()];
  });
  const [pickerOpen, setPickerOpen] = useState(false);

  // Auto-fill from selected PR (only on first link)
  const linkPr = (prId: number) => {
    setForm(f => ({ ...f, purchaseRequestId: prId }));
    const src = (prs.data ?? []).find(p => p.id === prId);
    if (src && src.items?.length) {
      setItems(src.items.map((it, i) => ({
        key: `${i}-${Math.random()}`,
        itemName: it.itemName, quantity: Number(it.quantity), unit: it.unit, specifications: "",
      })));
    }
  };

  const upd = (p: Partial<CreateRfqBody>) => setForm(f => ({ ...f, ...p }));
  const updItem = (key: string, p: Partial<DraftItem>) => setItems(prev => prev.map(it => it.key === key ? { ...it, ...p } : it));
  const removeItem = (key: string) => setItems(prev => prev.filter(it => it.key !== key));

  const create = useCreateRfq({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListRfqsQueryKey() }); router.back(); },
      onError: (e: unknown) => Alert.alert("Could not save", (e as Error).message ?? ""),
    },
  });
  const update = useUpdateRfq({
    mutation: {
      onSuccess: (_d, vars) => {
        qc.invalidateQueries({ queryKey: getListRfqsQueryKey() });
        if (vars?.id) qc.invalidateQueries({ queryKey: getGetRfqQueryKey(vars.id) });
        router.back();
      },
      onError: (e: unknown) => Alert.alert("Could not save", (e as Error).message ?? ""),
    },
  });

  const submit = () => {
    if ((form.supplierIds ?? []).length === 0) return Alert.alert("Pick at least one supplier");
    if (items.length === 0) return Alert.alert("Add at least one line item");
    const payload: CreateRfqBody = {
      ...form,
      items: items.map(({ key: _key, ...rest }) => ({ ...rest, quantity: Number(rest.quantity || 0) })),
    };
    if (initial) update.mutate({ id: initial.id, data: payload });
    else create.mutate({ data: payload });
  };
  const busy = create.isPending || update.isPending;

  const prOpts = [{ value: "", label: "No source PR" }, ...((prs.data ?? []).map(p => ({ value: String(p.id), label: p.prNumber, hint: p.description ?? "" })))];
  const selectedSet = new Set(form.supplierIds ?? []);
  const supplierData = (suppliers.data ?? []).filter(s => s.status !== "blocked");

  return (
    <View style={{ gap: 12 }}>
      <SectionHeading title="Source" />
      <Select label="From PR" value={form.purchaseRequestId ? String(form.purchaseRequestId) : ""} options={prOpts}
        onChange={v => v ? linkPr(Number(v)) : upd({ purchaseRequestId: undefined })} />
      <FormRow>
        <FormCell><BrandInput label="Required delivery (YYYY-MM-DD)" icon="calendar" value={form.requiredDeliveryDate ?? ""} onChangeText={v => upd({ requiredDeliveryDate: v })} /></FormCell>
        <FormCell><BrandInput label="Payment terms" value={form.paymentTerms ?? ""} onChangeText={v => upd({ paymentTerms: v })} /></FormCell>
      </FormRow>

      <SectionHeading title={`Suppliers (${(form.supplierIds ?? []).length})`} action={
        <Pressable onPress={() => setPickerOpen(true)}><Text style={{ color: c.primary, fontFamily: "Inter_600SemiBold" }}>Pick</Text></Pressable>
      } />
      <View style={[styles.tagRow]}>
        {(form.supplierIds ?? []).map(id => {
          const s = supplierData.find(x => x.id === id);
          return <StatusPill key={id} label={s?.name ?? `#${id}`} tone="navy" />;
        })}
        {(form.supplierIds ?? []).length === 0 ? <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium" }}>No suppliers selected</Text> : null}
      </View>

      <SectionHeading title={`Items (${items.length})`} action={
        <Pressable onPress={() => setItems(p => [...p, newItem()])}><Text style={{ color: c.primary, fontFamily: "Inter_600SemiBold" }}>+ Add</Text></Pressable>
      } />
      {items.map((it, idx) => (
        <Card key={it.key}>
          <View style={styles.row}>
            <Text style={[styles.itemIdx, { color: c.mutedForeground }]}>#{idx + 1}</Text>
            <Pressable onPress={() => removeItem(it.key)} hitSlop={10}><Feather name="x" size={16} color={c.destructive} /></Pressable>
          </View>
          <BrandInput label="Item name" value={it.itemName} onChangeText={v => updItem(it.key, { itemName: v })} />
          <FormRow>
            <FormCell><BrandInput label="Qty" keyboardType="numeric" value={String(it.quantity ?? "")} onChangeText={v => updItem(it.key, { quantity: Number(v) || 0 })} /></FormCell>
            <FormCell><BrandInput label="Unit" value={it.unit} onChangeText={v => updItem(it.key, { unit: v })} /></FormCell>
          </FormRow>
          <BrandInput label="Specifications" multiline value={it.specifications ?? ""} onChangeText={v => updItem(it.key, { specifications: v })} style={{ minHeight: 50, textAlignVertical: "top" }} />
        </Card>
      ))}

      <BrandInput label="Notes" multiline value={form.notes ?? ""} onChangeText={v => upd({ notes: v })} style={{ minHeight: 60, textAlignVertical: "top" }} />

      <BrandButton label={initial ? "Save changes" : "Create RFQ"} icon="check" loading={busy} onPress={submit} />

      <Modal transparent visible={pickerOpen} animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: c.card }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.sheetTitle, { color: c.foreground }]}>Pick suppliers</Text>
            <ScrollView style={{ maxHeight: 420 }}>
              {supplierData.map(s => {
                const active = selectedSet.has(s.id);
                return (
                  <Pressable key={s.id} onPress={() => {
                    const next = new Set(selectedSet);
                    if (active) next.delete(s.id); else next.add(s.id);
                    upd({ supplierIds: Array.from(next) });
                  }} style={({ pressed }) => [
                    styles.sheetItem,
                    { borderColor: c.border, opacity: pressed ? 0.85 : 1, backgroundColor: active ? c.secondary : "transparent" },
                  ]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.sheetItemTitle, { color: c.foreground }]}>{s.name}</Text>
                      {s.contactPerson ? <Text style={[styles.sheetItemSub, { color: c.mutedForeground }]} numberOfLines={1}>{s.contactPerson}</Text> : null}
                    </View>
                    {active ? <Feather name="check" size={16} color={c.primary} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
            <BrandButton label="Done" onPress={() => setPickerOpen(false)} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  itemIdx: { fontFamily: "Inter_700Bold", fontSize: 13 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  sheet: { padding: 16, borderTopLeftRadius: 20, borderTopRightRadius: 20, gap: 8, paddingBottom: 32 },
  sheetTitle: { fontFamily: "Inter_700Bold", fontSize: 16, marginBottom: 6 },
  sheetItem: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, borderWidth: 1 },
  sheetItemTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  sheetItemSub: { fontFamily: "Inter_400Regular", fontSize: 12 },
});
