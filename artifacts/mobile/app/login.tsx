import React, { useEffect, useState } from "react";
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useListAuthCompanies, useLogin } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/contexts/AppContext";
import { BrandButton, BrandInput } from "@/components/ui";

export default function LoginScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { setSession } = useApp();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: companies } = useListAuthCompanies();
  const showCompanyPicker = (companies?.length ?? 0) > 1;

  // Default to first company so the user can sign in even without picking.
  useEffect(() => {
    if (companyId == null && companies && companies.length > 0) {
      setCompanyId(companies[0].id);
    }
  }, [companies, companyId]);

  const loginMut = useLogin({
    mutation: {
      onSuccess: async (data) => {
        const chosenId = (data.user as { companyId?: number | null }).companyId ?? companyId ?? null;
        await setSession(data.token, data.user, chosenId);
      },
      onError: (err: unknown) => {
        const e = err as { data?: { error?: string }; message?: string };
        setError(e.data?.error ?? e.message ?? "Login failed");
      },
    },
  });

  const submit = () => {
    setError(null);
    if (!email.trim() || !password) {
      setError("Email and password are required");
      return;
    }
    loginMut.mutate({
      data: {
        email: email.trim(),
        password,
        ...(showCompanyPicker && companyId != null ? { companyId } : {}),
      },
    });
  };

  const isWeb = Platform.OS === "web";

  return (
    <View style={[styles.flex, { backgroundColor: c.navy }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: (isWeb ? 67 : insets.top) + 24, paddingBottom: (isWeb ? 34 : insets.bottom) + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brand}>
          <View style={styles.logo}>
            <Feather name="layers" size={26} color="#ffffff" />
          </View>
          <Text style={styles.brandTitle}>MA ERP-CRM</Text>
          <Text style={styles.brandSubtitle}>Prime Max & Elite Prefab</Text>
        </View>

        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.cardTitle, { color: c.foreground }]}>Sign in</Text>
          <Text style={[styles.cardSubtitle, { color: c.mutedForeground }]}>
            Use your company email to continue.
          </Text>

          <View style={{ gap: 14, marginTop: 14 }}>
            <BrandInput
              label="Email"
              icon="mail"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="you@company.com"
              value={email}
              onChangeText={setEmail}
              testID="login-email"
            />
            <BrandInput
              label="Password"
              icon="lock"
              secureTextEntry
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              testID="login-password"
            />

            {showCompanyPicker ? (
              <View style={{ gap: 6 }}>
                <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Workspace</Text>
                <View style={styles.companyRow}>
                  {companies!.map(co => {
                    const active = co.id === companyId;
                    return (
                      <Pressable
                        key={co.id}
                        testID={`login-company-${co.id}`}
                        onPress={() => setCompanyId(co.id)}
                        style={({ pressed }) => [
                          styles.companyChip,
                          {
                            backgroundColor: active ? c.primary : c.secondary,
                            borderColor: active ? c.primary : c.border,
                            opacity: pressed ? 0.85 : 1,
                          },
                        ]}
                      >
                        <Feather name="briefcase" size={13} color={active ? "#ffffff" : c.primary} />
                        <Text style={[styles.companyChipText, { color: active ? "#ffffff" : c.foreground }]}>
                          {co.shortName ?? co.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {error ? (
              <View style={[styles.errorBox, { backgroundColor: "#fef2f2", borderColor: c.destructive }]}>
                <Feather name="alert-circle" size={14} color={c.destructive} />
                <Text style={[styles.errorText, { color: c.destructive }]}>{error}</Text>
              </View>
            ) : null}

            <BrandButton
              label={loginMut.isPending ? "Signing in…" : "Sign in"}
              onPress={submit}
              loading={loginMut.isPending}
              icon="log-in"
              testID="login-submit"
            />
          </View>
        </View>

        <Text style={styles.foot}>
          Powered by Prime Max · Secure login
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 20, gap: 20, justifyContent: "center" },
  brand: { alignItems: "center", gap: 6 },
  logo: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: "#1e6ab0",
    alignItems: "center", justifyContent: "center",
    marginBottom: 6,
  },
  brandTitle: { color: "#ffffff", fontFamily: "Inter_700Bold", fontSize: 22, letterSpacing: 0.5 },
  brandSubtitle: { color: "rgba(255,255,255,0.7)", fontFamily: "Inter_500Medium", fontSize: 13 },
  card: {
    padding: 20, borderRadius: 18, borderWidth: 1, gap: 4,
  },
  cardTitle: { fontFamily: "Inter_700Bold", fontSize: 18 },
  cardSubtitle: { fontFamily: "Inter_400Regular", fontSize: 13 },
  fieldLabel: { fontFamily: "Inter_500Medium", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  companyRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  companyChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, borderWidth: 1,
  },
  companyChipText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 10, borderRadius: 10, borderWidth: 1,
  },
  errorText: { fontFamily: "Inter_500Medium", fontSize: 13, flex: 1 },
  foot: { color: "rgba(255,255,255,0.55)", fontFamily: "Inter_400Regular", fontSize: 11, textAlign: "center", marginTop: 4 },
});

void Image;
