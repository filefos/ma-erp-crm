import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useGetSupplierQuotation } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { LoadingBlock } from "@/components/ui";
import { PoForm } from "@/components/forms/PoForm";

export default function NewPo() {
  const c = useColors();
  const { supplierId, prId, fromSqId } = useLocalSearchParams<{ supplierId?: string; prId?: string; fromSqId?: string }>();
  const sq = useGetSupplierQuotation(fromSqId ? Number(fromSqId) : 0, {
    // @ts-expect-error -- queryKey not required by Orval helper at call site
    query: { enabled: !!fromSqId },
  });

  const ready = !fromSqId || (!sq.isLoading && !!sq.data);

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="New purchase order" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!ready ? <LoadingBlock /> : (
          <PoForm
            sourceSupplierId={
              supplierId ? Number(supplierId) :
              sq.data?.supplierId
            }
            sourcePrId={prId ? Number(prId) : undefined}
            seedItems={sq.data?.items?.map(it => ({
              itemName: it.itemName ?? "",
              quantity: Number(it.quantity),
              unit: it.unit ?? "",
              unitPrice: Number(it.unitPrice ?? 0),
            }))}
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 }, content: { padding: 16, gap: 12, paddingBottom: 120 } });
