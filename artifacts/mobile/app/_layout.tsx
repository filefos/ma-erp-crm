import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import React, { useEffect } from "react";
import { notificationDataToPath } from "@/lib/push";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { setBaseUrl } from "@workspace/api-client-react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppProvider, useApp } from "@/contexts/AppContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

const domain = process.env.EXPO_PUBLIC_DOMAIN;
if (domain) setBaseUrl(`https://${domain}`);

function AuthGate() {
  const router = useRouter();
  const segments = useSegments();
  const { ready, token } = useApp();

  useEffect(() => {
    if (!ready) return;
    const inAuth = segments[0] === "login";
    if (!token && !inAuth) {
      router.replace("/login");
    } else if (token && inAuth) {
      router.replace("/");
    }
  }, [ready, token, segments, router]);

  // Deep-link push notifications: when the user taps a notification, route to
  // the relevant module screen. Also handles the cold-start case via
  // getLastNotificationResponseAsync so taps that launch the app still land.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const last = await Notifications.getLastNotificationResponseAsync();
        if (cancelled || !last) return;
        const path = notificationDataToPath(last.notification.request.content.data);
        if (path) router.push(path as never);
      } catch { /* ignore */ }
    })();
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      const path = notificationDataToPath(resp.notification.request.content.data);
      if (path) router.push(path as never);
    });
    return () => { cancelled = true; sub.remove(); };
  }, [token, router]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="login" options={{ animation: "fade" }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <AppProvider>
                <AuthGate />
              </AppProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
