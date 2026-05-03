import React, { useState } from "react";
import { Alert, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  type Contact, type CreateContactBody,
  getListContactsQueryKey,
  useCreateContact, useUpdateContact,
} from "@workspace/api-client-react";
import { BrandButton, BrandInput } from "@/components/ui";
import { FormCell, FormRow } from "@/components/forms";
import { useApp } from "@/contexts/AppContext";

interface Props { initial?: Contact | null }
export function ContactForm({ initial }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { activeCompanyId } = useApp();
  const [form, setForm] = useState<CreateContactBody>(() => ({
    name: initial?.name ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    whatsapp: initial?.whatsapp ?? "",
    companyName: initial?.companyName ?? "",
    designation: initial?.designation ?? "",
    notes: initial?.notes ?? "",
    companyId: initial?.companyId ?? activeCompanyId ?? undefined,
  }));
  const upd = (p: Partial<CreateContactBody>) => setForm(f => ({ ...f, ...p }));

  const create = useCreateContact({
    mutation: {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListContactsQueryKey() }); router.back(); },
      onError: (e: unknown) => Alert.alert("Could not save", (e as Error).message ?? ""),
    },
  });
  const update = useUpdateContact({
    mutation: {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListContactsQueryKey() }); router.back(); },
      onError: (e: unknown) => Alert.alert("Could not save", (e as Error).message ?? ""),
    },
  });

  const submit = () => {
    if (!form.name.trim()) return Alert.alert("Name is required");
    if (initial) update.mutate({ id: initial.id, data: form });
    else create.mutate({ data: form });
  };
  const busy = create.isPending || update.isPending;

  return (
    <View style={{ gap: 12 }}>
      <BrandInput label="Name *" icon="user" value={form.name} onChangeText={v => upd({ name: v })} />
      <FormRow>
        <FormCell><BrandInput label="Designation" value={form.designation ?? ""} onChangeText={v => upd({ designation: v })} /></FormCell>
        <FormCell><BrandInput label="Company" value={form.companyName ?? ""} onChangeText={v => upd({ companyName: v })} /></FormCell>
      </FormRow>
      <FormRow>
        <FormCell><BrandInput label="Phone" icon="phone" keyboardType="phone-pad" value={form.phone ?? ""} onChangeText={v => upd({ phone: v })} /></FormCell>
        <FormCell><BrandInput label="WhatsApp" keyboardType="phone-pad" value={form.whatsapp ?? ""} onChangeText={v => upd({ whatsapp: v })} /></FormCell>
      </FormRow>
      <BrandInput label="Email" icon="mail" autoCapitalize="none" keyboardType="email-address" value={form.email ?? ""} onChangeText={v => upd({ email: v })} />
      <BrandInput label="Notes" multiline value={form.notes ?? ""} onChangeText={v => upd({ notes: v })} style={{ minHeight: 80, textAlignVertical: "top" }} />
      <BrandButton label={initial ? "Save changes" : "Create contact"} onPress={submit} loading={busy} icon="check" />
    </View>
  );
}
