import React, { useState } from "react";
import { Alert, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  type CreateLeadBody,
  type Lead,
  getGetLeadQueryKey,
  getListLeadsQueryKey,
  useCreateLead,
  useUpdateLead,
} from "@workspace/api-client-react";
import { BrandButton, BrandInput } from "@/components/ui";
import { DatePickerField, FormCell, FormRow, Select } from "@/components/forms";
import { LEAD_SCORES, LEAD_STATUSES } from "@/lib/format";
import { useApp } from "@/contexts/AppContext";

interface Props { initial?: Lead | null }

export function LeadForm({ initial }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { activeCompanyId } = useApp();
  const [form, setForm] = useState<CreateLeadBody>(() => ({
    leadName: initial?.leadName ?? "",
    companyName: initial?.companyName ?? "",
    contactPerson: initial?.contactPerson ?? "",
    phone: initial?.phone ?? "",
    whatsapp: initial?.whatsapp ?? "",
    email: initial?.email ?? "",
    location: initial?.location ?? "",
    source: initial?.source ?? "",
    requirementType: initial?.requirementType ?? "",
    quantity: initial?.quantity,
    budget: initial?.budget,
    status: initial?.status ?? "new",
    notes: initial?.notes ?? "",
    nextFollowUp: initial?.nextFollowUp ?? "",
    leadScore: initial?.leadScore ?? "warm",
    companyId: initial?.companyId ?? activeCompanyId ?? undefined,
  }));

  const upd = (patch: Partial<CreateLeadBody>) => setForm(f => ({ ...f, ...patch }));

  const create = useCreateLead({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
        router.back();
      },
      onError: (e: unknown) => Alert.alert("Could not save lead", (e as Error).message ?? "Please try again."),
    },
  });
  const update = useUpdateLead({
    mutation: {
      onSuccess: (_d, vars) => {
        queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
        if (vars?.id) queryClient.invalidateQueries({ queryKey: getGetLeadQueryKey(vars.id) });
        router.back();
      },
      onError: (e: unknown) => Alert.alert("Could not save lead", (e as Error).message ?? "Please try again."),
    },
  });

  const submit = () => {
    if (!form.leadName.trim()) return Alert.alert("Lead name is required");
    const data: CreateLeadBody = {
      ...form,
      quantity: form.quantity ? Number(form.quantity) : undefined,
      budget: form.budget ? Number(form.budget) : undefined,
      nextFollowUp: form.nextFollowUp || undefined,
    };
    if (initial) update.mutate({ id: initial.id, data });
    else create.mutate({ data });
  };

  const busy = create.isPending || update.isPending;

  return (
    <View style={{ gap: 12 }}>
      <BrandInput label="Lead name *" icon="user" value={form.leadName} onChangeText={v => upd({ leadName: v })} />
      <FormRow>
        <FormCell><BrandInput label="Company" value={form.companyName ?? ""} onChangeText={v => upd({ companyName: v })} /></FormCell>
        <FormCell><BrandInput label="Contact person" value={form.contactPerson ?? ""} onChangeText={v => upd({ contactPerson: v })} /></FormCell>
      </FormRow>
      <FormRow>
        <FormCell><BrandInput label="Phone" icon="phone" keyboardType="phone-pad" value={form.phone ?? ""} onChangeText={v => upd({ phone: v })} /></FormCell>
        <FormCell><BrandInput label="WhatsApp" keyboardType="phone-pad" value={form.whatsapp ?? ""} onChangeText={v => upd({ whatsapp: v })} /></FormCell>
      </FormRow>
      <BrandInput label="Email" icon="mail" autoCapitalize="none" keyboardType="email-address" value={form.email ?? ""} onChangeText={v => upd({ email: v })} />
      <BrandInput label="Location" icon="map-pin" value={form.location ?? ""} onChangeText={v => upd({ location: v })} />
      <FormRow>
        <FormCell><BrandInput label="Source" value={form.source ?? ""} onChangeText={v => upd({ source: v })} /></FormCell>
        <FormCell><BrandInput label="Requirement" value={form.requirementType ?? ""} onChangeText={v => upd({ requirementType: v })} /></FormCell>
      </FormRow>
      <FormRow>
        <FormCell><BrandInput label="Quantity" keyboardType="numeric" value={form.quantity != null ? String(form.quantity) : ""} onChangeText={v => upd({ quantity: v ? Number(v) : undefined })} /></FormCell>
        <FormCell><BrandInput label="Budget (AED)" keyboardType="numeric" value={form.budget != null ? String(form.budget) : ""} onChangeText={v => upd({ budget: v ? Number(v) : undefined })} /></FormCell>
      </FormRow>
      <FormRow>
        <FormCell><Select label="Status" value={form.status} options={LEAD_STATUSES} onChange={v => upd({ status: v })} /></FormCell>
        <FormCell><Select label="Score" value={form.leadScore ?? "warm"} options={LEAD_SCORES} onChange={v => upd({ leadScore: v })} /></FormCell>
      </FormRow>
      <DatePickerField label="Next follow-up" value={form.nextFollowUp ?? ""} onChange={v => upd({ nextFollowUp: v || undefined })} />
      <BrandInput label="Notes" multiline value={form.notes ?? ""} onChangeText={v => upd({ notes: v })} style={{ minHeight: 80, textAlignVertical: "top" }} />
      <BrandButton label={initial ? "Save changes" : "Create lead"} onPress={submit} loading={busy} icon="check" />
    </View>
  );
}
