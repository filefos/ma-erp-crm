import React, { useState } from "react";
import { Alert, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  type Asset, type CreateAssetBody,
  getGetAssetQueryKey, getListAssetsQueryKey,
  useCreateAsset, useUpdateAsset,
} from "@workspace/api-client-react";
import { BrandButton, BrandInput, SectionHeading } from "@/components/ui";
import { FormCell, FormRow, Select } from "@/components/forms";
import { ASSET_CONDITIONS, ASSET_STATUSES } from "@/lib/format";
import { useApp } from "@/contexts/AppContext";

interface Props { initial?: Asset | null }

export function AssetForm({ initial }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const { activeCompanyId } = useApp();
  const [form, setForm] = useState<CreateAssetBody>(() => ({
    companyId: initial?.companyId ?? activeCompanyId ?? 1,
    name: initial?.name ?? "",
    category: initial?.category ?? "",
    purchaseDate: initial?.purchaseDate ?? "",
    purchaseValue: Number(initial?.purchaseValue ?? 0),
    currentLocation: initial?.currentLocation ?? "",
    assignedTo: initial?.assignedTo ?? "",
    condition: initial?.condition ?? "good",
    maintenanceDate: initial?.maintenanceDate ?? "",
    status: initial?.status ?? "active",
    notes: initial?.notes ?? "",
  }));
  const upd = (p: Partial<CreateAssetBody>) => setForm(f => ({ ...f, ...p }));

  const create = useCreateAsset({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListAssetsQueryKey() }); router.back(); },
      onError: (e: unknown) => Alert.alert("Could not save", (e as Error).message ?? ""),
    },
  });
  const update = useUpdateAsset({
    mutation: {
      onSuccess: (_d, vars) => {
        qc.invalidateQueries({ queryKey: getListAssetsQueryKey() });
        if (vars?.id) qc.invalidateQueries({ queryKey: getGetAssetQueryKey(vars.id) });
        router.back();
      },
      onError: (e: unknown) => Alert.alert("Could not save", (e as Error).message ?? ""),
    },
  });

  const submit = () => {
    if (!form.name.trim() || !form.category.trim()) return Alert.alert("Name and category are required");
    if (initial) update.mutate({ id: initial.id, data: form });
    else create.mutate({ data: form });
  };
  const busy = create.isPending || update.isPending;

  return (
    <View style={{ gap: 12 }}>
      <SectionHeading title="Asset" />
      <BrandInput label="Asset name *" icon="box" value={form.name} onChangeText={v => upd({ name: v })} />
      <FormRow>
        <FormCell><BrandInput label="Category *" value={form.category} onChangeText={v => upd({ category: v })} /></FormCell>
        <FormCell><BrandInput label="Assigned to" icon="user" value={form.assignedTo ?? ""} onChangeText={v => upd({ assignedTo: v })} /></FormCell>
      </FormRow>
      <FormRow>
        <FormCell><BrandInput label="Current location" icon="map-pin" value={form.currentLocation ?? ""} onChangeText={v => upd({ currentLocation: v })} /></FormCell>
        <FormCell><Select label="Condition" value={form.condition ?? "good"} options={ASSET_CONDITIONS} onChange={v => upd({ condition: v })} /></FormCell>
      </FormRow>

      <SectionHeading title="Lifecycle" />
      <FormRow>
        <FormCell><BrandInput label="Purchase date" icon="calendar" value={form.purchaseDate ?? ""} onChangeText={v => upd({ purchaseDate: v })} /></FormCell>
        <FormCell><BrandInput label="Purchase value (AED)" keyboardType="numeric" value={String(form.purchaseValue ?? 0)} onChangeText={v => upd({ purchaseValue: Number(v) || 0 })} /></FormCell>
      </FormRow>
      <FormRow>
        <FormCell><BrandInput label="Next maintenance" icon="calendar" value={form.maintenanceDate ?? ""} onChangeText={v => upd({ maintenanceDate: v })} /></FormCell>
        <FormCell><Select label="Status" value={form.status ?? "active"} options={ASSET_STATUSES.filter(s => s.value !== "in_use")} onChange={v => upd({ status: v })} /></FormCell>
      </FormRow>
      <BrandInput label="Notes" multiline value={form.notes ?? ""} onChangeText={v => upd({ notes: v })} style={{ minHeight: 80, textAlignVertical: "top" }} />

      <BrandButton label={initial ? "Save changes" : "Create asset"} icon="check" loading={busy} onPress={submit} />
    </View>
  );
}
