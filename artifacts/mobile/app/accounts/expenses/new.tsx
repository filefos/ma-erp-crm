import React, { useMemo, useState } from "react";
import { Alert, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import {
  type CreateExpenseBody,
  getListExpensesQueryKey,
  useCreateExpense,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, BrandInput, Card } from "@/components/ui";
import { FormCell, FormRow, Select } from "@/components/forms";
import { EXPENSE_CATEGORIES, EXPENSE_STATUSES, PAYMENT_METHODS } from "@/lib/format";
import { useApp } from "@/contexts/AppContext";

const RECEIPT_MARKER = "\n\n[Receipt]\n";

export default function NewExpense() {
  const c = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const { activeCompanyId } = useApp();
  const [form, setForm] = useState<CreateExpenseBody>({
    category: "office", supplierId: undefined, invoiceNumber: "",
    amount: 0, vatAmount: 0, total: 0,
    paymentMethod: "cash", paymentDate: new Date().toISOString().slice(0, 10),
    status: "pending", companyId: activeCompanyId ?? 1, description: "",
  });
  const upd = (p: Partial<CreateExpenseBody>) => setForm(f => ({ ...f, ...p }));
  const [receipt, setReceipt] = useState<{ uri: string; dataUrl: string } | null>(null);

  const totals = useMemo(() => {
    const a = Number(form.amount) || 0;
    const v = Number(form.vatAmount) || 0;
    return { total: Math.round((a + v) * 100) / 100 };
  }, [form.amount, form.vatAmount]);

  const create = useCreateExpense({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListExpensesQueryKey() }); router.back(); },
      onError: (e: unknown) => Alert.alert("Could not save", (e as Error).message ?? ""),
    },
  });

  const pickReceipt = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert("Permission needed", "Allow photo access to attach a receipt.");
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, base64: true, quality: 0.6 });
    if (res.canceled || !res.assets.length) return;
    const a = res.assets[0];
    if (a.base64) setReceipt({ uri: a.uri, dataUrl: `data:${a.mimeType ?? "image/jpeg"};base64,${a.base64}` });
  };

  const captureReceipt = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return Alert.alert("Permission needed", "Allow camera access to capture a receipt.");
    const res = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.6 });
    if (res.canceled || !res.assets.length) return;
    const a = res.assets[0];
    if (a.base64) setReceipt({ uri: a.uri, dataUrl: `data:${a.mimeType ?? "image/jpeg"};base64,${a.base64}` });
  };

  const submit = () => {
    if (Number(form.amount) <= 0) return Alert.alert("Amount must be greater than zero");
    const desc = (form.description ?? "").trim();
    const merged = receipt ? `${desc}${RECEIPT_MARKER}${receipt.dataUrl}` : desc;
    create.mutate({ data: {
      ...form, amount: Number(form.amount), vatAmount: Number(form.vatAmount), total: totals.total,
      companyId: activeCompanyId ?? form.companyId, description: merged,
    } });
  };

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="New expense" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Select label="Category *" value={form.category} options={EXPENSE_CATEGORIES} onChange={v => upd({ category: v })} />
        <BrandInput label="Supplier invoice #" value={form.invoiceNumber ?? ""} onChangeText={v => upd({ invoiceNumber: v })} />
        <FormRow>
          <FormCell><BrandInput label="Amount (AED) *" keyboardType="numeric" value={String(form.amount ?? 0)} onChangeText={v => upd({ amount: Number(v) || 0 })} /></FormCell>
          <FormCell><BrandInput label="VAT (AED)" keyboardType="numeric" value={String(form.vatAmount ?? 0)} onChangeText={v => upd({ vatAmount: Number(v) || 0 })} /></FormCell>
        </FormRow>
        <BrandInput label="Total" editable={false} value={String(totals.total)} />
        <FormRow>
          <FormCell><Select label="Method" value={form.paymentMethod ?? "cash"} options={PAYMENT_METHODS} onChange={v => upd({ paymentMethod: v })} /></FormCell>
          <FormCell><BrandInput label="Payment date" value={form.paymentDate ?? ""} onChangeText={v => upd({ paymentDate: v })} /></FormCell>
        </FormRow>
        <Select label="Status" value={form.status ?? "pending"} options={EXPENSE_STATUSES} onChange={v => upd({ status: v })} />
        <BrandInput label="Description" multiline value={form.description ?? ""} onChangeText={v => upd({ description: v })} style={{ minHeight: 60, textAlignVertical: "top" }} />

        <Card>
          <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>Receipt photo</Text>
          {receipt ? (
            <Image source={{ uri: receipt.uri }} style={{ width: "100%", height: 180, borderRadius: 8 }} resizeMode="cover" />
          ) : (
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 13 }}>No receipt attached.</Text>
          )}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <BrandButton label="Camera" icon="camera" variant="secondary" onPress={captureReceipt} style={{ flex: 1 }} />
            <BrandButton label="Library" icon="image" variant="secondary" onPress={pickReceipt} style={{ flex: 1 }} />
          </View>
          {receipt ? <BrandButton label="Remove" icon="x" variant="ghost" onPress={() => setReceipt(null)} /> : null}
        </Card>

        <BrandButton label="Create expense" icon="check" loading={create.isPending} onPress={submit} />
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({ flex: { flex: 1 }, content: { padding: 16, gap: 12, paddingBottom: 120 } });
