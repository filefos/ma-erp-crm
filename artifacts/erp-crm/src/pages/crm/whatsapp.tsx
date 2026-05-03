import { useEffect, useMemo, useState } from "react";
import {
  useListWhatsappAccounts,
  useCreateWhatsappAccount,
  useListWhatsappThreads,
  useListWhatsappMessages,
  useSendWhatsappMessage,
  useUpdateWhatsappThread,
  useMarkWhatsappThreadRead,
  useListWhatsappTemplates,
  useSearchWhatsappLinkTargets,
  getListWhatsappThreadsQueryKey,
  getListWhatsappMessagesQueryKey,
  getListWhatsappAccountsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";
import {
  ArrowLeft, Search, Send, MessageCircle, Plus, Settings, RefreshCw, CheckCheck, Check, Clock,
  AlertTriangle, Link2, Inbox,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type LinkKind = "lead" | "deal" | "contact" | "project";

function timeLabel(ts?: string | null): string {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    return sameDay ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString();
  } catch { return ""; }
}

function statusIcon(status: string) {
  if (status === "read") return <CheckCheck className="w-3.5 h-3.5 text-blue-500" />;
  if (status === "delivered") return <CheckCheck className="w-3.5 h-3.5 text-muted-foreground" />;
  if (status === "sent") return <Check className="w-3.5 h-3.5 text-muted-foreground" />;
  if (status === "queued") return <Clock className="w-3.5 h-3.5 text-muted-foreground" />;
  if (status === "failed") return <AlertTriangle className="w-3.5 h-3.5 text-red-500" />;
  return null;
}

export function WhatsAppInbox() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterKind, setFilterKind] = useState<"all" | LinkKind | "unlinked">("all");
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);

  const accountsQ = useListWhatsappAccounts();
  const accounts = accountsQ.data ?? [];
  const defaultAccount = accounts.find(a => a.isDefault) ?? accounts[0];
  const tokenReady = Boolean(defaultAccount?.tokenConfigured);

  const threadsQ = useListWhatsappThreads({ search: search || undefined }, {
    query: { refetchInterval: 15000 } as never,
  });
  const threads = threadsQ.data ?? [];
  const filteredThreads = threads.filter(t => {
    if (filterKind === "all") return true;
    if (filterKind === "unlinked") return !t.leadId && !t.dealId && !t.contactId && !t.projectId;
    if (filterKind === "lead") return Boolean(t.leadId);
    if (filterKind === "deal") return Boolean(t.dealId);
    if (filterKind === "contact") return Boolean(t.contactId);
    if (filterKind === "project") return Boolean(t.projectId);
    return true;
  });

  // Auto-select first thread if none chosen.
  useEffect(() => {
    if (selectedThreadId == null && filteredThreads.length > 0) {
      setSelectedThreadId(filteredThreads[0]!.id);
    }
  }, [filteredThreads, selectedThreadId]);

  const selectedThread = threads.find(t => t.id === selectedThreadId) ?? null;

  const messagesQ = useListWhatsappMessages(selectedThreadId ?? 0, {
    query: { enabled: selectedThreadId != null, refetchInterval: 8000 } as never,
  });
  const messages = messagesQ.data ?? [];

  const markRead = useMarkWhatsappThreadRead();
  useEffect(() => {
    if (selectedThread && selectedThread.unreadCount > 0) {
      markRead.mutate({ id: selectedThread.id }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getListWhatsappThreadsQueryKey() }),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedThreadId]);

  const send = useSendWhatsappMessage({
    mutation: {
      onSuccess: () => {
        setDraft("");
        queryClient.invalidateQueries({ queryKey: getListWhatsappMessagesQueryKey(selectedThread!.id) });
        queryClient.invalidateQueries({ queryKey: getListWhatsappThreadsQueryKey() });
      },
      onError: (err: unknown) => {
        const msg = err instanceof Error ? err.message : "Failed to send";
        toast({ title: "Send failed", description: msg, variant: "destructive" });
      },
    },
  });

  const onSend = () => {
    if (!selectedThread || !draft.trim()) return;
    send.mutate({ data: { threadId: selectedThread.id, body: draft.trim() } });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/crm">
              <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground hover:text-foreground gap-1">
                <ArrowLeft className="w-3.5 h-3.5" />Back to CRM
              </Button>
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-green-600" />
            WhatsApp Inbox
          </h1>
          <p className="text-muted-foreground">Two-way Cloud API conversations linked to leads, deals, contacts, and projects.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => {
          queryClient.invalidateQueries({ queryKey: getListWhatsappThreadsQueryKey() });
          if (selectedThread) queryClient.invalidateQueries({ queryKey: getListWhatsappMessagesQueryKey(selectedThread.id) });
        }} className="gap-1">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {!defaultAccount && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
          <div>
            <div className="font-medium text-amber-900">No WhatsApp account configured yet.</div>
            <div className="text-amber-800">Add one under <strong>Settings</strong> below using your Meta phone-number ID and WABA ID. Set the access token in the <code>WHATSAPP_ACCESS_TOKEN</code> environment variable, the verify token in <code>WHATSAPP_VERIFY_TOKEN</code>, and the app secret in <code>WHATSAPP_APP_SECRET</code>. Inbound messages and statuses are received at <code>POST /api/whatsapp/webhook</code>.</div>
          </div>
        </div>
      )}
      {defaultAccount && !tokenReady && (
        <div className="rounded-md border border-orange-300 bg-orange-50 p-3 text-sm flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5" />
          <div className="text-orange-900">
            Account <strong>{defaultAccount.name}</strong> is registered, but env var <code>{defaultAccount.accessTokenEnv}</code> is not set, so sending will fail. Webhook ingestion still works once <code>WHATSAPP_VERIFY_TOKEN</code> and <code>WHATSAPP_APP_SECRET</code> are set.
          </div>
        </div>
      )}

      <Tabs defaultValue="inbox">
        <TabsList>
          <TabsTrigger value="inbox" data-testid="tab-wa-inbox"><Inbox className="w-4 h-4 mr-1.5" />Inbox</TabsTrigger>
          <TabsTrigger value="templates" data-testid="tab-wa-templates"><MessageCircle className="w-4 h-4 mr-1.5" />Templates</TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-wa-settings"><Settings className="w-4 h-4 mr-1.5" />Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="mt-3">
          <div className="grid grid-cols-12 gap-3 h-[calc(100vh-260px)] min-h-[480px]">
            {/* Threads list */}
            <div className="col-span-4 border rounded-lg bg-card overflow-hidden flex flex-col">
              <div className="p-2 border-b space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search conversations..."
                    className="pl-8 h-9"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    data-testid="input-wa-thread-search"
                  />
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  {(["all", "lead", "deal", "contact", "project", "unlinked"] as const).map(k => (
                    <Button
                      key={k}
                      variant={filterKind === k ? "default" : "ghost"}
                      size="sm"
                      className="h-7 px-2 text-[11px] capitalize"
                      onClick={() => setFilterKind(k)}
                      data-testid={`button-wa-filter-${k}`}
                    >{k}</Button>
                  ))}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {threadsQ.isLoading ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">Loading…</div>
                ) : filteredThreads.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">No conversations.</div>
                ) : filteredThreads.map(t => {
                  const active = t.id === selectedThreadId;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setSelectedThreadId(t.id)}
                      className={`w-full text-left px-3 py-2.5 border-b hover:bg-muted/40 transition-colors ${active ? "bg-muted/60" : ""}`}
                      data-testid={`button-wa-thread-${t.id}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium text-sm truncate">{t.peerName || `+${t.peerWaId}`}</div>
                        <div className="text-[10px] text-muted-foreground shrink-0">{timeLabel(t.lastMessageAt)}</div>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className="text-xs text-muted-foreground truncate flex-1">{t.lastMessagePreview || "—"}</div>
                        {t.unreadCount > 0 && (
                          <Badge className="bg-green-600 hover:bg-green-600 text-white h-4 px-1.5 text-[10px]">{t.unreadCount}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        {t.leadId && <Badge variant="secondary" className="h-4 px-1 text-[9px]">Lead #{t.leadId}</Badge>}
                        {t.dealId && <Badge variant="secondary" className="h-4 px-1 text-[9px]">Deal #{t.dealId}</Badge>}
                        {t.contactId && <Badge variant="secondary" className="h-4 px-1 text-[9px]">Contact #{t.contactId}</Badge>}
                        {t.projectId && <Badge variant="secondary" className="h-4 px-1 text-[9px]">Project #{t.projectId}</Badge>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Conversation */}
            <div className="col-span-8 border rounded-lg bg-card overflow-hidden flex flex-col">
              {!selectedThread ? (
                <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Select a conversation to start.</div>
              ) : (
                <>
                  <div className="p-3 border-b flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{selectedThread.peerName || `+${selectedThread.peerWaId}`}</div>
                      <div className="text-xs text-muted-foreground font-mono">+{selectedThread.peerWaId}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-1" data-testid="button-wa-link">
                            <Link2 className="w-3.5 h-3.5" /> Link to entity
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                          <DialogHeader><DialogTitle>Link this conversation</DialogTitle></DialogHeader>
                          <ThreadLinkPicker
                            threadId={selectedThread.id}
                            onDone={() => {
                              setLinkOpen(false);
                              queryClient.invalidateQueries({ queryKey: getListWhatsappThreadsQueryKey() });
                            }}
                          />
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#f7f6f1]">
                    {messages.length === 0 ? (
                      <div className="text-center text-muted-foreground text-sm py-8">No messages yet.</div>
                    ) : messages.map(m => (
                      <div key={m.id} className={`flex ${m.direction === "out" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm shadow-sm ${m.direction === "out" ? "bg-green-100 text-foreground" : "bg-white border text-foreground"}`}>
                          {m.templateName && (
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Template · {m.templateName}</div>
                          )}
                          <div className="whitespace-pre-wrap break-words">{m.body || (m.mediaCaption ?? `[${m.messageType}]`)}</div>
                          <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-muted-foreground">
                            {timeLabel(m.createdAt)}
                            {m.direction === "out" && statusIcon(m.status)}
                          </div>
                          {m.status === "failed" && m.errorText && (
                            <div className="text-[10px] text-red-600 mt-1">⚠ {m.errorText}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t p-2 flex items-end gap-2">
                    <Textarea
                      rows={2}
                      placeholder="Type a reply…"
                      value={draft}
                      onChange={e => setDraft(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onSend(); }
                      }}
                      className="resize-none flex-1"
                      data-testid="textarea-wa-reply"
                    />
                    <Button
                      onClick={onSend}
                      disabled={!draft.trim() || send.isPending || !tokenReady}
                      className="bg-green-600 hover:bg-green-700 text-white gap-1"
                      data-testid="button-wa-reply-send"
                    >
                      {send.isPending ? "Sending…" : (<><Send className="w-3.5 h-3.5" /> Send</>)}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="templates" className="mt-3">
          <TemplatesPanel accountId={defaultAccount?.id} />
        </TabsContent>

        <TabsContent value="settings" className="mt-3">
          <AccountsPanel onChanged={() => queryClient.invalidateQueries({ queryKey: getListWhatsappAccountsQueryKey() })} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ThreadLinkPicker({ threadId, onDone }: { threadId: number; onDone: () => void }) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<LinkKind>("lead");
  const search = useSearchWhatsappLinkTargets({ q: q || undefined }, { query: { enabled: q.length > 0 } as never });
  const update = useUpdateWhatsappThread();
  const { toast } = useToast();
  const hits = (search.data ?? { leads: [], deals: [], contacts: [], projects: [] }) as {
    leads: { id: number; label: string; secondary?: string }[];
    deals: { id: number; label: string; secondary?: string }[];
    contacts: { id: number; label: string; secondary?: string }[];
    projects: { id: number; label: string; secondary?: string }[];
  };
  const list = kind === "lead" ? hits.leads : kind === "deal" ? hits.deals : kind === "contact" ? hits.contacts : hits.projects;

  const link = (id: number) => {
    const data: Record<string, unknown> = { leadId: null, dealId: null, contactId: null, projectId: null };
    if (kind === "lead") data.leadId = id;
    if (kind === "deal") data.dealId = id;
    if (kind === "contact") data.contactId = id;
    if (kind === "project") data.projectId = id;
    update.mutate({ id: threadId, data: data as never }, {
      onSuccess: () => { toast({ title: "Linked" }); onDone(); },
      onError: () => toast({ title: "Failed to link", variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Select value={kind} onValueChange={v => setKind(v as LinkKind)}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="lead">Lead</SelectItem>
            <SelectItem value="deal">Deal</SelectItem>
            <SelectItem value="contact">Contact</SelectItem>
            <SelectItem value="project">Project</SelectItem>
          </SelectContent>
        </Select>
        <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search…" data-testid="input-wa-link-search" />
      </div>
      <div className="border rounded-md max-h-72 overflow-y-auto">
        {q.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground text-center">Type to search.</div>
        ) : list.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground text-center">No matches.</div>
        ) : list.map(h => (
          <button
            key={h.id}
            onClick={() => link(h.id)}
            className="w-full text-left px-3 py-2 border-b hover:bg-muted/40 text-sm"
            data-testid={`button-wa-link-${kind}-${h.id}`}
          >
            <div className="font-medium">{h.label}</div>
            {h.secondary && <div className="text-xs text-muted-foreground">{h.secondary}</div>}
          </button>
        ))}
      </div>
      <div className="flex justify-between items-center">
        <Button variant="ghost" size="sm" onClick={() => {
          update.mutate({ id: threadId, data: { leadId: null, dealId: null, contactId: null, projectId: null } as never }, {
            onSuccess: () => { toast({ title: "Link cleared" }); onDone(); },
            onError: () => toast({ title: "Failed to clear", variant: "destructive" }),
          });
        }} disabled={update.isPending}>Clear link</Button>
        <Button variant="outline" size="sm" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  );
}

function TemplatesPanel({ accountId }: { accountId?: number }) {
  const { toast } = useToast();
  const tplQ = useListWhatsappTemplates({ accountId }, { query: { enabled: accountId != null } as never });
  const send = useSendWhatsappMessage();
  const [phone, setPhone] = useState("");
  const [vars, setVars] = useState<Record<string, string>>({});
  const [openName, setOpenName] = useState<string | null>(null);

  type Tpl = {
    id?: string; name: string; language: string; status: string; category?: string;
    components?: Array<{ type: string; text?: string; format?: string; example?: unknown }>;
  };
  const templates = (tplQ.data ?? []) as Tpl[];
  const selected = templates.find(t => t.name === openName) ?? null;

  const placeholders = useMemo(() => {
    if (!selected) return [] as string[];
    const set = new Set<string>();
    for (const c of selected.components ?? []) {
      const txt = c.text ?? "";
      const matches = txt.match(/\{\{(\d+)\}\}/g) ?? [];
      for (const m of matches) set.add(m.replace(/[^0-9]/g, ""));
    }
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [selected]);

  const sendTemplate = () => {
    if (!selected || !phone) return;
    const body = placeholders.map(p => ({ type: "text", text: vars[p] ?? "" }));
    const components = body.length > 0 ? [{ type: "body", parameters: body }] : undefined;
    send.mutate({
      data: {
        accountId,
        to: phone,
        templateName: selected.name,
        templateLanguage: selected.language,
        templateComponents: components,
      },
    }, {
      onSuccess: () => { toast({ title: "Template sent" }); setOpenName(null); setVars({}); setPhone(""); },
      onError: (err: unknown) => toast({ title: "Send failed", description: err instanceof Error ? err.message : undefined, variant: "destructive" }),
    });
  };

  if (accountId == null) {
    return <div className="text-sm text-muted-foreground p-4 border rounded-md bg-muted/30">Add a WhatsApp account in Settings first.</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">Approved Cloud API templates pulled live from Meta.</div>
        <Button variant="outline" size="sm" onClick={() => tplQ.refetch()} className="gap-1"><RefreshCw className="w-3.5 h-3.5" /> Refresh</Button>
      </div>
      {tplQ.isLoading ? (
        <div className="text-sm text-muted-foreground p-4">Loading…</div>
      ) : tplQ.error ? (
        <div className="text-sm text-red-600 p-4 border border-red-200 bg-red-50 rounded-md">Could not load templates. Check that the account has a WABA ID and the access token env var is set.</div>
      ) : templates.length === 0 ? (
        <div className="text-sm text-muted-foreground p-4 border rounded-md">No templates returned by Meta yet.</div>
      ) : (
        <div className="border rounded-lg bg-card divide-y">
          {templates.map(t => (
            <div key={`${t.name}-${t.language}`} className="p-3 flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">{t.name} <span className="text-xs text-muted-foreground font-normal">· {t.language} · {t.category ?? "—"}</span></div>
                <div className="text-xs text-muted-foreground line-clamp-1">{(t.components ?? []).map(c => c.text).filter(Boolean).join(" · ") || "—"}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={t.status === "APPROVED" ? "default" : "secondary"} className="text-[10px]">{t.status}</Badge>
                <Button size="sm" variant="outline" onClick={() => { setOpenName(t.name); setVars({}); }} disabled={t.status !== "APPROVED"} data-testid={`button-wa-tpl-send-${t.name}`}>
                  Send
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={selected != null} onOpenChange={(o) => !o && setOpenName(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Send template · {selected?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Recipient phone (with country code)</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+971 50 xxx xxxx" />
            </div>
            {placeholders.map(p => (
              <div key={p} className="space-y-1">
                <Label>Variable {`{{${p}}}`}</Label>
                <Input value={vars[p] ?? ""} onChange={e => setVars(s => ({ ...s, [p]: e.target.value }))} />
              </div>
            ))}
            <Button className="bg-green-600 hover:bg-green-700 text-white w-full" onClick={sendTemplate} disabled={send.isPending || !phone}>
              {send.isPending ? "Sending…" : "Send template"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AccountsPanel({ onChanged }: { onChanged: () => void }) {
  const accountsQ = useListWhatsappAccounts();
  const create = useCreateWhatsappAccount();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phoneNumberId: "", wabaId: "", displayPhone: "", accessTokenEnv: "WHATSAPP_ACCESS_TOKEN", isDefault: true });

  const submit = () => {
    create.mutate({ data: form }, {
      onSuccess: () => { toast({ title: "Account added" }); setOpen(false); setForm({ name: "", phoneNumberId: "", wabaId: "", displayPhone: "", accessTokenEnv: "WHATSAPP_ACCESS_TOKEN", isDefault: true }); onChanged(); },
      onError: (err: unknown) => toast({ title: "Failed", description: err instanceof Error ? err.message : undefined, variant: "destructive" }),
    });
  };

  const accounts = accountsQ.data ?? [];

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
        <div className="font-medium">Webhook setup</div>
        <div>Configure your Meta app to POST inbound events to <code>POST /api/whatsapp/webhook</code>. Set the verify token to the value of <code>WHATSAPP_VERIFY_TOKEN</code> and the app secret to the value of <code>WHATSAPP_APP_SECRET</code>. The server validates Meta's <code>X-Hub-Signature-256</code> HMAC on every request.</div>
      </div>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Connected accounts</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-[#0f2d5a] hover:bg-[#1e6ab0] gap-1" data-testid="button-wa-account-add"><Plus className="w-3.5 h-3.5" />Add account</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add WhatsApp account</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3 pt-2">
              {[
                ["name", "Display name *"],
                ["phoneNumberId", "Phone number ID *"],
                ["wabaId", "WABA ID"],
                ["displayPhone", "Phone (E.164)"],
                ["accessTokenEnv", "Access-token env var"],
              ].map(([k, l]) => (
                <div key={k} className="space-y-1">
                  <Label>{l}</Label>
                  <Input value={String((form as unknown as Record<string, unknown>)[k] ?? "")} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} />
                </div>
              ))}
              <label className="flex items-center gap-2 text-sm col-span-2">
                <input type="checkbox" checked={form.isDefault} onChange={e => setForm(p => ({ ...p, isDefault: e.target.checked }))} />
                Use as default account
              </label>
            </div>
            <Button onClick={submit} disabled={!form.name || !form.phoneNumberId || create.isPending} className="mt-3 bg-[#0f2d5a] hover:bg-[#1e6ab0]">
              {create.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-lg divide-y bg-card">
        {accountsQ.isLoading ? <div className="p-4 text-sm text-muted-foreground">Loading…</div>
          : accounts.length === 0 ? <div className="p-4 text-sm text-muted-foreground">No accounts yet.</div>
          : accounts.map(a => (
          <div key={a.id} className="p-3 flex items-center justify-between">
            <div>
              <div className="font-medium text-sm">
                {a.name}
                {a.isDefault && <Badge className="ml-2 bg-[#0f2d5a] text-white text-[10px]">Default</Badge>}
                {!a.isActive && <Badge variant="secondary" className="ml-2 text-[10px]">Inactive</Badge>}
              </div>
              <div className="text-xs text-muted-foreground font-mono">
                phone_number_id: {a.phoneNumberId}{a.wabaId ? ` · waba_id: ${a.wabaId}` : ""}{a.displayPhone ? ` · ${a.displayPhone}` : ""}
              </div>
              <div className="text-xs">
                Token env <code>{a.accessTokenEnv}</code>:{" "}
                {a.tokenConfigured
                  ? <span className="text-green-700 font-medium">configured</span>
                  : <span className="text-red-600 font-medium">not set</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default WhatsAppInbox;
