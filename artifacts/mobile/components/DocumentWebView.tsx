import React, { useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { useColors } from "@/hooks/useColors";

interface Props {
  visible: boolean;
  onClose: () => void;
  title: string;
  html: string;
}

export function DocumentWebView({ visible, onClose, title, html }: Props) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [sharing, setSharing] = useState(false);

  const onShare = async () => {
    try {
      setSharing(true);
      const file = await Print.printToFileAsync({ html, base64: false });
      const can = await Sharing.isAvailableAsync();
      if (!can) { Alert.alert("Sharing unavailable", "This device doesn't support sharing."); return; }
      await Sharing.shareAsync(file.uri, {
        mimeType: "application/pdf",
        dialogTitle: title,
        UTI: "com.adobe.pdf",
      });
    } catch (e) {
      Alert.alert("Could not share PDF", (e as Error).message ?? "Please try again.");
    } finally {
      setSharing(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={[styles.flex, { backgroundColor: c.background }]}>
        <View style={[styles.bar, { backgroundColor: c.navy, paddingTop: insets.top + 10 }]}>
          <Pressable onPress={onClose} style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.85 : 1 }]} hitSlop={10}>
            <Feather name="x" size={20} color="#ffffff" />
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <Pressable onPress={onShare} disabled={sharing} style={({ pressed }) => [styles.iconBtn, { opacity: pressed || sharing ? 0.6 : 1 }]} hitSlop={10}>
            {sharing ? <ActivityIndicator color="#ffffff" /> : <Feather name="share" size={18} color="#ffffff" />}
          </Pressable>
        </View>
        <WebView
          originWhitelist={["*"]}
          source={{ html }}
          style={{ flex: 1, backgroundColor: c.background }}
          showsVerticalScrollIndicator
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingBottom: 12, gap: 8 },
  iconBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  title: { color: "#ffffff", flex: 1, textAlign: "center", fontFamily: "Inter_700Bold", fontSize: 16 },
});
