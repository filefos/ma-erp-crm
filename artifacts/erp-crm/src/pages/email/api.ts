import { useQuery } from "@tanstack/react-query";

export interface Email {
  id: number;
  folder: string;
  fromAddress: string;
  fromName?: string;
  toAddress: string;
  toName?: string;
  ccAddress?: string;
  subject: string;
  body: string;
  isRead: boolean;
  isStarred: boolean;
  replyToId?: number;
  sentAt?: string;
  createdAt: string;
  companyId?: number;
  attachments?: Array<{ filename: string; contentType: string; size: number }>;
}

export type EmailFolder = "inbox" | "sent" | "draft" | "trash" | "starred";

const BASE = import.meta.env.BASE_URL;

export async function emailApiFetch(path: string, opts?: RequestInit) {
  const token = localStorage.getItem("erp_token");
  const res = await fetch(`${BASE}api${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try { msg = JSON.parse(text).error ?? text; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export function useEmailFolder(folder: EmailFolder, companyId: number | null | undefined) {
  return useQuery<Email[]>({
    queryKey: ["emails", folder, companyId],
    queryFn: () => emailApiFetch(`/emails?folder=${folder}&companyId=${companyId ?? 0}`),
    enabled: companyId != null,
    retry: 1,
    staleTime: 30_000,
  });
}
