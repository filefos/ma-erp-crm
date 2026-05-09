import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { authStorage } from "./storage";

// How notifications behave when received while the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function apiBaseUrl(): string | null {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return domain ? `https://${domain}` : null;
}

async function authedFetch(path: string, init: RequestInit): Promise<Response | null> {
  const base = apiBaseUrl();
  const token = await authStorage.getToken();
  if (!base || !token) return null;
  return fetch(`${base}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
}

/**
 * Request notification permission, obtain an Expo push token, and register
 * it with the API server for the currently-authenticated user.
 *
 * Safe to call on web / simulator — returns null without throwing when push
 * is not supported in the current environment.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  if (!Device.isDevice) return null; // simulators don't get push tokens

  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#0066FF",
      });
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return null;

    // projectId is required at runtime for SDK 49+; pull from app config.
    const projectId =
      (await import("expo-constants")).default?.expoConfig?.extra?.eas?.projectId
      ?? (await import("expo-constants")).default?.easConfig?.projectId
      ?? undefined;

    const tokenResp = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenResp.data;
    if (!token) return null;

    const res = await authedFetch("/api/device-tokens", {
      method: "POST",
      body: JSON.stringify({
        token,
        platform: Platform.OS,
        deviceName: Device.deviceName ?? Device.modelName ?? null,
      }),
    });
    if (res && !res.ok) {
      // Non-fatal: surface in dev console only.
      console.warn("Failed to register device token", res.status);
      return null;
    }
    return token;
  } catch (err) {
    console.warn("registerForPushNotifications failed", err);
    return null;
  }
}

export async function unregisterPushToken(token: string | null): Promise<void> {
  if (!token) return;
  try {
    await authedFetch("/api/device-tokens", {
      method: "DELETE",
      body: JSON.stringify({ token }),
    });
  } catch { /* best effort */ }
}

/**
 * Map the `data` payload attached to a server-sent push to a deep-link path
 * inside the Expo Router app. Returns null when no useful target is present.
 */
export function notificationDataToPath(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const moduleName = typeof d.module === "string" ? d.module : null;
  const entityType = typeof d.entityType === "string" ? d.entityType : null;
  const idRaw = d.id;
  const id = typeof idRaw === "number" ? idRaw : (typeof idRaw === "string" ? parseInt(idRaw, 10) : NaN);

  switch (moduleName ?? entityType) {
    case "leads":
    case "lead":
      return Number.isFinite(id) ? `/crm/leads/${id}` : "/crm/leads";
    case "expenses":
    case "expense":
      return Number.isFinite(id) ? `/accounts/expenses/${id}` : "/accounts/expenses";
    case "invoices":
    case "tax_invoice":
      return Number.isFinite(id) ? `/accounts/invoices/${id}` : "/accounts/invoices";
    case "inventory":
    case "inventory_item":
      return Number.isFinite(id) ? `/inventory/items/${id}` : "/inventory/items";
    default:
      return null;
  }
}
