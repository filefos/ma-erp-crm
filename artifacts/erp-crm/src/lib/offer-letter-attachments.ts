function authHeaders(json = true): Record<string, string> {
  const t = localStorage.getItem("erp_token");
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  };
}

export interface OfferLetterAttachment {
  id: number;
  offerLetterId: number;
  fileName: string;
  contentType: string | null;
  sizeBytes: number | null;
  uploadedById: number | null;
  uploadedAt: string;
}

export async function listOfferLetterAttachments(offerLetterId: number): Promise<OfferLetterAttachment[]> {
  const r = await fetch(`/api/offer-letters/${offerLetterId}/attachments`, { headers: authHeaders(false) });
  if (!r.ok) throw new Error(`Failed to load attachments (${r.status})`);
  return r.json();
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result ?? "");
      const idx = s.indexOf(",");
      resolve(idx >= 0 ? s.slice(idx + 1) : s);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Read failed"));
    reader.readAsDataURL(file);
  });
}

export async function uploadOfferLetterAttachment(offerLetterId: number, file: File): Promise<OfferLetterAttachment> {
  const contentBase64 = await fileToBase64(file);
  const r = await fetch(`/api/offer-letters/${offerLetterId}/attachments`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      contentBase64,
    }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.error || `Upload failed (${r.status})`);
  }
  return r.json();
}

export async function deleteOfferLetterAttachment(offerLetterId: number, attId: number): Promise<void> {
  const r = await fetch(`/api/offer-letters/${offerLetterId}/attachments/${attId}`, {
    method: "DELETE",
    headers: authHeaders(false),
  });
  if (!r.ok) throw new Error(`Delete failed (${r.status})`);
}

export async function downloadOfferLetterAttachment(offerLetterId: number, att: OfferLetterAttachment): Promise<void> {
  const r = await fetch(`/api/offer-letters/${offerLetterId}/attachments/${att.id}/download`, {
    headers: authHeaders(false),
  });
  if (!r.ok) throw new Error(`Download failed (${r.status})`);
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = att.fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
