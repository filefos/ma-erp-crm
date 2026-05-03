import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  type CreatePurchaseRequestBody, type CreatePurchaseRequestBodyItemsItem, type PurchaseRequest,
  getGetPurchaseRequestQueryKey, getListPurchaseRequestsQueryKey,
  useCreatePurchaseRequest, useUpdatePurchaseRequest,
} from "@workspace/api-client-react";
import { BrandButton, BrandInput, Card, SectionHeading } from "@/components/ui";
import { FormCell, FormRow, Select } from "@/components/forms";
import { PR_PRIORITIES } from "@/lib/format";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

interface Props { initial?: PurchaseRequest | null }

interface DraftItem extends CreatePurchaseRequestBodyItemsItem { key: string }
function newItem(): DraftItem {
  return { key: Math.random().toString(36).slice(2), itemName: "", quantity: 1, unit: "nos", estimatedCost: 0 };
}

export function PrForm({ initial }: Props) {
  const c = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const { activeCompanyId } = useApp();
  const [form, setForm] = useState<CreatePurchaseRequestBody>(() => ({
    companyId: initial?.companyId ?? activeCompanyId ?? 1,
    projectId: initial?.projectId,
    projectRef: initial?.projectRef ?? "",
    department: initial?.department ?? "",
    description: initial?.description ?? "",
    priority: initial?.priority ?? "normal",
    requiredDate: initial?.requiredDate ?? "",
  }));
  const [items, setItems] = useState<DraftItem[]>(() => {
    const seeded = (initial?.items ?? []).map((it, i) => ({
      key: `${i}-${Math.random()}`,
      itemName: it.itemName, quantity: Number(it.quantity), unit: it.unit,
      estimatedCost: Number(it.estimatedCost ?? 0),
    }));
    return seeded.length ? seeded : [newItem()];
  });

  const upd = (p: Partial<CreatePurchaseRequestBody>) => setForm(f => ({ ...f, ...p }));
  const updItem = (key: string, p: Partial<DraftItem>) => setItems(prev => prev.map(it => it.key === key ? { ...it, ...p } : it));
  const removeItem = (key: string) => setItems(prev => prev.filter(it => it.key !== key));

  const create = useCreatePurchaseRequest({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListPurchaseRequestsQueryKey() }); router.back(); },
      onError: (e: unknown) => Alert.alert("Could not save", (e as Error).message ?? ""),
    },
  });
  const update = useUpdatePurchaseRequest({
    mutation: {
      onSuccess: (_d, vars) => {
        qc.invalidateQueries({ queryKey: getListPurchaseRequestsQueryKey() });
        if (vars?.id) qc.invalidateQueries({ queryKey: getGetPurchaseRequestQueryKey(vars.id) });
        router.back();
      },
      onError: (e: unknown) => Alert.alert("Could not save", (e as Error).message ?? ""),
    },
  });

  const submit = () => {
    if (!form.description.trim()) return Alert.alert("Description is required");
    if (items.length === 0) return Alert.alert("Add at least one line item");
    const payload: CreatePurchaseRequestBody = {
      ...form,
      items: items.map(({ key: _key, ...rest }) => ({
        ...rest,
        quantity: Number(rest.quantity || 0),
        estimatedCost: Number(rest.estimatedCost ?? 0),
      })),
    };
    if (initial) update.mutate({ id: initial.id, data: payload });
    else create.mutate({ data: payload });
  };

  const busy = create.isPending || update.isPending;

  return (
    <View style={{ gap: 12 }}>
      <SectionHeading title="Request" />
      <BrandInput label="Description *" multiline value={form.description ?? ""} onChangeText={v => upd({ description: v })} style={{ minHeight: 70, textAlignVertical: "top" }} />
      <FormRow>
        <FormCell><BrandInput label="Department" value={form.department ?? ""} onChangeText={v => upd({ department: v })} /></FormCell>
        <FormCell><BrandInput label="Project ref" value={form.projectRef ?? ""} onChangeText={v => upd({ projectRef: v })} /></FormCell>
      </FormRow>
      <FormRow>
        <FormCell><Select label="Priority" value={form.priority ?? "normal"} options={PR_PRIORITIES} onChange={v => upd({ priority: v })} /></FormCell>
        <FormCell><BrandInput label="Required date (YYYY-MM-DD)" icon="calendar" value={form.requiredDate ?? ""} onChangeText={v => upd({ requiredDate: v })} /></FormCell>
      </FormRow>

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
            <FormCell><BrandInput label="Est. cost" keyboardType="numeric" value={String(it.estimatedCost ?? 0)} onChangeText={v => updItem(it.key, { estimatedCost: Number(v) || 0 })} /></FormCell>
          </FormRow>
        </Card>
      ))}

      <BrandButton label={initial ? "Save changes" : "Create PR"} icon="check" loading={busy} onPress={submit} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  itemIdx: { fontFamily: "Inter_700Bold", fontSize: 13 },
});
