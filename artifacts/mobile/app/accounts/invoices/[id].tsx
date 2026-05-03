import React, { useState } from "react";
import { Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetTaxInvoiceQueryKey,
  getListPaymentsReceivedQueryKey,
  getListTaxInvoicesQueryKey,
  useCreatePaymentReceived,
  useGetQuotation,
  useGetTaxInvoice,
  useListPaymentsReceived,
  useUpdateTaxInvoice,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, BrandInput, Card, ErrorBlock, LoadingBlock, SectionHeading } from "@/components/ui";
import { FormCell, FormRow, Select, StatusPill } from "@/components/forms";
import { PAYMENT_METHODS, fmtAed, fmtDate, num, paymentMethodLabel, paymentStatusMeta } from "@/lib/format";

export default function InvoiceDetail() {
  const c = useColors();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const iid = Number(id);
  const q = useGetTaxInvoice(iid);
  const [editOpen, setEditOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);

  const update = useUpdateTaxInvoice({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetTaxInvoiceQueryKey(iid) });
        qc.invalidateQueries({ queryKey: getListTaxInvoicesQueryKey() });
      },
      onError: (e: unknown) => Alert.alert("Update failed", (e as Error).message ?? ""),
    },
  });

  const recordPay = useCreatePaymentReceived({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListPaymentsReceivedQueryKey() });
      },
      onError: (e: unknown) => Alert.alert("Payment record failed", (e as Error).message ?? ""),
    },
  });

  const quotationId = q.data?.quotationId ?? 0;
  const quotation = useGetQuotation(quotationId as number, { query: { queryKey: ["/quotations/:id", quotationId] as const, enabled: !!quotationId } });
  const paymentsList = useListPaymentsReceived({ companyId: q.data?.companyId });

  if (q.isLoading) return <View style={[styles.flex, { backgroundColor: c.background }]}><AppHeader title="Invoice" /><LoadingBlock /></View>;
  if (q.error || !q.data) return <View style={[styles.flex, { backgroundColor: c.background }]}><AppHeader title="Invoice" /><ErrorBlock message={(q.error as Error)?.message ?? "Not found"} onRetry={() => q.refetch()} /></View>;

  const i = q.data;
  const sm = paymentStatusMeta(i.paymentStatus);
  const balance = num(i.grandTotal) - num(i.amountPaid);
  const items = (quotation.data?.items ?? []) as { description: string; quantity: number; unit?: string; amount?: number; rate?: number }[];
  const payments = (paymentsList.data ?? []).filter(p => p.taxInvoiceId === i.id || p.invoiceRef === i.invoiceNumber);

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title={i.invoiceNumber} subtitle={i.clientName} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primary} />}
      >
        <Card>
          <View style={styles.row}>
            <StatusPill label={sm.label} tone={sm.tone} />
            {i.invoiceDate ? <Text style={[styles.meta, { color: c.mutedForeground }]}>Issued {fmtDate(i.invoiceDate)}</Text> : null}
          </View>
          {i.clientTrn ? <Text style={[styles.body, { color: c.foreground }]}>TRN: {i.clientTrn}</Text> : null}
          <Text style={[styles.amount, { color: c.primary }]}>{fmtAed(i.grandTotal)}</Text>
          <View style={styles.row}>
            <Text style={[styles.meta, { color: c.mutedForeground }]}>Subtotal {fmtAed(i.subtotal)}</Text>
            <Text style={[styles.meta, { color: c.mutedForeground }]}>· VAT {fmtAed(i.vatAmount)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={[styles.meta, { color: c.foreground }]}>Paid {fmtAed(i.amountPaid)}</Text>
            <Text style={[styles.meta, { color: balance > 0 ? c.accent : c.success }]}>· Balance {fmtAed(balance)}</Text>
          </View>
        </Card>

        <View style={styles.row}>
          <BrandButton label="Record payment" icon="dollar-sign" onPress={() => setPayOpen(true)} style={{ flex: 1 }} />
          <BrandButton label="Edit" icon="edit-2" variant="secondary" onPress={() => setEditOpen(true)} style={{ flex: 1 }} />
        </View>

        <SectionHeading title="Details" />
        <Card>
          <Text style={[styles.body, { color: c.foreground }]}>VAT %: {i.vatPercent ?? 5}</Text>
          {i.supplyDate ? <Text style={[styles.body, { color: c.foreground }]}>Supply date: {fmtDate(i.supplyDate)}</Text> : null}
          {i.dueDate ? <Text style={[styles.body, { color: c.foreground }]}>Due: {fmtDate(i.dueDate)}</Text> : null}
        </Card>

        {items.length ? (
          <>
            <SectionHeading title="Line items" />
            {items.map((it, idx) => (
              <Card key={idx}>
                <Text style={[styles.body, { color: c.foreground }]} numberOfLines={2}>{it.description}</Text>
                <View style={styles.row}>
                  <Text style={[styles.meta, { color: c.mutedForeground }]}>Qty {it.quantity}{it.unit ? ` ${it.unit}` : ""}</Text>
                  {it.rate != null ? <Text style={[styles.meta, { color: c.mutedForeground }]}>· Rate {fmtAed(it.rate)}</Text> : null}
                  {it.amount != null ? <Text style={[styles.meta, { color: c.primary }]}>· {fmtAed(it.amount)}</Text> : null}
                </View>
              </Card>
            ))}
          </>
        ) : null}

        <SectionHeading title="Payment history" />
        {payments.length === 0 ? (
          <Card><Text style={[styles.meta, { color: c.mutedForeground }]}>No payments recorded yet.</Text></Card>
        ) : payments.map(p => (
          <Card key={p.id}>
            <View style={styles.row}>
              <Text style={[styles.body, { color: c.foreground, flex: 1 }]} numberOfLines={1}>{p.paymentNumber}</Text>
              <Text style={[styles.amount, { color: c.success, fontSize: 14 }]}>{fmtAed(p.amount)}</Text>
            </View>
            <Text style={[styles.meta, { color: c.mutedForeground }]}>{fmtDate(p.paymentDate)} · {paymentMethodLabel(p.paymentMethod)}{p.referenceNumber ? ` · ${p.referenceNumber}` : ""}</Text>
          </Card>
        ))}
      </ScrollView>

      <EditModal
        visible={editOpen}
        onClose={() => setEditOpen(false)}
        invoice={i}
        loading={update.isPending}
        onSave={(data) => update.mutate({ id: iid, data }, { onSuccess: () => setEditOpen(false) })}
      />
      <RecordPaymentModal
        visible={payOpen}
        onClose={() => setPayOpen(false)}
        invoice={i}
        loading={recordPay.isPending || update.isPending}
        onSave={async ({ amount, paymentDate, paymentMethod, referenceNumber, notes }) => {
          const newPaid = Math.min(num(i.grandTotal), num(i.amountPaid) + amount);
          const newStatus = newPaid <= 0 ? "unpaid" : newPaid >= num(i.grandTotal) ? "paid" : "partial";
          // 1. update invoice
          await new Promise<void>((resolve) => {
            update.mutate({ id: iid, data: {
              companyId: i.companyId, clientName: i.clientName, clientTrn: i.clientTrn,
              invoiceDate: i.invoiceDate, supplyDate: i.supplyDate, quotationId: i.quotationId, projectId: i.projectId,
              subtotal: i.subtotal, vatPercent: i.vatPercent, vatAmount: i.vatAmount, grandTotal: i.grandTotal,
              paymentStatus: newStatus,
            } }, { onSuccess: () => resolve(), onError: () => resolve() });
          });
          // 2. create payment received
          recordPay.mutate({
            data: {
              companyId: i.companyId,
              customerName: i.clientName,
              invoiceRef: i.invoiceNumber,
              taxInvoiceId: i.id,
              paymentDate,
              amount,
              paymentMethod,
              referenceNumber,
              notes,
              status: "received",
            },
          }, { onSuccess: () => setPayOpen(false) });
        }}
      />
    </View>
  );
}

interface EditFormData { clientName: string; clientTrn?: string; invoiceDate?: string; subtotal?: number; vatPercent?: number; vatAmount?: number; grandTotal: number; paymentStatus: string; companyId: number; quotationId?: number; projectId?: number; supplyDate?: string }
function EditModal({ visible, onClose, invoice, loading, onSave }: { visible: boolean; onClose: () => void; invoice: { id: number; companyId: number; clientName: string; clientTrn?: string; invoiceDate?: string; supplyDate?: string; quotationId?: number; projectId?: number; subtotal?: number; vatPercent?: number; vatAmount?: number; grandTotal: number; paymentStatus: string }; loading: boolean; onSave: (data: EditFormData) => void }) {
  const c = useColors();
  const [form, setForm] = useState<EditFormData>({
    clientName: invoice.clientName, clientTrn: invoice.clientTrn ?? "", invoiceDate: invoice.invoiceDate ?? "",
    supplyDate: invoice.supplyDate ?? "",
    subtotal: invoice.subtotal ?? 0, vatPercent: invoice.vatPercent ?? 5, vatAmount: invoice.vatAmount ?? 0,
    grandTotal: invoice.grandTotal, paymentStatus: invoice.paymentStatus,
    companyId: invoice.companyId, quotationId: invoice.quotationId, projectId: invoice.projectId,
  });
  const upd = (p: Partial<EditFormData>) => setForm(f => ({ ...f, ...p }));
  const recalc = () => {
    const sub = Number(form.subtotal) || 0;
    const pct = Number(form.vatPercent) || 0;
    const vat = Math.round(sub * pct) / 100;
    const grand = Math.round((sub + vat) * 100) / 100;
    upd({ vatAmount: vat, grandTotal: grand });
  };
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="formSheet">
      <View style={[styles.flex, { backgroundColor: c.background }]}>
        <AppHeader title="Edit invoice" />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <BrandInput label="Client name" value={form.clientName} onChangeText={v => upd({ clientName: v })} />
          <BrandInput label="Client TRN" value={form.clientTrn ?? ""} onChangeText={v => upd({ clientTrn: v })} />
          <FormRow>
            <FormCell><BrandInput label="Invoice date" value={form.invoiceDate ?? ""} onChangeText={v => upd({ invoiceDate: v })} /></FormCell>
            <FormCell><BrandInput label="Supply date" value={form.supplyDate ?? ""} onChangeText={v => upd({ supplyDate: v })} /></FormCell>
          </FormRow>
          <FormRow>
            <FormCell><BrandInput label="Subtotal" keyboardType="numeric" value={String(form.subtotal ?? 0)} onChangeText={v => upd({ subtotal: Number(v) || 0 })} onBlur={recalc} /></FormCell>
            <FormCell><BrandInput label="VAT %" keyboardType="numeric" value={String(form.vatPercent ?? 5)} onChangeText={v => upd({ vatPercent: Number(v) || 0 })} onBlur={recalc} /></FormCell>
          </FormRow>
          <BrandInput label="VAT amount" keyboardType="numeric" value={String(form.vatAmount ?? 0)} onChangeText={v => upd({ vatAmount: Number(v) || 0 })} />
          <BrandInput label="Grand total" keyboardType="numeric" value={String(form.grandTotal)} onChangeText={v => upd({ grandTotal: Number(v) || 0 })} />
          <View style={styles.row}>
            <BrandButton label="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
            <BrandButton label="Save" loading={loading} onPress={() => onSave(form)} style={{ flex: 1 }} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

interface PaymentInput { amount: number; paymentDate: string; paymentMethod: string; referenceNumber?: string; notes?: string }
function RecordPaymentModal({ visible, onClose, invoice, loading, onSave }: { visible: boolean; onClose: () => void; invoice: { grandTotal: number; amountPaid?: number }; loading: boolean; onSave: (p: PaymentInput) => void }) {
  const c = useColors();
  const balance = num(invoice.grandTotal) - num(invoice.amountPaid);
  const [form, setForm] = useState<PaymentInput>({
    amount: balance > 0 ? balance : 0,
    paymentDate: new Date().toISOString().slice(0, 10),
    paymentMethod: "bank_transfer",
    referenceNumber: "",
    notes: "",
  });
  const upd = (p: Partial<PaymentInput>) => setForm(f => ({ ...f, ...p }));
  const submit = () => {
    if (!Number.isFinite(form.amount) || form.amount <= 0) return Alert.alert("Amount must be greater than zero");
    onSave(form);
  };
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="formSheet">
      <View style={[styles.flex, { backgroundColor: c.background }]}>
        <AppHeader title="Record payment" subtitle={`Balance: ${fmtAed(balance)}`} />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <BrandInput label="Amount (AED) *" keyboardType="numeric" value={String(form.amount)} onChangeText={v => upd({ amount: Number(v) || 0 })} />
          <BrandInput label="Payment date *" value={form.paymentDate} onChangeText={v => upd({ paymentDate: v })} />
          <Select label="Method *" value={form.paymentMethod} options={PAYMENT_METHODS} onChange={v => upd({ paymentMethod: v })} />
          <Pressable style={{ display: "none" }} accessible={false}><Text>{paymentMethodLabel(form.paymentMethod)}</Text></Pressable>
          <BrandInput label="Reference" value={form.referenceNumber ?? ""} onChangeText={v => upd({ referenceNumber: v })} />
          <BrandInput label="Notes" multiline value={form.notes ?? ""} onChangeText={v => upd({ notes: v })} style={{ minHeight: 60, textAlignVertical: "top" }} />
          <View style={styles.row}>
            <BrandButton label="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
            <BrandButton label="Record" loading={loading} onPress={submit} style={{ flex: 1 }} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 120 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  body: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  meta: { fontFamily: "Inter_500Medium", fontSize: 12 },
  amount: { fontFamily: "Inter_700Bold", fontSize: 22 },
});
