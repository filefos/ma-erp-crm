import React, { useState } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetProjectQueryKey, getListProjectsQueryKey,
  useGetProject, useUpdateProject,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, Card, ErrorBlock, LoadingBlock, SectionHeading } from "@/components/ui";
import { ActionSheet, StatusPill } from "@/components/forms";
import { PROJECT_STAGES, fmtAed, fmtDate, pipelineStatusMeta, PIPELINE_STATUSES, PAYMENT_PIPELINE_STATUSES, projectStageMeta } from "@/lib/format";
import { useApp } from "@/contexts/AppContext";
import { canManageProjects } from "@/lib/permissions";

type PipelineKey = "productionStatus" | "procurementStatus" | "deliveryStatus" | "installationStatus" | "paymentStatus";

const PIPELINE_LABELS: { key: PipelineKey; label: string }[] = [
  { key: "productionStatus",   label: "Production" },
  { key: "procurementStatus",  label: "Procurement" },
  { key: "deliveryStatus",     label: "Delivery" },
  { key: "installationStatus", label: "Installation" },
  { key: "paymentStatus",      label: "Payment" },
];

export default function ProjectDetail() {
  const c = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useApp();
  const canManage = canManageProjects(user);
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = Number(id);
  const project = useGetProject(projectId);
  const [stageOpen, setStageOpen] = useState(false);
  const [pipelineOpen, setPipelineOpen] = useState<PipelineKey | null>(null);

  const update = useUpdateProject({
    mutation: {
      onMutate: async (vars) => {
        await qc.cancelQueries({ queryKey: getGetProjectQueryKey(projectId) });
        const prev = qc.getQueryData(getGetProjectQueryKey(projectId));
        qc.setQueryData(getGetProjectQueryKey(projectId), (old: unknown) => ({ ...(old as object ?? {}), ...vars.data }));
        return { prev };
      },
      onError: (_e, _v, ctx) => {
        if (ctx?.prev) qc.setQueryData(getGetProjectQueryKey(projectId), ctx.prev);
        Alert.alert("Could not update project");
      },
      onSettled: () => {
        qc.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
        qc.invalidateQueries({ queryKey: getListProjectsQueryKey() });
      },
    },
  });

  if (project.isLoading) {
    return (
      <View style={[styles.flex, { backgroundColor: c.background }]}>
        <AppHeader title="Project" />
        <LoadingBlock />
      </View>
    );
  }
  if (project.error || !project.data) {
    return (
      <View style={[styles.flex, { backgroundColor: c.background }]}>
        <AppHeader title="Project" />
        <ErrorBlock message={(project.error as Error)?.message ?? "Project not found"} onRetry={() => project.refetch()} />
      </View>
    );
  }

  const p = project.data;
  const sm = projectStageMeta(p.stage);

  const baseUpdate = (extra: Record<string, unknown>) => ({
    id: projectId,
    data: {
      projectName: p.projectName, clientName: p.clientName, companyId: p.companyId ?? 1,
      location: p.location, scope: p.scope, projectValue: p.projectValue, stage: p.stage,
      productionStatus: p.productionStatus, procurementStatus: p.procurementStatus,
      deliveryStatus: p.deliveryStatus, installationStatus: p.installationStatus,
      paymentStatus: p.paymentStatus, projectManagerId: p.projectManagerId,
      salespersonId: p.salespersonId, startDate: p.startDate, endDate: p.endDate,
      deliveryDate: p.deliveryDate,
      ...extra,
    },
  });

  const setStage = (stage: string) => update.mutate(baseUpdate({ stage }));
  const setPipeline = (key: PipelineKey, value: string) => update.mutate(baseUpdate({ [key]: value }));

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title={p.projectName} subtitle={p.projectNumber} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={project.isRefetching} onRefresh={() => project.refetch()} tintColor={c.primary} />}
      >
        <Card>
          <View style={styles.row}>
            <StatusPill label={sm.label} tone={sm.tone} />
            <Text style={[styles.body, { color: c.primary, marginLeft: "auto" }]}>{fmtAed(p.projectValue ?? 0)}</Text>
          </View>
          <Text style={[styles.body, { color: c.foreground }]}>{p.clientName}</Text>
          {p.location ? <Text style={[styles.meta, { color: c.mutedForeground }]}>📍 {p.location}</Text> : null}
          {p.scope ? <Text style={[styles.meta, { color: c.mutedForeground }]} numberOfLines={4}>{p.scope}</Text> : null}
          {p.salespersonName ? <Text style={[styles.meta, { color: c.mutedForeground }]}>Salesperson: {p.salespersonName}</Text> : null}
          {p.projectManagerName ? <Text style={[styles.meta, { color: c.mutedForeground }]}>PM: {p.projectManagerName}</Text> : null}
          <Text style={[styles.meta, { color: c.mutedForeground }]}>
            Start: {fmtDate(p.startDate)} · End: {fmtDate(p.endDate)} · Delivery: {fmtDate(p.deliveryDate)}
          </Text>
        </Card>

        {canManage ? (
          <View style={styles.row}>
            <BrandButton label="Change stage" icon="repeat" variant="secondary" onPress={() => setStageOpen(true)} style={{ flex: 1 }} />
            <BrandButton label="Edit" icon="edit-2" onPress={() => router.push({ pathname: "/projects/[id]/edit", params: { id: String(projectId) } })} style={{ flex: 1 }} />
          </View>
        ) : null}

        <SectionHeading title={canManage ? "Workflow status · tap to update" : "Workflow status"} />
        {PIPELINE_LABELS.map(row => {
          const value = p[row.key] ?? "pending";
          const meta = pipelineStatusMeta(value);
          return (
            <Card key={row.key}>
              <View style={styles.row}>
                <Text style={[styles.body, { color: c.foreground, flex: 1 }]}>{row.label}</Text>
                <StatusPill label={meta.label} tone={meta.tone} />
                {canManage ? (
                  <BrandButton label="Update" variant="ghost" onPress={() => setPipelineOpen(row.key)} />
                ) : null}
              </View>
            </Card>
          );
        })}
      </ScrollView>

      <ActionSheet
        visible={stageOpen}
        onClose={() => setStageOpen(false)}
        title="Change stage"
        actions={PROJECT_STAGES.map(s => ({ label: s.label, icon: "tag", onPress: () => setStage(s.value) }))}
      />
      <ActionSheet
        visible={pipelineOpen != null}
        onClose={() => setPipelineOpen(null)}
        title={pipelineOpen ? `Update ${PIPELINE_LABELS.find(r => r.key === pipelineOpen)?.label}` : ""}
        actions={(pipelineOpen === "paymentStatus" ? PAYMENT_PIPELINE_STATUSES : PIPELINE_STATUSES).map(s => ({
          label: s.label, icon: "tag",
          onPress: () => { if (pipelineOpen) setPipeline(pipelineOpen, s.value); },
        }))}
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
});
