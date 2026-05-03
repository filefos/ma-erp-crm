import React, { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  type CreateSupplierQuotationBody, type CreateSupplierQuotationBodyItemsItem, type SupplierQuotation,
  getGetSupplierQuotationQueryKey, getListSupplierQuotationsQueryKey,
  useCreateSupplierQuotation, useListRfqs, useListSuppliers, useUpdateSupplierQuotation,
} from "@workspace/api-client-react";
import { BrandButton, BrandInput, Card, SectionHeading } from "@/components/ui";
import { FormCell, FormRow, Select } from "@/components/forms";
import { fmtAed } from "@/lib/format";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

interface Props { initial?: SupplierQuotation | null; sourceRfqId?: number; sourceSupplierId?: number }

interface DraftItem extends CreateSupplierQuotationBodyItemsItem { key: string }
function newItem(): DraftItem {
  return { key: Math.random().toString(36).slice(2), itemName: "", quantity: 1, unit: "nos", unitPrice: 0, vat: 0, total: 0 };
}

export function SqForm({ initial, sourceRfqId, sourceSupplierId }: Props) {
  const c = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const { activeCompanyId } = useApp();
  const suppliers = useListSuppliers();
  const rfqs = useListRfqs();

  const [form, setForm] = useState<CreateSupplierQuotationBody>(() => ({
    companyId: initial?.companyId ?? activeCompanyId ?? 1,
    rfqId: initial?.rfqId ?? sourceRfqId,
    supplierId: initial?.supplierId ?? sourceSupplierId ?? 0,
    supplierQuotationRef: initial?.supplierQuotationRef ?? "",
    quotationDate: initial?.quotationDate ?? "",
    deliveryTime: initial?.deliveryTime ?? "",
    paymentTerms: initial?.paymentTerms ?? "",
    warranty: initial?.warranty ?? "",
    notes: initial?.notes ?? "",
    attachmentUrl: initial?.attachmentUrl ?? "",
  }));
  const [items, setItems] = useState<DraftItem[]>(() => {
    const seeded = (initial?.items ?? []).map((it, i) => ({
      key: `${i}-${Math.random()}`,
      itemName: it.itemName, quantity: Number(it.quantity), unit: it.unit,
      unitPrice: Number(it.unitPrice ?? 0), vat: Number(it.vat ?? 0), total: Number(it.total ?? 0),
    }));
    return seeded.length ? seeded : [newItem()];
  });

  // Auto-fill items from RFQ
  const linkRfq = (rfqId: number) => {
    setForm(f => ({ ...f, rfqId }));
    const src = (rfqs.data ?? []).find(r => r.id === rfqId);
    if (src && src.items?.length) {
      setItems(src.items.map((it, i) => ({
        key: `${i}-${Math.random()}`,
        itemName: it.itemName, quantity: Number(it.quantity), unit: it.unit,
        unitPrice: 0, vat: 0, total: 0,
      })));
    }
  };

  const upd = (p: Partial<CreateSupplierQuotationBody>) => setForm(f => ({ ...f, ...p }));
  const updItem = (key: string, p: Partial<DraftItem>) => setItems(prev => prev.map(it => it.key === key ? { ...it, ...p } : it));
  const removeItem = (key: string) => setItems(prev => prev.filter(it => it.key !== key));

  const totals = useMemo(() => {
    const subtotal = items.reduce((s, i) => s + Number(i.unitPrice ?? 0) * Number(i.quantity ?? 0), 0);
    const vat = items.reduce((s, i) => s + Number(i.vat ?? 0), 0);
    return { subtotal, vat, grand: subtotal + vat };
  }, [items]);

  const create = useCreateSupplierQuotation({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListSupplierQuotationsQueryKey() }); router.back(); },
      onError: (e: unknown) => Alert.alert("Could not save", (e as Error).message ?? ""),
    },
  });
  const update = useUpdateSupplierQuotation({
    mutation: {
      onSuccess: (_d, vars) => {
        qc.invalidateQueries({ queryKey: getListSupplierQuotationsQueryKey() });
        if (vars?.id) qc.invalidateQueries({ queryKey: getGetSupplierQuotationQueryKey(vars.id) });
        router.back();
      },
      onError: (e: unknown) => Alert.alert("Could not save", (e as Error).message ?? ""),
    },
  });

  const submit = () => {
    if (!form.supplierId) return Alert.alert("Pick a supplier");
    if (items.length === 0) return Alert.alert("Add at least one line item");
    const payload: CreateSupplierQuotationBody = {
      ...form,
      items: items.map(({ key: _key, ...rest }) => ({
        ...rest,
        quantity: Number(rest.quantity || 0),
        unitPrice: Number(rest.unitPrice ?? 0),
        vat: Number(rest.vat ?? 0),
        total: Number(rest.unitPrice ?? 0) * Number(rest.quantity ?? 0) + Number(rest.vat ?? 0),
      })),
    };
    if (initial) update.mutate({ id: initial.id, data: payload });
    else create.mutate({ data: payload });
  };
  const busy = create.isPending || update.isPending;

  const supplierOpts = (suppliers.data ?? []).map(s => ({ value: String(s.id), label: s.name, hint: s.contactPerson ?? "" }));
  const rfqOpts = [{ value: "", label: "No RFQ link" }, ...((rfqs.data ?? []).map(r => ({ value: String(r.id), label: r.rfqNumber, hint: r.prNumber ?? "" })))];

  return (
    <View style={{ gap: 12 }}>
      <SectionHeading title="Source" />
      <Select label="From RFQ" value={form.rfqId ? String(form.rfqId) : ""} options={rfqOpts}
        onChange={v => v ? linkRfq(Number(v)) : upd({ rfqId: undefined })} />
      <Select label="Supplier *" value={form.supplierId ? String(form.supplierId) : ""} options={supplierOpts}
        onChange={v => upd({ supplierId: Number(v) })} />
      <FormRow>
        <FormCell><BrandInput label="Supplier ref" value={form.supplierQuotationRef ?? ""} onChangeText={v => upd({ supplierQuotationRef: v })} /></FormCell>
        <FormCell><BrandInput label="Quotation date" icon="calendar" value={form.quotationDate ?? ""} onChangeText={v => upd({ quotationDate: v })} /></FormCell>
      </FormRow>
      <FormRow>
        <FormCell><BrandInput label="Delivery time" value={form.deliveryTime ?? ""} onChangeText={v => upd({ deliveryTime: v })} /></FormCell>
        <FormCell><BrandInput label="Warranty" value={form.warranty ?? ""} onChangeText={v => upd({ warranty: v })} /></FormCell>
      </FormRow>
      <BrandInput label="Payment terms" value={form.paymentTerms ?? ""} onChangeText={v => upd({ paymentTerms: v })} />

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
          </FormRow>
          <FormRow>
            <FormCell><BrandInput label="Unit price (AED)" keyboardType="numeric" value={String(it.unitPrice ?? 0)} onChangeText={v => updItem(it.key, { unitPrice: Number(v) || 0 })} /></FormCell>
            <FormCell><BrandInput label="VAT (AED)" keyboardType="numeric" value={String(it.vat ?? 0)} onChangeText={v => updItem(it.key, { vat: Number(v) || 0 })} /></FormCell>
          </FormRow>
          <Text style={[styles.lineTotal, { color: c.primary }]}>
            Line: {fmtAed(Number(it.unitPrice ?? 0) * Number(it.quantity ?? 0) + Number(it.vat ?? 0))}
          </Text>
        </Card>
      ))}

      <Card style={{ backgroundColor: c.secondary }}>
        <View style={styles.totalRow}><Text style={{ color: c.foreground }}>Subtotal</Text><Text style={[styles.totalText, { color: c.foreground }]}>{fmtAed(totals.subtotal)}</Text></View>
        <View style={styles.totalRow}><Text style={{ color: c.foreground }}>VAT</Text><Text style={[styles.totalText, { color: c.foreground }]}>{fmtAed(totals.vat)}</Text></View>
        <View style={styles.totalRow}><Text style={[styles.grand, { color: c.navy }]}>Total</Text><Text style={[styles.grand, { color: c.navy }]}>{fmtAed(totals.grand)}</Text></View>
      </Card>

      <BrandInput label="Notes" multiline value={form.notes ?? ""} onChangeText={v => upd({ notes: v })} style={{ minHeight: 60, textAlignVertical: "top" }} />
      <BrandInput label="Attachment URL" autoCapitalize="none" value={form.attachmentUrl ?? ""} onChangeText={v => upd({ attachmentUrl: v })} />

      <BrandButton label={initial ? "Save changes" : "Create quotation"} icon="check" loading={busy} onPress={submit} />
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
