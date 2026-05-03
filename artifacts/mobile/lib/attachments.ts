import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";
import type { LpoAttachment } from "@workspace/api-client-react";

export type PickedAttachment = Required<Pick<LpoAttachment, "filename" | "contentType" | "size" | "content">>;

const MAX_BYTES = 8 * 1024 * 1024;

function checkSize(size: number, name: string): boolean {
  if (size > MAX_BYTES) {
    Alert.alert("File too large", `${name} is ${(size / 1024 / 1024).toFixed(1)} MB. Please pick a file under ${MAX_BYTES / 1024 / 1024} MB.`);
    return false;
  }
  return true;
}

async function readBase64(uri: string): Promise<string> {
  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
}

export async function pickImageFromLibrary(): Promise<PickedAttachment | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) { Alert.alert("Permission needed", "Allow photo access to attach a file."); return null; }
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, base64: true, quality: 0.6 });
  if (res.canceled || !res.assets.length) return null;
  const a = res.assets[0];
  const content = a.base64 ?? (await readBase64(a.uri));
  const size = a.fileSize ?? Math.floor((content.length * 3) / 4);
  if (!checkSize(size, a.fileName ?? "Photo")) return null;
  return {
    filename: a.fileName ?? `photo-${Date.now()}.jpg`,
    contentType: a.mimeType ?? "image/jpeg",
    size,
    content,
  };
}

export async function captureImageFromCamera(): Promise<PickedAttachment | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) { Alert.alert("Permission needed", "Allow camera access to capture a photo."); return null; }
  const res = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.6 });
  if (res.canceled || !res.assets.length) return null;
  const a = res.assets[0];
  const content = a.base64 ?? (await readBase64(a.uri));
  const size = a.fileSize ?? Math.floor((content.length * 3) / 4);
  if (!checkSize(size, "Photo")) return null;
  return {
    filename: a.fileName ?? `capture-${Date.now()}.jpg`,
    contentType: a.mimeType ?? "image/jpeg",
    size,
    content,
  };
}

export async function pickDocument(): Promise<PickedAttachment | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true, multiple: false });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  const content = await readBase64(a.uri);
  const size = a.size ?? Math.floor((content.length * 3) / 4);
  if (!checkSize(size, a.name)) return null;
  return {
    filename: a.name,
    contentType: a.mimeType ?? "application/octet-stream",
    size,
    content,
  };
}
