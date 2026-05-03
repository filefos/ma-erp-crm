import React, { useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  type LpoAttachment,
  getGetLpoQueryKey, getListLposQueryKey,
  useGetLpo, useUpdateLpo,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, Card, ErrorBlock, LoadingBlock, SectionHeading } from "@/components/ui";
import { ActionSheet, StatusPill } from "@/components/forms";
import { DocumentWebView } from "@/components/DocumentWebView";
import { LPO_STATUSES, fmtAed, fmtDate, lpoStatusMeta } from "@/lib/format";
import { lpoHtml } from "@/lib/document-html";
import { captureImageFromCamera, pickDocument, pickImageFromLibrary } from "@/lib/attachments";

export default function LpoDetail() {
  const c = useColors();
  const qc = useQueryClient();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const lid = Number(id);
  const q = useGetLpo(lid);
  const [statusOpen, setStatusOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<{ title: string; html: string } | null>(null);
  const [attaching, setAttaching] = useState(false);

  const update = useUpdateLpo({
    mutation: {
      onMutate: async (vars) => {
        await qc.cancelQueries({ queryKey: getGetLpoQueryKey(lid) });
        const prev = qc.getQueryData(getGetLpoQueryKey(lid));
        qc.setQueryData(getGetLpoQueryKey(lid), (old: unknown) => ({ ...(old as object ?? {}), ...vars.data }));
        return { prev };
      },
      onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(getGetLpoQueryKey(lid), ctx.prev); Alert.alert("Update failed"); },
      onSettled: () => {
        qc.invalidateQueries({ queryKey: getGetLpoQueryKey(lid) });
        qc.invalidateQueries({ queryKey: getListLposQueryKey() });
      },
    },
  });

  if (q.isLoading) return <View style={[styles.flex, { backgroundColor: c.background }]}><AppHeader title="LPO" /><LoadingBlock /></View>;
  if (q.error || !q.data) return <View style={[styles.flex, { backgroundColor: c.background }]}><AppHeader title="LPO" /><ErrorBlock message={(q.error as Error)?.message ?? "Not found"} onRetry={() => q.refetch()} /></View>;

  const l = q.data;
  const sm = lpoStatusMeta(l.status);

  const baseBody = (overrides: { status?: string; attachments?: LpoAttachment[] } = {}) => ({
    companyId: l.companyId, clientName: l.clientName, projectRef: l.projectRef,
    projectId: l.projectId, quotationId: l.quotationId, lpoDate: l.lpoDate,
    lpoValue: l.lpoValue, scope: l.scope, deliverySchedule: l.deliverySchedule,
    paymentTerms: l.paymentTerms, notes: l.notes,
    status: overrides.status ?? l.status,
    attachments: overrides.attachments ?? l.attachments?.map(a => ({ filename: a.filename, contentType: a.contentType, size: a.size })),
  });

  const changeStatus = (status: string) => {
    update.mutate({ id: lid, data: baseBody({ status }) });
  };

  const addAttachment = async (picker: () => Promise<LpoAttachment | null>) => {
    setAttaching(true);
    try {
      const a = await picker();
      if (!a) return;
      const existing = (l.attachments ?? []).map(x => ({ filename: x.filename, contentType: x.contentType, size: x.size }));
      await update.mutateAsync({ id: lid, data: baseBody({ attachments: [...existing, a] }) });
    } catch (e) {
      Alert.alert("Could not attach file", (e as Error).message ?? "");
    } finally {
      setAttaching(false);
    }
  };

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title={l.lpoNumber} subtitle={l.clientName} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primary} />}
      >
        <Card>
          <View style={styles.row}>
            <StatusPill label={sm.label} tone={sm.tone} />
            {l.lpoDate ? <Text style={[styles.meta, { color: c.mutedForeground }]}>Issued {fmtDate(l.lpoDate)}</Text> : null}
          </View>
          {l.projectRef ? <Text style={[styles.body, { color: c.foreground }]}>Ref: {l.projectRef}</Text> : null}
          <Text style={[styles.amount, { color: c.primary }]}>{fmtAed(l.lpoValue)}</Text>
        </Card>

        <View style={styles.row}>
          <BrandButton label="View PDF" icon="file-text" variant="secondary" onPress={() => setPdfOpen(true)} style={{ flex: 1 }} />
          <BrandButton label="Status" icon="repeat" onPress={() => setStatusOpen(true)} style={{ flex: 1 }} />
        </View>

        {l.quotationId ? (
          <BrandButton
            label={`View linked quotation #${l.quotationId}`}
            icon="external-link"
            variant="ghost"
            onPress={() => router.push({ pathname: "/sales/quotations/[id]", params: { id: String(l.quotationId) } })}
          />
        ) : null}

        {l.scope ? <><SectionHeading title="Scope" /><Card><Text style={[styles.body, { color: c.foreground }]}>{l.scope}</Text></Card></> : null}
        {l.deliverySchedule ? <><SectionHeading title="Delivery schedule" /><Card><Text style={[styles.body, { color: c.foreground }]}>{l.deliverySchedule}</Text></Card></> : null}
        {l.paymentTerms ? <><SectionHeading title="Payment terms" /><Card><Text style={[styles.body, { color: c.foreground }]}>{l.paymentTerms}</Text></Card></> : null}
        {l.notes ? <><SectionHeading title="Notes" /><Card><Text style={[styles.body, { color: c.foreground }]}>{l.notes}</Text></Card></> : null}

        <SectionHeading title={`Attachments (${l.attachments?.length ?? 0})`} />
        <Card>
          <Text style={[styles.cardLabel, { color: c.mutedForeground }]}>Add a file</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <BrandButton label="Camera" icon="camera" variant="secondary" onPress={() => addAttachment(captureImageFromCamera)} loading={attaching} style={{ flex: 1 }} />
            <BrandButton label="Photo" icon="image" variant="secondary" onPress={() => addAttachment(pickImageFromLibrary)} loading={attaching} style={{ flex: 1 }} />
            <BrandButton label="File" icon="file" variant="secondary" onPress={() => addAttachment(pickDocument)} loading={attaching} style={{ flex: 1 }} />
          </View>
        </Card>

        {(l.attachments ?? []).length ? (
          <>
            {(l.attachments ?? []).map((a, i) => {
              const dataUrl = a.content
                ? `data:${a.contentType ?? "application/octet-stream"};base64,${a.content}`
                : null;
              const onTap = () => {
                const ct = (a.contentType ?? "").toLowerCase();
                if (!dataUrl) {
                  Alert.alert(a.filename ?? "Attachment", "This file is stored on the server. Open it from the web app to view its contents.");
                  return;
                }
                if (ct.startsWith("image/")) {
                  setPreviewHtml({
                    title: a.filename ?? "Attachment",
                    html: `<!doctype html><html><body style="margin:0;background:#0f172a;display:flex;align-items:center;justify-content:center;min-height:100vh"><img src="${dataUrl}" style="max-width:100%;max-height:100vh;object-fit:contain"/></body></html>`,
                  });
                } else if (ct === "application/pdf" || ct.includes("html") || ct.includes("text")) {
                  setPreviewHtml({
                    title: a.filename ?? "Attachment",
                    html: `<!doctype html><html><body style="margin:0"><iframe src="${dataUrl}" style="border:0;width:100vw;height:100vh"></iframe></body></html>`,
                  });
                } else {
                  Alert.alert(a.filename ?? "Attachment", `${a.contentType ?? "Unknown type"} — preview not supported on device.`);
                }
              };
              return (
                <Pressable key={`${a.filename ?? "file"}-${i}`} onPress={onTap}>
                  <Card>
                    <View style={styles.row}>
                      <Feather name="paperclip" size={14} color={c.primary} />
                      <Text style={[styles.body, { color: c.foreground, flex: 1 }]} numberOfLines={1}>{a.filename ?? "file"}</Text>
                      <Text style={[styles.meta, { color: c.mutedForeground }]}>{a.size ? `${Math.round(a.size / 1024)} KB` : ""}</Text>
                      <Feather name="chevron-right" size={16} color={c.mutedForeground} />
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          </>
        ) : null}
      </ScrollView>

      <ActionSheet
        visible={statusOpen} onClose={() => setStatusOpen(false)}
        title="Change status"
        actions={LPO_STATUSES.map(s => ({ label: s.label, icon: "tag", onPress: () => changeStatus(s.value) }))}
      />
      <DocumentWebView visible={pdfOpen} onClose={() => setPdfOpen(false)} title={l.lpoNumber} html={lpoHtml(l)} />
      <DocumentWebView
        visible={!!previewHtml}
        onClose={() => setPreviewHtml(null)}
        title={previewHtml?.title ?? "Attachment"}
        html={previewHtml?.html ?? ""}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 120 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  body: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  meta: { fontFamily: "Inter_500Medium", fontSize: 12 },
  amount: { fontFamily: "Inter_700Bold", fontSize: 18 },
  cardLabel: { fontFamily: "Inter_500Medium", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 },
});
