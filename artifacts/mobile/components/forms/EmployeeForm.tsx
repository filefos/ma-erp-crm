import React, { useState } from "react";
import { Alert, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  type CreateEmployeeBody, type Employee,
  getGetEmployeeQueryKey, getListEmployeesQueryKey,
  useCreateEmployee, useUpdateEmployee, useListDepartments,
} from "@workspace/api-client-react";
import { BrandButton, BrandInput } from "@/components/ui";
import { FormCell, FormRow, Select } from "@/components/forms";
import { EMPLOYEE_TYPES } from "@/lib/format";
import { useApp } from "@/contexts/AppContext";

interface Props { initial?: Employee | null }

export function EmployeeForm({ initial }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { activeCompanyId } = useApp();
  const departments = useListDepartments();

  const [form, setForm] = useState<CreateEmployeeBody>(() => ({
    name: initial?.name ?? "",
    type: initial?.type ?? "staff",
    designation: initial?.designation ?? "",
    departmentId: initial?.departmentId,
    companyId: initial?.companyId ?? activeCompanyId ?? 1,
    phone: initial?.phone ?? "",
    email: initial?.email ?? "",
    nationality: initial?.nationality ?? "",
    siteLocation: initial?.siteLocation ?? "",
    joiningDate: initial?.joiningDate ?? "",
  }));
  const upd = (p: Partial<CreateEmployeeBody>) => setForm(f => ({ ...f, ...p }));

  const create = useCreateEmployee({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
        router.back();
      },
      onError: (e: unknown) => Alert.alert("Could not save employee", (e as Error).message ?? ""),
    },
  });
  const update = useUpdateEmployee({
    mutation: {
      onSuccess: (_d, vars) => {
        queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
        if (vars?.id) queryClient.invalidateQueries({ queryKey: getGetEmployeeQueryKey(vars.id) });
        router.back();
      },
      onError: (e: unknown) => Alert.alert("Could not save employee", (e as Error).message ?? ""),
    },
  });

  const submit = () => {
    if (!form.name.trim()) return Alert.alert("Name is required");
    if (!form.companyId) return Alert.alert("Company is required");
    const data: CreateEmployeeBody = {
      ...form,
      departmentId: form.departmentId ? Number(form.departmentId) : undefined,
      joiningDate: form.joiningDate || undefined,
    };
    if (initial) update.mutate({ id: initial.id, data });
    else create.mutate({ data });
  };

  const busy = create.isPending || update.isPending;
  const deptOpts = [
    { value: "", label: "Unassigned" },
    ...((departments.data ?? []).map(d => ({ value: String(d.id), label: d.name }))),
  ];

  return (
    <View style={{ gap: 12 }}>
      <BrandInput label="Full name *" icon="user" value={form.name} onChangeText={v => upd({ name: v })} />
      <FormRow>
        <FormCell>
          <Select
            label="Type *"
            value={form.type}
            options={EMPLOYEE_TYPES.map(t => ({ value: t.value, label: t.label }))}
            onChange={v => upd({ type: v })}
          />
        </FormCell>
        <FormCell>
          <BrandInput label="Designation" value={form.designation ?? ""} onChangeText={v => upd({ designation: v })} />
        </FormCell>
      </FormRow>
      <Select
        label="Department"
        value={form.departmentId != null ? String(form.departmentId) : ""}
        options={deptOpts}
        onChange={v => upd({ departmentId: v ? Number(v) : undefined })}
      />
      <FormRow>
        <FormCell>
          <BrandInput label="Phone" icon="phone" keyboardType="phone-pad" value={form.phone ?? ""} onChangeText={v => upd({ phone: v })} />
        </FormCell>
        <FormCell>
          <BrandInput label="Email" icon="mail" autoCapitalize="none" keyboardType="email-address" value={form.email ?? ""} onChangeText={v => upd({ email: v })} />
        </FormCell>
      </FormRow>
      <FormRow>
        <FormCell>
          <BrandInput label="Nationality" value={form.nationality ?? ""} onChangeText={v => upd({ nationality: v })} />
        </FormCell>
        <FormCell>
          <BrandInput label="Site / Location" value={form.siteLocation ?? ""} onChangeText={v => upd({ siteLocation: v })} />
        </FormCell>
      </FormRow>
      <BrandInput label="Joining date (YYYY-MM-DD)" icon="calendar" value={form.joiningDate ?? ""} onChangeText={v => upd({ joiningDate: v })} placeholder="2024-01-15" />
      <BrandButton label={initial ? "Save changes" : "Create employee"} onPress={submit} loading={busy} icon="check" />
    </View>
  );
}
