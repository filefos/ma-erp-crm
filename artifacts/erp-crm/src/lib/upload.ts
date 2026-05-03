import { requestUploadUrl } from "@workspace/api-client-react";

export interface UploadResult {
  objectKey: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

/**
 * Two-step upload: request presigned URL from API, then PUT file directly.
 * Returns the relative `objectKey` (e.g. /objects/...) the API stores.
 */
export async function uploadFile(file: File): Promise<UploadResult> {
  const presign = await requestUploadUrl({
    name: file.name,
    size: file.size,
    contentType: file.type || "application/octet-stream",
  });
  const put = await fetch(presign.uploadURL, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type || "application/octet-stream" },
  });
  if (!put.ok) throw new Error(`Upload failed: ${put.status}`);
  return {
    objectKey: presign.objectPath,
    fileName: file.name,
    contentType: file.type || "application/octet-stream",
    sizeBytes: file.size,
  };
}
