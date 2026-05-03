import React, { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  type CreatePurchaseOrderBody, type CreatePurchaseOrderBodyItemsItem, type PurchaseOrder,
  getGetPurchaseOrderQueryKey, getListPurchaseOrdersQueryKey,
  useCreatePurchaseOrder, useListPurchaseRequests, useListSuppliers, useUpdatePurchaseOrder,
} from "@workspace/api-client-react";
import { BrandButton, BrandInput, Card, SectionHeading } from "@/components/ui";
import { FormCell, FormRow, Select } from "@/components/forms";
import { fmtAed } from "@/lib/format";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

interface Props {
  initial?: PurchaseOrder | null;
  sourceSupplierId?: number;
  sourcePrId?: number;
  seedItems?: { itemName: string; quantity: number; unit: string; unitPrice: number }[];
}

interface DraftItem extends CreatePurchaseOrderBodyItemsItem { key: string }
function newItem(): DraftItem {
  return { key: Math.random().toString(36).slice(2), itemName: "", quantity: 1, unit: "nos", unitPrice: 0, amount: 0 };
}

export function PoForm({ initial, sourceSupplierId, sourcePrId, seedItems }: Props) {
  const c = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const { activeCompanyId } = useApp();
  const suppliers = useListSuppliers();
  const prs = useListPurchaseRequests({ status: "approved" });

  const [form, setForm] = useState<CreatePurchaseOrderBody>(() => ({
    companyId: initial?.companyId ?? activeCompanyId ?? 1,
    supplierId: initial?.supplierId ?? sourceSupplierId ?? 0,
    purchaseRequestId: initial?.purchaseRequestId ?? sourcePrId,
    paymentTerms: initial?.paymentTerms ?? "",
    deliveryDate: initial?.deliveryDate ?? "",
    subtotal: Number(initial?.subtotal ?? 0),
    vatAmount: Number(initial?.vatAmount ?? 0),
    total: Number(initial?.total ?? 0),
  }));
  const [items, setItems] = useState<DraftItem[]>(() => {
    if (initial?.items?.length) {
      return initial.items.map((it, i) => ({
        key: `${i}-${Math.random()}`,
        itemName: it.itemName, quantity: Number(it.quantity), unit: it.unit,
        unitPrice: Number(it.unitPrice ?? 0), amount: Number(it.amount ?? 0),
      }));
    }
    if (seedItems?.length) {
      return seedItems.map((it, i) => ({
        key: `${i}-${Math.random()}`,
        itemName: it.itemName, quantity: it.quantity, unit: it.unit,
        unitPrice: it.unitPrice, amount: it.unitPrice * it.quantity,
      }));
    }
    return [newItem()];
  });
  const [vatPct, setVatPct] = useState<number>(5);

  const upd = (p: Partial<CreatePurchaseOrderBody>) => setForm(f => ({ ...f, ...p }));
  const updItem = (key: string, p: Partial<DraftItem>) => setItems(prev => prev.map(it => it.key === key ? { ...it, ...p } : it));
  const removeItem = (key: string) => setItems(prev => prev.filter(it => it.key !== key));

  const totals = useMemo(() => {
    const subtotal = items.reduce((s, i) => s + Number(i.unitPrice ?? 0) * Number(i.quantity ?? 0), 0);
    const vat = subtotal * (vatPct / 100);
    return { subtotal, vat, grand: subtotal + vat };
  }, [items, vatPct]);

  const create = useCreatePurchaseOrder({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListPurchaseOrdersQueryKey() }); router.back(); },
      onError: (e: unknown) => Alert.alert("Could not save", (e as Error).message ?? ""),
    },
  });
  const update = useUpdatePurchaseOrder({
    mutation: {
      onSuccess: (_d, vars) => {
        qc.invalidateQueries({ queryKey: getListPurchaseOrdersQueryKey() });
        if (vars?.id) qc.invalidateQueries({ queryKey: getGetPurchaseOrderQueryKey(vars.id) });
        router.back();
      },
      onError: (e: unknown) => Alert.alert("Could not save", (e as Error).message ?? ""),
    },
  });

  const submit = () => {
    if (!form.supplierId) return Alert.alert("Pick a supplier");
    if (items.length === 0) return Alert.alert("Add at least one line item");
    const payload: CreatePurchaseOrderBody = {
      ...form,
      subtotal: totals.subtotal,
      vatAmount: totals.vat,
      total: totals.grand,
      items: items.map(({ key: _key, ...rest }) => ({
        ...rest,
        quantity: Number(rest.quantity || 0),
        unitPrice: Number(rest.unitPrice ?? 0),
        amount: Number(rest.unitPrice ?? 0) * Number(rest.quantity ?? 0),
      })),
    };
    if (initial) update.mutate({ id: initial.id, data: payload });
    else create.mutate({ data: payload });
  };
  const busy = create.isPending || update.isPending;

  const supplierOpts = (suppliers.data ?? []).map(s => ({ value: String(s.id), label: s.name }));
  const prOpts = [{ value: "", label: "No PR link" }, ...((prs.data ?? []).map(p => ({ value: String(p.id), label: p.prNumber })))];

  return (
    <View style={{ gap: 12 }}>
      <SectionHeading title="Purchase order" />
      <Select label="Supplier *" value={form.supplierId ? String(form.supplierId) : ""} options={supplierOpts}
        onChange={v => upd({ supplierId: Number(v) })} />
      <Select label="From PR" value={form.purchaseRequestId ? String(form.purchaseRequestId) : ""} options={prOpts}
        onChange={v => upd({ purchaseRequestId: v ? Number(v) : undefined })} />
      <FormRow>
        <FormCell><BrandInput label="Delivery date (YYYY-MM-DD)" icon="calendar" value={form.deliveryDate ?? ""} onChangeText={v => upd({ deliveryDate: v })} /></FormCell>
        <FormCell><BrandInput label="Payment terms" value={form.paymentTerms ?? ""} onChangeText={v => upd({ paymentTerms: v })} /></FormCell>
      </FormRow>

      <SectionHeading title={`Items (${items.length})`} action={
        <Pressable onPress={() => setItems(p => [...p, newItem()])}><Text style={{ color: c.primary, fontFamily: "Inter_600SemiBold" }}>+ Add</Text></Pressable>
      } />
      {items.map((it, idx) => (
        <Card key={it.key}>
          <View style={styles.row}>
            <Text style={[styles.itemIdx, { color: c.mutedForeground }]}>#{idx + 1}</Text>
            <Pressable onPress={() => removeItem(it.key)} hitSlop={10}><Feather name="x" size={16} color={c.destructive} /></Pressable>
          </View>
          <BrandInput label="Item name" value={it.itemName} onChangeText={v => updItem(it.key, { itemName: v })} />
          <FormRow>
            <FormCell><BrandInput label="Qty" keyboardType="numeric" value={String(it.quantity ?? "")} onChangeText={v => updItem(it.key, { quantity: Number(v) || 0 })} /></FormCell>
            <FormCell><BrandInput label="Unit" value={it.unit} onChangeText={v => updItem(it.key, { unit: v })} /></FormCell>
            <FormCell><BrandInput label="Unit price" keyboardType="numeric" value={String(it.unitPrice ?? 0)} onChangeText={v => updItem(it.key, { unitPrice: Number(v) || 0 })} /></FormCell>
          </FormRow>
          <Text style={[styles.lineTotal, { color: c.primary }]}>
            Line: {fmtAed(Number(it.unitPrice ?? 0) * Number(it.quantity ?? 0))}
          </Text>
        </Card>
      ))}

      <Card style={{ backgroundColor: c.secondary }}>
        <View style={styles.totalRow}><Text style={{ color: c.foreground }}>Subtotal</Text><Text style={[styles.totalText, { color: c.foreground }]}>{fmtAed(totals.subtotal)}</Text></View>
        <FormRow>
          <FormCell><Text style={[styles.totalText, { color: c.foreground, marginTop: 14 }]}>VAT %</Text></FormCell>
          <FormCell><BrandInput label="VAT %" keyboardType="numeric" value={String(vatPct)} onChangeText={v => setVatPct(Number(v) || 0)} /></FormCell>
        </FormRow>
        <View style={styles.totalRow}><Text style={{ color: c.foreground }}>VAT</Text><Text style={[styles.totalText, { color: c.foreground }]}>{fmtAed(totals.vat)}</Text></View>
        <View style={styles.totalRow}><Text style={[styles.grand, { color: c.navy }]}>Total</Text><Text style={[styles.grand, { color: c.navy }]}>{fmtAed(totals.grand)}</Text></View>
      </Card>

      <BrandButton label={initial ? "Save changes" : "Create PO"} icon="check" loading={busy} onPress={submit} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  itemIdx: { fontFamily: "Inter_700Bold", fontSize: 13 },
  lineTotal: { fontFamily: "Inter_700Bold", fontSize: 14, textAlign: "right", marginTop: 4 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
  totalText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  grand: { fontFamily: "Inter_700Bold", fontSize: 16 },
});
