import React from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, Card } from "@/components/ui";

type FeatherName = React.ComponentProps<typeof Feather>["name"];

interface ModulePlaceholderProps {
  title: string;
  icon: FeatherName;
  description: string;
}

/**
 * Module screens render a placeholder card pointing the user to the web app
 * for full CRUD. Data tables and forms will be added in follow-up tasks.
 */
export function ModulePlaceholder({ title, icon, description }: ModulePlaceholderProps) {
  const c = useColors();
  const openWeb = () => {
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    if (domain) void Linking.openURL(`https://${domain}/`);
  };

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title={title} />
      <View style={styles.body}>
        <Card>
          <View style={[styles.iconWrap, { backgroundColor: c.secondary }]}>
            <Feather name={icon} size={26} color={c.primary} />
          </View>
          <Text style={[styles.title, { color: c.foreground }]}>{title}</Text>
          <Text style={[styles.desc, { color: c.mutedForeground }]}>{description}</Text>
          <BrandButton label="Open in web app" icon="external-link" variant="secondary" onPress={openWeb} />
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { padding: 16, gap: 14 },
  iconWrap: {
    width: 52, height: 52, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
  },
  title: { fontFamily: "Inter_700Bold", fontSize: 18 },
  desc: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 20 },
});
