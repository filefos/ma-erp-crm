import React, { useState } from "react";
import { Alert, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  type CreateDealBody, type Deal,
  getListDealsQueryKey,
  useCreateDeal, useUpdateDeal,
} from "@workspace/api-client-react";
import { BrandButton, BrandInput } from "@/components/ui";
import { DatePickerField, FormCell, FormRow, Select } from "@/components/forms";
import { DEAL_STAGES } from "@/lib/format";
import { useApp } from "@/contexts/AppContext";

interface Props { initial?: Deal | null }
export function DealForm({ initial }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { activeCompanyId } = useApp();
  const [form, setForm] = useState<CreateDealBody>(() => ({
    title: initial?.title ?? "",
    clientName: initial?.clientName ?? "",
    value: initial?.value,
    stage: initial?.stage ?? "new",
    probability: initial?.probability,
    expectedCloseDate: initial?.expectedCloseDate ?? "",
    assignedToId: initial?.assignedToId,
    companyId: initial?.companyId ?? activeCompanyId ?? undefined,
    leadId: initial?.leadId,
    notes: initial?.notes ?? "",
  }));
  const upd = (p: Partial<CreateDealBody>) => setForm(f => ({ ...f, ...p }));

  const create = useCreateDeal({
    mutation: {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListDealsQueryKey() }); router.back(); },
      onError: (e: unknown) => Alert.alert("Could not save", (e as Error).message ?? ""),
    },
  });
  const update = useUpdateDeal({
    mutation: {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListDealsQueryKey() }); router.back(); },
      onError: (e: unknown) => Alert.alert("Could not save", (e as Error).message ?? ""),
    },
  });

  const submit = () => {
    if (!form.title.trim()) return Alert.alert("Title is required");
    const data: CreateDealBody = {
      ...form,
      value: form.value ? Number(form.value) : undefined,
      probability: form.probability ? Number(form.probability) : undefined,
      expectedCloseDate: form.expectedCloseDate || undefined,
    };
    if (initial) update.mutate({ id: initial.id, data });
    else create.mutate({ data });
  };

  const busy = create.isPending || update.isPending;
  return (
    <View style={{ gap: 12 }}>
      <BrandInput label="Title *" icon="briefcase" value={form.title} onChangeText={v => upd({ title: v })} />
      <BrandInput label="Client" value={form.clientName ?? ""} onChangeText={v => upd({ clientName: v })} />
      <FormRow>
        <FormCell><BrandInput label="Value (AED)" keyboardType="numeric" value={form.value != null ? String(form.value) : ""} onChangeText={v => upd({ value: v ? Number(v) : undefined })} /></FormCell>
        <FormCell><BrandInput label="Probability (%)" keyboardType="numeric" value={form.probability != null ? String(form.probability) : ""} onChangeText={v => upd({ probability: v ? Number(v) : undefined })} /></FormCell>
      </FormRow>
      <Select label="Stage" value={form.stage} options={DEAL_STAGES} onChange={v => upd({ stage: v })} />
      <DatePickerField label="Expected close" value={form.expectedCloseDate ?? ""} onChange={v => upd({ expectedCloseDate: v || undefined })} />
      <BrandInput label="Notes" multiline value={form.notes ?? ""} onChangeText={v => upd({ notes: v })} style={{ minHeight: 80, textAlignVertical: "top" }} />
      <BrandButton label={initial ? "Save changes" : "Create deal"} onPress={submit} loading={busy} icon="check" />
    </View>
  );
}
