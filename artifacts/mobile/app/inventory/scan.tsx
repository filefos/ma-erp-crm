import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useListInventoryItems } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, BrandInput, Card, LoadingBlock, SectionHeading } from "@/components/ui";
import { StatusPill } from "@/components/forms";

type Mode = "open" | "stock_out";

export default function ScanScreen() {
  const c = useColors();
  const router = useRouter();
  const items = useListInventoryItems();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [mode, setMode] = useState<Mode>("open");
  const [autoNavigate, setAutoNavigate] = useState(true);
  const lastScan = useRef<{ value: string; at: number } | null>(null);
  const navigatedRef = useRef<string | null>(null);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const lookup = useMemo(() => {
    if (!scanned) return null;
    const code = scanned.trim().toLowerCase();
    return (items.data ?? []).find(i =>
      (i.itemCode ?? "").toLowerCase() === code ||
      (i.name ?? "").toLowerCase() === code
    ) ?? null;
  }, [scanned, items.data]);

  const onBarcode = (value: string) => {
    const now = Date.now();
    if (lastScan.current && lastScan.current.value === value && now - lastScan.current.at < 2000) return;
    lastScan.current = { value, at: now };
    setScanned(value);
  };

  // Auto-navigate after a successful scan based on the active mode.
  useEffect(() => {
    if (!autoNavigate || !scanned || !lookup) return;
    const key = `${mode}:${lookup.id}:${scanned}`;
    if (navigatedRef.current === key) return;
    navigatedRef.current = key;
    if (mode === "stock_out") {
      router.push({ pathname: "/inventory/stock-entries/new", params: { itemId: String(lookup.id), type: "stock_out" } });
    } else {
      router.push({ pathname: "/inventory/items/[id]", params: { id: String(lookup.id) } });
    }
  }, [autoNavigate, scanned, lookup, mode, router]);

  const reset = () => { setScanned(null); lastScan.current = null; navigatedRef.current = null; };
  const armStockOut = () => {
    setMode("stock_out");
    reset();
  };
  const armOpen = () => {
    setMode("open");
    reset();
  };

  if (!permission) {
    return <View style={[styles.flex, { backgroundColor: c.background }]}><AppHeader title="Scan barcode" /><LoadingBlock /></View>;
  }

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader
        title="Scan barcode"
        subtitle={mode === "stock_out" ? "Stock-out mode · next scan starts an issue" : "Tap to open · long-press for stock-out"}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.row}>
          <StatusPill label={mode === "stock_out" ? "Stock-out armed" : "Open item"} tone={mode === "stock_out" ? "destructive" : "navy"} />
          <Pressable onPress={() => setAutoNavigate(v => !v)}>
            <StatusPill label={autoNavigate ? "Auto-open ON" : "Auto-open OFF"} tone={autoNavigate ? "success" : "muted"} />
          </Pressable>
        </View>

        {!permission.granted ? (
          <Card>
            <Text style={[styles.body, { color: c.foreground }]}>Camera access is needed to scan barcodes.</Text>
            <BrandButton label="Grant camera access" icon="camera" onPress={() => requestPermission()} />
          </Card>
        ) : (
          <Pressable
            onPress={armOpen}
            onLongPress={armStockOut}
            delayLongPress={350}
            style={[styles.cameraWrap, { borderColor: mode === "stock_out" ? c.destructive : c.border }]}
          >
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              onBarcodeScanned={scanned ? undefined : (e) => onBarcode(e.data)}
              barcodeScannerSettings={{ barcodeTypes: ["qr", "ean13", "ean8", "code128", "code39", "upc_a", "upc_e", "pdf417", "datamatrix"] }}
            />
            <View pointerEvents="none" style={[styles.frame, { borderColor: mode === "stock_out" ? c.destructive : c.primary }]} />
            <View pointerEvents="none" style={styles.hintBar}>
              <Text style={styles.hintText}>
                {mode === "stock_out" ? "Long-press again to cancel · tap to switch to Open" : "Long-press to arm Stock-out"}
              </Text>
            </View>
          </Pressable>
        )}

        <View style={styles.row}>
          <BrandButton
            label={mode === "stock_out" ? "Cancel stock-out" : "Arm stock-out"}
            icon="arrow-up-circle"
            variant={mode === "stock_out" ? "ghost" : "secondary"}
            onPress={mode === "stock_out" ? armOpen : armStockOut}
            style={{ flex: 1 }}
          />
        </View>

        <SectionHeading title="Manual lookup" />
        <BrandInput label="Item code" autoCapitalize="none" value={manual} onChangeText={setManual} />
        <BrandButton label="Find" icon="search" variant="secondary"
          onPress={() => { if (manual.trim()) setScanned(manual.trim()); }} />

        {scanned ? (
          <>
            <SectionHeading title="Result" action={
              <Pressable onPress={reset}><Feather name="x" size={18} color={c.mutedForeground} /></Pressable>
            } />
            <Card>
              <Text style={[styles.meta, { color: c.mutedForeground }]}>Code</Text>
              <Text style={[styles.code, { color: c.foreground }]}>{scanned}</Text>
              {lookup ? (
                <>
                  <Text style={[styles.body, { color: c.foreground, marginTop: 8 }]}>{lookup.name}</Text>
                  <Text style={[styles.meta, { color: c.mutedForeground }]}>Stock {Number(lookup.currentStock)} {lookup.unit}</Text>
                  <View style={styles.row}>
                    <BrandButton label="Open item" icon="external-link" variant="secondary"
                      onPress={() => router.push({ pathname: "/inventory/items/[id]", params: { id: String(lookup.id) } })} style={{ flex: 1 }} />
                    <BrandButton label="Stock in" icon="arrow-down-circle"
                      onPress={() => router.push({ pathname: "/inventory/stock-entries/new", params: { itemId: String(lookup.id), type: "stock_in" } })} style={{ flex: 1 }} />
                  </View>
                  <BrandButton label="Stock out" variant="ghost" icon="arrow-up-circle"
                    onPress={() => router.push({ pathname: "/inventory/stock-entries/new", params: { itemId: String(lookup.id), type: "stock_out" } })} />
                </>
              ) : (
                <>
                  <Text style={[styles.body, { color: c.destructive, marginTop: 8 }]}>No item matches this code.</Text>
                  <BrandButton label="Create item" icon="plus" variant="secondary"
                    onPress={() => Alert.alert("Tip", "Add the item from the Items list and use this code as its name or item code.")} />
                </>
              )}
            </Card>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 120 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  body: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  meta: { fontFamily: "Inter_500Medium", fontSize: 12 },
  code: { fontFamily: "Inter_700Bold", fontSize: 16 },
  cameraWrap: { height: 280, borderRadius: 16, overflow: "hidden", borderWidth: 1, position: "relative", backgroundColor: "#000" },
  frame: { position: "absolute", top: 60, bottom: 60, left: 40, right: 40, borderWidth: 2, borderRadius: 12 },
  hintBar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingVertical: 6, backgroundColor: "rgba(0,0,0,0.45)" },
  hintText: { textAlign: "center", color: "#fff", fontFamily: "Inter_500Medium", fontSize: 12 },
});
