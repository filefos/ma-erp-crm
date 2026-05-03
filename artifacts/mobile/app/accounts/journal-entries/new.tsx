import React, { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import {
  type CreateJournalEntryBody,
  type JournalEntryLine,
  getListJournalEntriesQueryKey,
  useCreateJournalEntry,
  useListChartOfAccounts,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, BrandInput, Card } from "@/components/ui";
import { FormCell, FormRow, Select } from "@/components/forms";
import { fmtAed } from "@/lib/format";
import { useApp } from "@/contexts/AppContext";

export default function NewJournalEntry() {
  const c = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const { activeCompanyId } = useApp();
  const accounts = useListChartOfAccounts({ companyId: activeCompanyId ?? undefined });
  const accountOpts = (accounts.data ?? []).map(a => ({ value: String(a.id), label: `${a.accountCode} — ${a.accountName}` }));

  const [form, setForm] = useState<CreateJournalEntryBody>({
    companyId: activeCompanyId ?? 1,
    entryDate: new Date().toISOString().slice(0, 10),
    description: "", reference: "", status: "draft",
    lines: [
      { accountName: "", debit: 0, credit: 0 },
      { accountName: "", debit: 0, credit: 0 },
    ],
  });
  const upd = (p: Partial<CreateJournalEntryBody>) => setForm(f => ({ ...f, ...p }));

  const updateLine = (i: number, p: Partial<JournalEntryLine>) => {
    setForm(f => {
      const lines = [...(f.lines ?? [])];
      lines[i] = { ...lines[i], ...p };
      return { ...f, lines };
    });
  };
  const addLine = () => setForm(f => ({ ...f, lines: [...(f.lines ?? []), { accountName: "", debit: 0, credit: 0 }] }));
  const removeLine = (i: number) => setForm(f => ({ ...f, lines: (f.lines ?? []).filter((_, idx) => idx !== i) }));

  const totals = useMemo(() => {
    const d = (form.lines ?? []).reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const cr = (form.lines ?? []).reduce((s, l) => s + (Number(l.credit) || 0), 0);
    return { d, cr, balanced: Math.abs(d - cr) < 0.01 && d > 0 };
  }, [form.lines]);

  const create = useCreateJournalEntry({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListJournalEntriesQueryKey() }); router.back(); },
      onError: (e: unknown) => Alert.alert("Could not save", (e as Error).message ?? ""),
    },
  });

  const submit = () => {
    if (!form.description.trim()) return Alert.alert("Description is required");
    if (!totals.balanced) return Alert.alert("Entry is not balanced", "Total debit must equal total credit and be greater than zero.");
    if ((form.lines ?? []).some(l => !l.accountName)) return Alert.alert("Each line needs an account");
    create.mutate({ data: {
      ...form,
      companyId: activeCompanyId ?? form.companyId,
      lines: (form.lines ?? []).map(l => ({ ...l, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 })),
    } });
  };

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="New journal entry" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <FormRow>
          <FormCell><BrandInput label="Entry date *" value={form.entryDate} onChangeText={v => upd({ entryDate: v })} /></FormCell>
          <FormCell><BrandInput label="Reference" value={form.reference ?? ""} onChangeText={v => upd({ reference: v })} /></FormCell>
        </FormRow>
        <BrandInput label="Description *" multiline value={form.description} onChangeText={v => upd({ description: v })} style={{ minHeight: 60, textAlignVertical: "top" }} />

        {(form.lines ?? []).map((l, i) => {
          const accountIdStr = l.accountId != null ? String(l.accountId) : "";
          return (
            <Card key={i}>
              <View style={styles.row}>
                <Text style={[styles.title, { color: c.foreground, flex: 1 }]}>Line {i + 1}</Text>
                {(form.lines ?? []).length > 2 ? (
                  <Pressable onPress={() => removeLine(i)} hitSlop={8}><Feather name="trash-2" size={16} color={c.destructive} /></Pressable>
                ) : null}
              </View>
              <Select label="Account" value={accountIdStr} options={accountOpts}
                onChange={v => {
                  const id = Number(v) || undefined;
                  const acc = (accounts.data ?? []).find(a => a.id === id);
                  updateLine(i, { accountId: id, accountName: acc ? `${acc.accountCode} — ${acc.accountName}` : "" });
                }} />
              <BrandInput label="Description" value={l.description ?? ""} onChangeText={v => updateLine(i, { description: v })} />
              <FormRow>
                <FormCell><BrandInput label="Debit" keyboardType="numeric" value={String(l.debit ?? 0)} onChangeText={v => updateLine(i, { debit: Number(v) || 0, credit: 0 })} /></FormCell>
                <FormCell><BrandInput label="Credit" keyboardType="numeric" value={String(l.credit ?? 0)} onChangeText={v => updateLine(i, { credit: Number(v) || 0, debit: 0 })} /></FormCell>
              </FormRow>
            </Card>
          );
        })}
        <BrandButton label="Add line" icon="plus" variant="ghost" onPress={addLine} />

        <Card>
          <View style={styles.row}>
            <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 14, flex: 1 }}>Totals</Text>
            <Text style={{ color: c.primary, fontFamily: "Inter_700Bold", fontSize: 14 }}>Dr {fmtAed(totals.d)} · Cr {fmtAed(totals.cr)}</Text>
          </View>
          <Text style={{ color: totals.balanced ? c.success : c.destructive, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
            {totals.balanced ? "Balanced" : `Out of balance by ${fmtAed(Math.abs(totals.d - totals.cr))}`}
          </Text>
        </Card>

        <BrandButton label="Create entry" icon="check" loading={create.isPending} onPress={submit} disabled={!totals.balanced} />
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 120 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  title: { fontFamily: "Inter_700Bold", fontSize: 14 },
});
