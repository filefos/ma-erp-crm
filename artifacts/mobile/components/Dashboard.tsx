import React, { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";

interface DashboardScreenProps {
  title: string;
  subtitle?: string;
  invalidateKeys?: readonly unknown[][];
  children: React.ReactNode;
}

/**
 * Standard dashboard wrapper: navy header + pull-to-refresh scroll view that
 * invalidates the supplied query keys. All home dashboards share this so they
 * have a consistent loading/refresh affordance.
 */
export function DashboardScreen({ title, subtitle, invalidateKeys, children }: DashboardScreenProps) {
  const c = useColors();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (invalidateKeys && invalidateKeys.length > 0) {
        await Promise.all(
          invalidateKeys.map(key => queryClient.invalidateQueries({ queryKey: key })),
        );
      } else {
        await queryClient.invalidateQueries();
      }
    } finally {
      setRefreshing(false);
    }
  }, [invalidateKeys, queryClient]);

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title={title} subtitle={subtitle} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 120 },
});
