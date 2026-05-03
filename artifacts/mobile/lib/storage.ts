import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const TOKEN_KEY = "erp_token";
const COMPANY_KEY = "erp_active_company_id";

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") window.localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") window.localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export const authStorage = {
  getToken: () => getItem(TOKEN_KEY),
  setToken: (v: string) => setItem(TOKEN_KEY, v),
  clearToken: () => deleteItem(TOKEN_KEY),
  getCompanyId: async () => {
    const v = await getItem(COMPANY_KEY);
    if (!v) return null;
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  },
  setCompanyId: (id: number) => setItem(COMPANY_KEY, String(id)),
  clearCompanyId: () => deleteItem(COMPANY_KEY),
};
