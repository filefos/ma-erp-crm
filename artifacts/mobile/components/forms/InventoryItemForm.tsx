import React, { useState } from "react";
import { Alert, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  type CreateInventoryItemBody, type InventoryItem,
  getGetInventoryItemQueryKey, getListInventoryItemsQueryKey,
  useCreateInventoryItem, useUpdateInventoryItem,
} from "@workspace/api-client-react";
import { BrandButton, BrandInput, SectionHeading } from "@/components/ui";
import { FormCell, FormRow } from "@/components/forms";
import { useApp } from "@/contexts/AppContext";

interface Props { initial?: InventoryItem | null }

export function InventoryItemForm({ initial }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const { activeCompanyId } = useApp();
  const [form, setForm] = useState<CreateInventoryItemBody>(() => ({
    companyId: initial?.companyId ?? activeCompanyId ?? 1,
    name: initial?.name ?? "",
    category: initial?.category ?? "",
    unit: initial?.unit ?? "nos",
    openingStock: Number(initial?.openingStock ?? 0),
    minimumStock: Number(initial?.minimumStock ?? 0),
    unitCost: Number(initial?.unitCost ?? 0),
    warehouseLocation: initial?.warehouseLocation ?? "",
  }));
  const upd = (p: Partial<CreateInventoryItemBody>) => setForm(f => ({ ...f, ...p }));

  const create = useCreateInventoryItem({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListInventoryItemsQueryKey() }); router.back(); },
      onError: (e: unknown) => Alert.alert("Could not save", (e as Error).message ?? ""),
    },
  });
  const update = useUpdateInventoryItem({
    mutation: {
      onSuccess: (_d, vars) => {
        qc.invalidateQueries({ queryKey: getListInventoryItemsQueryKey() });
        if (vars?.id) qc.invalidateQueries({ queryKey: getGetInventoryItemQueryKey(vars.id) });
        router.back();
      },
      onError: (e: unknown) => Alert.alert("Could not save", (e as Error).message ?? ""),
    },
  });

  const submit = () => {
    if (!form.name.trim() || !form.category.trim() || !form.unit.trim()) {
      return Alert.alert("Name, category and unit are required");
    }
    if (initial) update.mutate({ id: initial.id, data: form });
    else create.mutate({ data: form });
  };

  const busy = create.isPending || update.isPending;

  return (
    <View style={{ gap: 12 }}>
      <SectionHeading title="Item" />
      <BrandInput label="Item name *" icon="package" value={form.name} onChangeText={v => upd({ name: v })} />
      <FormRow>
        <FormCell><BrandInput label="Category *" value={form.category} onChangeText={v => upd({ category: v })} /></FormCell>
        <FormCell><BrandInput label="Unit *" value={form.unit} onChangeText={v => upd({ unit: v })} /></FormCell>
      </FormRow>
      <FormRow>
        <FormCell><BrandInput label="Opening stock" keyboardType="numeric" value={String(form.openingStock ?? 0)} onChangeText={v => upd({ openingStock: Number(v) || 0 })} /></FormCell>
        <FormCell><BrandInput label="Minimum stock" keyboardType="numeric" value={String(form.minimumStock ?? 0)} onChangeText={v => upd({ minimumStock: Number(v) || 0 })} /></FormCell>
      </FormRow>
      <FormRow>
        <FormCell><BrandInput label="Unit cost (AED)" keyboardType="numeric" value={String(form.unitCost ?? 0)} onChangeText={v => upd({ unitCost: Number(v) || 0 })} /></FormCell>
        <FormCell><BrandInput label="Warehouse" icon="map-pin" value={form.warehouseLocation ?? ""} onChangeText={v => upd({ warehouseLocation: v })} /></FormCell>
      </FormRow>
      <BrandButton label={initial ? "Save changes" : "Create item"} icon="check" loading={busy} onPress={submit} />
    </View>
  );
}
