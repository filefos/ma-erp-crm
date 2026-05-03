import { Tabs, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useEffect } from "react";
import { Platform, StyleSheet, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { useApp } from "@/contexts/AppContext";
import { visibleModulesFor, type ModuleKey } from "@/lib/permissions";

type FeatherName = React.ComponentProps<typeof Feather>["name"];

const MODULE_ICONS: Record<ModuleKey, FeatherName> = {
  CRM: "users",
  Sales: "file-text",
  Accounts: "credit-card",
  Procurement: "shopping-cart",
  Inventory: "package",
  Projects: "folder",
  HR: "user-check",
  Assets: "tool",
  Reports: "bar-chart-2",
  Admin: "settings",
};

const MODULE_ROUTE: Record<ModuleKey, string> = {
  CRM: "crm",
  Sales: "sales",
  Accounts: "accounts",
  Procurement: "procurement",
  Inventory: "inventory",
  Projects: "projects",
  HR: "hr",
  Assets: "assets",
  Reports: "reports",
  Admin: "admin",
};

const MODULE_KEYS: ModuleKey[] = [
  "CRM", "Sales", "Accounts", "Procurement", "Inventory",
  "Projects", "HR", "Assets", "Reports", "Admin",
];

export default function TabLayout() {
  const c = useColors();
  const router = useRouter();
  const { ready, token } = useApp();
  const { user } = useApp();
  const visible = new Set(visibleModulesFor(user as never));

  // Belt-and-braces: if AuthGate hasn't kicked in yet for some reason, push
  // the user back to login when the tabs render without a token.
  useEffect(() => {
    if (ready && !token) router.replace("/login");
  }, [ready, token, router]);

  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.mutedForeground,
        tabBarLabelStyle: { fontFamily: "Inter_500Medium", fontSize: 10 },
        tabBarStyle: {
          backgroundColor: c.card,
          borderTopColor: c.border,
          ...(isWeb ? { height: 84 } : {}),
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <Feather name="home" size={20} color={color} />,
        }}
      />
      {MODULE_KEYS.map((key) => {
        const route = MODULE_ROUTE[key];
        const icon = MODULE_ICONS[key];
        const isVisible = visible.has(key);
        return (
          <Tabs.Screen
            key={route}
            name={route}
            options={{
              title: key,
              tabBarIcon: ({ color }) => <Feather name={icon} size={20} color={color} />,
              href: isVisible ? undefined : null,
            }}
          />
        );
      })}
    </Tabs>
  );
}

void View;
void StyleSheet;
