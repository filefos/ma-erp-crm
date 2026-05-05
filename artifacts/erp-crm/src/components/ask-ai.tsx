import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Send, Loader2 } from "lucide-react";
import { authHeaders } from "@/lib/ai-client";

type Msg = { role: "user" | "assistant"; content: string };

const MODULE_FROM_PATH: Array<[RegExp, string, string[]]> = [
  [/^\/crm/,         "crm",         ["Suggest follow-up date for my hottest lead", "Spot duplicate contacts", "Which leads should I prioritise this week?"]],
  [/^\/sales/,       "sales",       ["Suggest items for a new quotation", "Flag low-profit quotations", "Who should I follow up with next?"]],
  [/^\/procurement/, "procurement", ["Compare my latest supplier quotations", "Suggest 3 suppliers for steel angles", "Alert me to high-cost POs"]],
  [/^\/inventory/,   "inventory",   ["Which items are running low?", "Suggest reorder quantities", "Show me dead stock"]],
  [/^\/projects/,    "projects",    ["Which projects are at risk of delay?", "Compare estimated vs actual cost", "Suggest resource allocation"]],
  [/^\/accounts/,    "accounts",    ["Validate VAT on my latest invoice", "Suggest a journal entry for an expense", "Which invoices are overdue?"]],
  [/^\/assets/,      "assets",      ["Which assets need maintenance?", "Show depreciation summary", "Flag assets without recent use"]],
  [/^\/hr/,          "hr",          ["Summarise this month's leave", "Who is on leave today?", "Suggest the on-call rota"]],
  [/^\/reports/,     "reports",     ["Summarise this month's sales", "Highlight unusual expenses", "What should I look at next?"]],
];

function detectModule(pathname: string): { module: string; suggestions: string[] } {
  for (const [re, mod, sugg] of MODULE_FROM_PATH) {
    if (re.test(pathname)) return { module: mod, suggestions: sugg };
  }
  return { module: "general", suggestions: ["Summarise what's happening today", "What needs my attention?", "Show me overdue items"] };
}

export function AskAIButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-8 gap-1.5 border-[#1e6ab0] text-[#0f2d5a] hover:bg-[#e8f1fb]"
        data-testid="button-ask-ai"
      >
        <Sparkles className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Ask AI</span>
      </Button>
      <AskAIPanel open={open} onOpenChange={setOpen} />
    </>
  );
}

function AskAIPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [location] = useLocation();
  const { module, suggestions } = detectModule(location);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    if (messages.length === 0) {
      setMessages([{
        role: "assistant",
        content: `Hi — I'm your ${module.toUpperCase()} assistant. I can suggest, validate and explain — I never change data on my own. Try one of the prompts below or ask me anything.`,
      }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, module]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const ask = async (q: string) => {
    const question = q.trim();
    if (!question || busy) return;
    setErr(null);
    setBusy(true);
    const next: Msg[] = [...messages, { role: "user", content: question }];
    setMessages(next);
    setInput("");
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/ai/ask`, {
        method: "POST",
        headers: authHeaders(),
        credentials: "include",
        body: JSON.stringify({
          module,
          question,
          history: next.slice(-7, -1),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(j?.message ?? `HTTP ${res.status}`);
      } else {
        setMessages([...next, { role: "assistant", content: String(j.result ?? "") }]);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setMessages([]);
    setErr(null);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0 gap-0">
        <SheetHeader className="px-4 py-3 border-b">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Sparkles className="w-4 h-4 text-[#1e6ab0]" />
            Ask AI · <span className="capitalize">{module}</span>
          </SheetTitle>
          <SheetDescription className="text-xs">
            Suggestions only — nothing is saved or sent without your approval.
          </SheetDescription>
        </SheetHeader>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-slate-50">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div className={`max-w-[88%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                m.role === "user" ? "bg-[#0f2d5a] text-white" : "bg-white border"
              }`}>{m.content}</div>
            </div>
          ))}
          {busy && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" /> Thinking…
            </div>
          )}
          {err && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{err}</div>
          )}
        </div>

        {messages.length <= 1 && (
          <div className="px-4 py-2 border-t bg-white">
            <div className="text-xs text-muted-foreground mb-1.5">Quick suggestions</div>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => ask(s)}
                  className="text-xs px-2 py-1 rounded-full border bg-slate-50 hover:bg-slate-100"
                  disabled={busy}
                  data-testid={`button-ai-suggestion-${i}`}
                >{s}</button>
              ))}
            </div>
          </div>
        )}

        <div className="border-t p-3 bg-white">
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(input); }
              }}
              placeholder={`Ask anything about ${module}…`}
              className="min-h-[40px] max-h-32 text-sm"
              disabled={busy}
              data-testid="input-ai-question"
            />
            <Button
              size="sm"
              onClick={() => ask(input)}
              disabled={busy || !input.trim()}
              className="bg-[#0f2d5a] hover:bg-[#163d76] h-10"
              data-testid="button-ai-send"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex justify-between items-center mt-1.5">
            <span className="text-[10px] text-muted-foreground">Shift+Enter for newline</span>
            <button onClick={reset} className="text-[10px] text-muted-foreground hover:text-foreground underline" disabled={busy}>
              Clear chat
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
