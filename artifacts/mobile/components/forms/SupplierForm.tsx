import React, { useState } from "react";
import { Alert, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  type CreateSupplierBody, type Supplier,
  getGetSupplierQueryKey, getListSuppliersQueryKey,
  useCreateSupplier, useUpdateSupplier,
} from "@workspace/api-client-react";
import { BrandButton, BrandInput, SectionHeading } from "@/components/ui";
import { FormCell, FormRow, Select } from "@/components/forms";
import { SUPPLIER_STATUSES } from "@/lib/format";
import { useApp } from "@/contexts/AppContext";

interface Props { initial?: Supplier | null }

export function SupplierForm({ initial }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const { activeCompanyId } = useApp();
  const [form, setForm] = useState<CreateSupplierBody>(() => ({
    companyId: initial?.companyId ?? activeCompanyId ?? undefined,
    name: initial?.name ?? "",
    contactPerson: initial?.contactPerson ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    whatsapp: initial?.whatsapp ?? "",
    address: initial?.address ?? "",
    trn: initial?.trn ?? "",
    website: initial?.website ?? "",
    category: initial?.category ?? "",
    paymentTerms: initial?.paymentTerms ?? "",
    bankName: initial?.bankName ?? "",
    bankAccountName: initial?.bankAccountName ?? "",
    bankAccountNumber: initial?.bankAccountNumber ?? "",
    iban: initial?.iban ?? "",
    status: initial?.status ?? "active",
    notes: initial?.notes ?? "",
  }));
  const upd = (p: Partial<CreateSupplierBody>) => setForm(f => ({ ...f, ...p }));

  const create = useCreateSupplier({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListSuppliersQueryKey() }); router.back(); },
      onError: (e: unknown) => Alert.alert("Could not save", (e as Error).message ?? ""),
    },
  });
  const update = useUpdateSupplier({
    mutation: {
      onSuccess: (_d, vars) => {
        qc.invalidateQueries({ queryKey: getListSuppliersQueryKey() });
        if (vars?.id) qc.invalidateQueries({ queryKey: getGetSupplierQueryKey(vars.id) });
        router.back();
      },
      onError: (e: unknown) => Alert.alert("Could not save", (e as Error).message ?? ""),
    },
  });

  const submit = () => {
    if (!form.name.trim()) return Alert.alert("Supplier name is required");
    if (initial) update.mutate({ id: initial.id, data: form });
    else create.mutate({ data: form });
  };

  const busy = create.isPending || update.isPending;

  return (
    <View style={{ gap: 12 }}>
      <SectionHeading title="Identity" />
      <BrandInput label="Supplier name *" icon="briefcase" value={form.name} onChangeText={v => upd({ name: v })} />
      <FormRow>
        <FormCell><BrandInput label="Contact person" value={form.contactPerson ?? ""} onChangeText={v => upd({ contactPerson: v })} /></FormCell>
        <FormCell><BrandInput label="Category" value={form.category ?? ""} onChangeText={v => upd({ category: v })} /></FormCell>
      </FormRow>
      <FormRow>
        <FormCell><BrandInput label="Email" autoCapitalize="none" keyboardType="email-address" value={form.email ?? ""} onChangeText={v => upd({ email: v })} /></FormCell>
        <FormCell><BrandInput label="Phone" keyboardType="phone-pad" value={form.phone ?? ""} onChangeText={v => upd({ phone: v })} /></FormCell>
      </FormRow>
      <FormRow>
        <FormCell><BrandInput label="WhatsApp" keyboardType="phone-pad" value={form.whatsapp ?? ""} onChangeText={v => upd({ whatsapp: v })} /></FormCell>
        <FormCell><BrandInput label="Website" autoCapitalize="none" value={form.website ?? ""} onChangeText={v => upd({ website: v })} /></FormCell>
      </FormRow>
      <BrandInput label="Address" multiline value={form.address ?? ""} onChangeText={v => upd({ address: v })} style={{ minHeight: 60, textAlignVertical: "top" }} />
      <FormRow>
        <FormCell><BrandInput label="TRN" value={form.trn ?? ""} onChangeText={v => upd({ trn: v })} /></FormCell>
        <FormCell><BrandInput label="Payment terms" value={form.paymentTerms ?? ""} onChangeText={v => upd({ paymentTerms: v })} /></FormCell>
      </FormRow>

      <SectionHeading title="Banking" />
      <FormRow>
        <FormCell><BrandInput label="Bank name" value={form.bankName ?? ""} onChangeText={v => upd({ bankName: v })} /></FormCell>
        <FormCell><BrandInput label="Account name" value={form.bankAccountName ?? ""} onChangeText={v => upd({ bankAccountName: v })} /></FormCell>
      </FormRow>
      <FormRow>
        <FormCell><BrandInput label="Account #" value={form.bankAccountNumber ?? ""} onChangeText={v => upd({ bankAccountNumber: v })} /></FormCell>
        <FormCell><BrandInput label="IBAN" value={form.iban ?? ""} onChangeText={v => upd({ iban: v })} /></FormCell>
      </FormRow>

      <SectionHeading title="Status" />
      <Select label="Status" value={form.status ?? "active"} options={SUPPLIER_STATUSES} onChange={v => upd({ status: v })} />
      <BrandInput label="Notes" multiline value={form.notes ?? ""} onChangeText={v => upd({ notes: v })} style={{ minHeight: 80, textAlignVertical: "top" }} />

      <BrandButton label={initial ? "Save changes" : "Create supplier"} icon="check" loading={busy} onPress={submit} />
    </View>
  );
}
