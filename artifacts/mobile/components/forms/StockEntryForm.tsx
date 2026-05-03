import React, { useMemo, useState } from "react";
import { Alert, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  type CreateStockEntryBody,
  getListInventoryItemsQueryKey, getListStockEntriesQueryKey, getGetInventoryItemQueryKey,
  useCreateStockEntry, useListInventoryItems,
} from "@workspace/api-client-react";
import { BrandButton, BrandInput, SectionHeading } from "@/components/ui";
import { FormCell, FormRow, Select } from "@/components/forms";
import { STOCK_ENTRY_TYPES } from "@/lib/format";
import { useApp } from "@/contexts/AppContext";

interface Props {
  initialItemId?: number;
  initialType?: string;
}

export function StockEntryForm({ initialItemId, initialType }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const { activeCompanyId } = useApp();
  const items = useListInventoryItems();

  const [form, setForm] = useState<CreateStockEntryBody>(() => ({
    companyId: activeCompanyId ?? 1,
    type: initialType ?? "stock_in",
    itemId: initialItemId ?? 0,
    quantity: 1,
    unit: "nos",
    reference: "",
    notes: "",
  }));
  const upd = (p: Partial<CreateStockEntryBody>) => setForm(f => ({ ...f, ...p }));

  const selectedItem = useMemo(() => (items.data ?? []).find(i => i.id === form.itemId), [items.data, form.itemId]);

  // Auto-fill unit on item pick
  React.useEffect(() => {
    if (selectedItem && selectedItem.unit && !form.unit) upd({ unit: selectedItem.unit });
    if (selectedItem?.unit && form.unit !== selectedItem.unit) upd({ unit: selectedItem.unit });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItem?.id]);

  const create = useCreateStockEntry({
    mutation: {
      onSuccess: (_d, vars) => {
        qc.invalidateQueries({ queryKey: getListStockEntriesQueryKey() });
        qc.invalidateQueries({ queryKey: getListInventoryItemsQueryKey() });
        if (vars?.data?.itemId) qc.invalidateQueries({ queryKey: getGetInventoryItemQueryKey(vars.data.itemId) });
        router.back();
      },
      onError: (e: unknown) => Alert.alert("Could not save", (e as Error).message ?? ""),
    },
  });

  const submit = () => {
    if (!form.itemId) return Alert.alert("Pick an item");
    if (!Number(form.quantity) || Number(form.quantity) <= 0) return Alert.alert("Quantity must be > 0");
    create.mutate({ data: { ...form, quantity: Number(form.quantity) } });
  };

  const itemOpts = (items.data ?? []).map(i => ({
    value: String(i.id), label: i.name, hint: `${i.itemCode ?? ""} • stock ${Number(i.currentStock ?? 0)} ${i.unit}`,
  }));

  return (
    <View style={{ gap: 12 }}>
      <SectionHeading title="Stock movement" />
      <Select label="Type" value={form.type} options={STOCK_ENTRY_TYPES} onChange={v => upd({ type: v })} />
      <Select label="Item *" value={form.itemId ? String(form.itemId) : ""} options={itemOpts}
        onChange={v => upd({ itemId: Number(v) })} />
      <FormRow>
        <FormCell><BrandInput label="Quantity *" keyboardType="numeric" value={String(form.quantity ?? "")} onChangeText={v => upd({ quantity: Number(v) || 0 })} /></FormCell>
        <FormCell><BrandInput label="Unit" value={form.unit ?? ""} onChangeText={v => upd({ unit: v })} /></FormCell>
      </FormRow>
      <BrandInput label="Reference (PO #, project, etc.)" value={form.reference ?? ""} onChangeText={v => upd({ reference: v })} />
      <BrandInput label="Notes" multiline value={form.notes ?? ""} onChangeText={v => upd({ notes: v })} style={{ minHeight: 60, textAlignVertical: "top" }} />
      <BrandButton label="Record entry" icon="check" loading={create.isPending} onPress={submit} />
    </View>
  );
}
