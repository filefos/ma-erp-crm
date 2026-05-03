import React, { useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  type CreateActivityBody,
  getListActivitiesQueryKey,
  useCreateActivity,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, BrandInput } from "@/components/ui";
import { Select } from "@/components/forms";
import { ACTIVITY_TYPES } from "@/lib/format";

export default function NewActivity() {
  const c = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const { leadId, dealId, contactId } = useLocalSearchParams<{ leadId?: string; dealId?: string; contactId?: string }>();
  const [form, setForm] = useState<CreateActivityBody>({
    type: "follow_up",
    subject: "",
    description: "",
    dueDate: "",
    leadId: leadId ? Number(leadId) : undefined,
    dealId: dealId ? Number(dealId) : undefined,
    contactId: contactId ? Number(contactId) : undefined,
  });
  const upd = (p: Partial<CreateActivityBody>) => setForm(f => ({ ...f, ...p }));

  const create = useCreateActivity({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListActivitiesQueryKey() }); router.back(); },
      onError: (e: unknown) => Alert.alert("Could not save", (e as Error).message ?? ""),
    },
  });

  const submit = () => {
    if (!form.subject.trim()) return Alert.alert("Subject is required");
    create.mutate({ data: { ...form, dueDate: form.dueDate || undefined } });
  };

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="New activity" subtitle="Log a call, meeting or task" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Select label="Type" value={form.type} options={ACTIVITY_TYPES} onChange={v => upd({ type: v })} />
        <BrandInput label="Subject *" icon="edit-3" value={form.subject} onChangeText={v => upd({ subject: v })} />
        <BrandInput label="Description" multiline value={form.description ?? ""} onChangeText={v => upd({ description: v })} style={{ minHeight: 100, textAlignVertical: "top" }} />
        <BrandInput label="Due date (YYYY-MM-DD)" icon="calendar" value={form.dueDate ?? ""} onChangeText={v => upd({ dueDate: v })} />
        <BrandButton label="Create activity" icon="check" loading={create.isPending} onPress={submit} />
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({ flex: { flex: 1 }, content: { padding: 16, gap: 12, paddingBottom: 120 } });
