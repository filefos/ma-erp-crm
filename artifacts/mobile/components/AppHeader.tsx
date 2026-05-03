import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/contexts/AppContext";

export interface AppHeaderProps {
  title: string;
  subtitle?: string;
}

export function AppHeader({ title, subtitle }: AppHeaderProps) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { user, activeCompany, setActiveCompany, signOut } = useApp();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const accessible = (user?.accessibleCompanies ?? []) as Array<{ id: number; name: string; shortName?: string | null }>;
  const canSwitch = accessible.length > 1;

  return (
    <View style={[styles.wrap, { backgroundColor: c.navy, paddingTop: insets.top + 12 }]}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>

        {canSwitch ? (
          <Pressable
            onPress={() => setOpen(true)}
            testID="company-switcher"
            style={({ pressed }) => [styles.companyBtn, { opacity: pressed ? 0.85 : 1 }]}
          >
            <Feather name="briefcase" size={13} color="#ffffff" />
            <Text style={styles.companyText} numberOfLines={1}>
              {activeCompany?.short ?? "Company"}
            </Text>
            <Feather name="chevron-down" size={12} color="#ffffff" />
          </Pressable>
        ) : (
          activeCompany ? (
            <View style={styles.companyBtn}>
              <Feather name="briefcase" size={13} color="#ffffff" />
              <Text style={styles.companyText} numberOfLines={1}>{activeCompany.short}</Text>
            </View>
          ) : null
        )}

        <Pressable
          onPress={() => setMenuOpen(true)}
          testID="user-menu"
          style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={styles.avatar}>{(user?.name ?? "U").charAt(0).toUpperCase()}</Text>
        </Pressable>
      </View>

      {/* Company switcher modal */}
      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: c.card }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.sheetTitle, { color: c.foreground }]}>Switch workspace</Text>
            {accessible.map(co => {
              const active = co.id === activeCompany?.id;
              return (
                <Pressable
                  key={co.id}
                  testID={`company-option-${co.id}`}
                  onPress={async () => { await setActiveCompany(co.id); setOpen(false); }}
                  style={({ pressed }) => [
                    styles.sheetItem,
                    { borderColor: c.border, opacity: pressed ? 0.85 : 1, backgroundColor: active ? c.secondary : "transparent" },
                  ]}
                >
                  <Feather name="briefcase" size={16} color={c.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sheetItemTitle, { color: c.foreground }]}>{co.shortName ?? co.name}</Text>
                    <Text style={[styles.sheetItemSub, { color: c.mutedForeground }]} numberOfLines={1}>{co.name}</Text>
                  </View>
                  {active ? <Feather name="check" size={16} color={c.primary} /> : null}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

      {/* User menu */}
      <Modal transparent visible={menuOpen} animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: c.card }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.sheetTitle, { color: c.foreground }]}>{user?.name ?? "Signed in"}</Text>
            <Text style={[styles.sheetItemSub, { color: c.mutedForeground, marginBottom: 12 }]}>
              {user?.email}
              {user?.role ? ` · ${user.role}` : ""}
            </Text>
            <Pressable
              testID="sign-out"
              onPress={async () => { setMenuOpen(false); await signOut(); }}
              style={({ pressed }) => [styles.signOutBtn, { backgroundColor: c.destructive, opacity: pressed ? 0.85 : 1 }]}
            >
              <Feather name="log-out" size={16} color="#ffffff" />
              <Text style={styles.signOutText}>Sign out</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingBottom: 16, paddingHorizontal: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { color: "#ffffff", fontFamily: "Inter_700Bold", fontSize: 18 },
  subtitle: { color: "rgba(255,255,255,0.65)", fontFamily: "Inter_500Medium", fontSize: 12, marginTop: 2 },
  companyBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    maxWidth: 140,
  },
  companyText: { color: "#ffffff", fontFamily: "Inter_600SemiBold", fontSize: 12 },
  iconBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center",
  },
  avatar: { color: "#ffffff", fontFamily: "Inter_700Bold", fontSize: 14 },
  backdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  sheet: {
    padding: 16, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    gap: 8, paddingBottom: 32,
  },
  sheetTitle: { fontFamily: "Inter_700Bold", fontSize: 16, marginBottom: 6 },
  sheetItem: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 12, borderRadius: 12, borderWidth: 1,
  },
  sheetItemTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  sheetItemSub: { fontFamily: "Inter_400Regular", fontSize: 12 },
  signOutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 12, borderRadius: 12, marginTop: 8,
  },
  signOutText: { color: "#ffffff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
});
