import React, { useState } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetAssetQueryKey, getListAssetsQueryKey,
  useGetAsset, useUpdateAsset,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, BrandInput, Card, ErrorBlock, LoadingBlock, SectionHeading } from "@/components/ui";
import { ActionSheet, FormCell, FormRow, StatusPill } from "@/components/forms";
import { ASSET_CONDITIONS, ASSET_STATUSES, assetConditionMeta, assetStatusMeta, fmtAed, fmtDate } from "@/lib/format";

export default function AssetDetail() {
  const c = useColors();
  const qc = useQueryClient();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const aid = Number(id);
  const q = useGetAsset(aid);
  const [statusOpen, setStatusOpen] = useState(false);
  const [condOpen, setCondOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveLoc, setMoveLoc] = useState("");
  const [moveAssignee, setMoveAssignee] = useState("");

  const update = useUpdateAsset({
    mutation: {
      onMutate: async (vars) => {
        await qc.cancelQueries({ queryKey: getGetAssetQueryKey(aid) });
        const prev = qc.getQueryData(getGetAssetQueryKey(aid));
        qc.setQueryData(getGetAssetQueryKey(aid), (old: unknown) => ({ ...(old as object ?? {}), ...vars.data }));
        return { prev };
      },
      onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(getGetAssetQueryKey(aid), ctx.prev); Alert.alert("Update failed"); },
      onSettled: () => {
        qc.invalidateQueries({ queryKey: getGetAssetQueryKey(aid) });
        qc.invalidateQueries({ queryKey: getListAssetsQueryKey() });
      },
    },
  });

  if (q.isLoading) return <View style={[styles.flex, { backgroundColor: c.background }]}><AppHeader title="Asset" /><LoadingBlock /></View>;
  if (q.error || !q.data) return <View style={[styles.flex, { backgroundColor: c.background }]}><AppHeader title="Asset" /><ErrorBlock message={(q.error as Error)?.message ?? "Not found"} onRetry={() => q.refetch()} /></View>;

  const a = q.data;
  const sm = assetStatusMeta(a.status);
  const cm = assetConditionMeta(a.condition);

  const baseBody = () => ({
    companyId: a.companyId ?? 0, name: a.name, category: a.category,
    purchaseDate: a.purchaseDate, purchaseValue: a.purchaseValue,
    currentLocation: a.currentLocation, assignedTo: a.assignedTo,
    condition: a.condition, maintenanceDate: a.maintenanceDate,
    status: a.status, notes: a.notes,
  });

  const changeStatus = (status: string) => update.mutate({ id: aid, data: { ...baseBody(), status } });
  const changeCondition = (condition: string) => update.mutate({ id: aid, data: { ...baseBody(), condition } });
  const applyMove = () => {
    update.mutate({ id: aid, data: { ...baseBody(), currentLocation: moveLoc || a.currentLocation, assignedTo: moveAssignee || a.assignedTo } });
    setMoveOpen(false);
  };

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title={a.name} subtitle={a.assetId} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primary} />}
      >
        <Card>
          <View style={styles.row}>
            <StatusPill label={sm.label} tone={sm.tone} />
            {a.condition ? <StatusPill label={cm.label} tone={cm.tone} /> : null}
            {a.category ? <Text style={[styles.meta, { color: c.mutedForeground }]}>{a.category}</Text> : null}
          </View>
          {a.currentLocation ? <Text style={[styles.body, { color: c.foreground, marginTop: 6 }]}>📍 {a.currentLocation}</Text> : null}
          {a.assignedTo ? <Text style={[styles.body, { color: c.foreground }]}>👤 {a.assignedTo}</Text> : null}
          {Number(a.purchaseValue) > 0 ? <Text style={[styles.amount, { color: c.primary }]}>{fmtAed(a.purchaseValue)}</Text> : null}
        </Card>

        <View style={styles.row}>
          <BrandButton label="Status" icon="repeat" variant="secondary" onPress={() => setStatusOpen(true)} style={{ flex: 1 }} />
          <BrandButton label="Condition" icon="activity" variant="secondary" onPress={() => setCondOpen(true)} style={{ flex: 1 }} />
        </View>
        <BrandButton label="Move / reassign" icon="map-pin" onPress={() => { setMoveLoc(a.currentLocation ?? ""); setMoveAssignee(a.assignedTo ?? ""); setMoveOpen(true); }} />
        <BrandButton label="Edit" icon="edit-3" variant="ghost"
          onPress={() => router.push({ pathname: "/assets/list/[id]/edit", params: { id: String(aid) } })} />

        {moveOpen ? (
          <Card>
            <SectionHeading title="Move / reassign" />
            <FormRow>
              <FormCell><BrandInput label="New location" icon="map-pin" value={moveLoc} onChangeText={setMoveLoc} /></FormCell>
              <FormCell><BrandInput label="Assigned to" icon="user" value={moveAssignee} onChangeText={setMoveAssignee} /></FormCell>
            </FormRow>
            <View style={styles.row}>
              <BrandButton label="Apply" icon="check" onPress={applyMove} loading={update.isPending} style={{ flex: 1 }} />
              <BrandButton label="Cancel" variant="ghost" onPress={() => setMoveOpen(false)} style={{ flex: 1 }} />
            </View>
          </Card>
        ) : null}

        <SectionHeading title="Lifecycle" />
        <Card>
          {a.purchaseDate ? <Text style={[styles.body, { color: c.foreground }]}>Purchased {fmtDate(a.purchaseDate)}</Text> : null}
          {a.maintenanceDate ? <Text style={[styles.body, { color: c.foreground }]}>Next maintenance {fmtDate(a.maintenanceDate)}</Text> : null}
          {a.companyRef ? <Text style={[styles.meta, { color: c.mutedForeground }]}>{a.companyRef}</Text> : null}
        </Card>

        {a.notes ? <><SectionHeading title="Notes" /><Card><Text style={[styles.body, { color: c.foreground }]}>{a.notes}</Text></Card></> : null}
      </ScrollView>

      <ActionSheet
        visible={statusOpen} onClose={() => setStatusOpen(false)}
        title="Change status"
        actions={ASSET_STATUSES.filter(s => s.value !== "in_use").map(s => ({ label: s.label, icon: "tag", onPress: () => changeStatus(s.value) }))}
      />
      <ActionSheet
        visible={condOpen} onClose={() => setCondOpen(false)}
        title="Change condition"
        actions={ASSET_CONDITIONS.map(s => ({ label: s.label, icon: "activity", onPress: () => changeCondition(s.value) }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 120 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  body: { fontFamily: "Inter_600SemiBold", fontSize: 14, marginVertical: 2 },
  meta: { fontFamily: "Inter_500Medium", fontSize: 12 },
  amount: { fontFamily: "Inter_700Bold", fontSize: 18, marginTop: 6 },
});
