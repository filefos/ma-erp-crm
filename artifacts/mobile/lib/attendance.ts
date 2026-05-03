import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";
import { requestUploadUrl } from "@workspace/api-client-react";

export type GpsFix = {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  address?: string;
};

export type CapturedSelfie = {
  uri: string;
  width: number;
  height: number;
  base64?: string;
};

export type CapturedAttendance = {
  gps: GpsFix;
  selfie: CapturedSelfie;
  selfieObjectKey: string;
};

export async function captureGps(): Promise<GpsFix> {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== "granted") {
    throw new Error("Location permission is required to record attendance.");
  }
  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });
  let address: string | undefined;
  try {
    const places = await Location.reverseGeocodeAsync({
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    });
    if (places.length > 0) {
      const p = places[0];
      address = [p.name, p.street, p.city, p.region, p.country]
        .filter(Boolean)
        .join(", ");
    }
  } catch {
    // Reverse geocoding is best-effort; ignore failures.
  }
  return {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    accuracyMeters: pos.coords.accuracy ?? null,
    address,
  };
}

export async function captureSelfie(): Promise<CapturedSelfie> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (perm.status !== "granted") {
    throw new Error("Camera permission is required for the on-site selfie.");
  }
  const res = await ImagePicker.launchCameraAsync({
    cameraType: ImagePicker.CameraType.front,
    quality: 0.6,
    base64: false,
    allowsEditing: false,
  });
  if (res.canceled || res.assets.length === 0) {
    throw new Error("Selfie cancelled.");
  }
  const a = res.assets[0];
  return { uri: a.uri, width: a.width ?? 0, height: a.height ?? 0 };
}

/**
 * Uploads a captured selfie to Replit Object Storage via a presigned URL
 * and returns the normalized object key (e.g. `/objects/uploads/<uuid>`).
 */
export async function uploadSelfie(selfie: CapturedSelfie): Promise<string> {
  const blob = await (await fetch(selfie.uri)).blob();
  const contentType = blob.type && blob.type.startsWith("image/")
    ? blob.type
    : "image/jpeg";
  const presigned = await requestUploadUrl({
    name: `attendance-${Date.now()}.jpg`,
    size: blob.size,
    contentType,
  });
  const put = await fetch(presigned.uploadURL, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
  });
  if (!put.ok) {
    throw new Error(`Selfie upload failed (${put.status})`);
  }
  return presigned.objectPath;
}

export async function captureAndUploadAttendance(): Promise<CapturedAttendance> {
  // GPS first so the selfie permission prompt comes after location is granted.
  const gps = await captureGps();
  const selfie = await captureSelfie();
  const selfieObjectKey = await uploadSelfie(selfie);
  return { gps, selfie, selfieObjectKey };
}

export function showAttendanceError(err: unknown) {
  const msg = err instanceof Error ? err.message : "Something went wrong.";
  Alert.alert("Attendance", msg);
}
