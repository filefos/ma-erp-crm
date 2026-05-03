import React, { useState } from "react";
import { Alert, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  type CreateProjectBody, type Project,
  getGetProjectQueryKey, getListProjectsQueryKey,
  useCreateProject, useUpdateProject, useListUsers,
} from "@workspace/api-client-react";
import { BrandButton, BrandInput } from "@/components/ui";
import { FormCell, FormRow, Select } from "@/components/forms";
import { PROJECT_STAGES } from "@/lib/format";
import { useApp } from "@/contexts/AppContext";

interface Props { initial?: Project | null }

export function ProjectForm({ initial }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { activeCompanyId } = useApp();
  const users = useListUsers();

  const [form, setForm] = useState<CreateProjectBody>(() => ({
    projectName: initial?.projectName ?? "",
    clientName: initial?.clientName ?? "",
    companyId: initial?.companyId ?? activeCompanyId ?? 1,
    location: initial?.location ?? "",
    scope: initial?.scope ?? "",
    projectValue: initial?.projectValue,
    stage: initial?.stage ?? "new_project",
    projectManagerId: initial?.projectManagerId,
    salespersonId: initial?.salespersonId,
    startDate: initial?.startDate ?? "",
    endDate: initial?.endDate ?? "",
    deliveryDate: initial?.deliveryDate ?? "",
  }));
  const upd = (p: Partial<CreateProjectBody>) => setForm(f => ({ ...f, ...p }));

  const create = useCreateProject({
    mutation: {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() }); router.back(); },
      onError: (e: unknown) => Alert.alert("Could not save project", (e as Error).message ?? ""),
    },
  });
  const update = useUpdateProject({
    mutation: {
      onSuccess: (_d, vars) => {
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        if (vars?.id) queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(vars.id) });
        router.back();
      },
      onError: (e: unknown) => Alert.alert("Could not save project", (e as Error).message ?? ""),
    },
  });

  const submit = () => {
    if (!form.projectName.trim()) return Alert.alert("Project name is required");
    if (!form.clientName.trim()) return Alert.alert("Client name is required");
    const data: CreateProjectBody = {
      ...form,
      projectValue: form.projectValue ? Number(form.projectValue) : undefined,
      projectManagerId: form.projectManagerId ? Number(form.projectManagerId) : undefined,
      salespersonId: form.salespersonId ? Number(form.salespersonId) : undefined,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      deliveryDate: form.deliveryDate || undefined,
    };
    if (initial) update.mutate({ id: initial.id, data });
    else create.mutate({ data });
  };

  const busy = create.isPending || update.isPending;
  const userOpts = [
    { value: "", label: "Unassigned" },
    ...((users.data ?? []).map(u => ({ value: String(u.id), label: u.name }))),
  ];

  return (
    <View style={{ gap: 12 }}>
      <BrandInput label="Project name *" icon="folder" value={form.projectName} onChangeText={v => upd({ projectName: v })} />
      <BrandInput label="Client name *" icon="user" value={form.clientName} onChangeText={v => upd({ clientName: v })} />
      <BrandInput label="Location" icon="map-pin" value={form.location ?? ""} onChangeText={v => upd({ location: v })} />
      <BrandInput label="Scope" multiline value={form.scope ?? ""} onChangeText={v => upd({ scope: v })} style={{ minHeight: 80, textAlignVertical: "top" }} />
      <FormRow>
        <FormCell>
          <Select
            label="Stage"
            value={form.stage ?? "new_project"}
            options={PROJECT_STAGES.map(s => ({ value: s.value, label: s.label }))}
            onChange={v => upd({ stage: v })}
          />
        </FormCell>
        <FormCell>
          <BrandInput
            label="Value (AED)"
            keyboardType="decimal-pad"
            value={form.projectValue != null ? String(form.projectValue) : ""}
            onChangeText={v => upd({ projectValue: v ? Number(v) : undefined })}
          />
        </FormCell>
      </FormRow>
      <Select
        label="Project manager"
        value={form.projectManagerId != null ? String(form.projectManagerId) : ""}
        options={userOpts}
        onChange={v => upd({ projectManagerId: v ? Number(v) : undefined })}
      />
      <Select
        label="Salesperson"
        value={form.salespersonId != null ? String(form.salespersonId) : ""}
        options={userOpts}
        onChange={v => upd({ salespersonId: v ? Number(v) : undefined })}
      />
      <FormRow>
        <FormCell><BrandInput label="Start date" icon="calendar" placeholder="YYYY-MM-DD" value={form.startDate ?? ""} onChangeText={v => upd({ startDate: v })} /></FormCell>
        <FormCell><BrandInput label="End date" icon="calendar" placeholder="YYYY-MM-DD" value={form.endDate ?? ""} onChangeText={v => upd({ endDate: v })} /></FormCell>
      </FormRow>
      <BrandInput label="Delivery date" icon="truck" placeholder="YYYY-MM-DD" value={form.deliveryDate ?? ""} onChangeText={v => upd({ deliveryDate: v })} />
      <BrandButton label={initial ? "Save changes" : "Create project"} onPress={submit} loading={busy} icon="check" />
    </View>
  );
}
