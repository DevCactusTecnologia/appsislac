// AI Shell — Assistente do SISLAC. Avatar global + Drawer + Modo Assistente.
// Sem rota. Sempre abre em Modo Assistente.
import { useEffect, useState, useCallback, useMemo } from "react";
import { Sparkles, X, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { CLIENT_CAPABILITIES } from "@/lib/ai/capabilityRegistry";
import { useAIContext, getContextualSuggestions } from "@/lib/ai/contextEngine";
import { supabase } from "@/integrations/supabase/client";

interface Msg { id: string; role: "user" | "assistant"; text: string }

const HIDE_ROUTES = ["/", "/login", "/super-admin", "/inscricao", "/laudo/print", "/imprimir", "/verificar", "/r/"];

export default function AiShell() {
  const { user } = useAuth();
  const ctx = useAIContext();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);

  const allowedQuickActions = useMemo(() => {
    const perms = new Set((user?.permissoes ?? []) as string[]);
    return CLIENT_CAPABILITIES.filter((c) => {
      if (!c.enabled) return false;
      if (!c.permission) return true;
      return perms.has(c.permission);
    });
  }, [user?.permissoes]);

  const suggestions = useMemo(() => getContextualSuggestions(ctx), [ctx]);

  // Atalho Ctrl/Cmd+J
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || busy) return;
    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", text };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setBusy(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-chat`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          context: ctx,
          messages: [...messages, userMsg].map((m) => ({
            id: m.id, role: m.role,
            parts: [{ type: "text", text: m.text }],
          })),
        }),
      });
      if (!res.ok || !res.body) {
        const err = await res.text().catch(() => "");
        setMessages((m) => [...m, {
          id: crypto.randomUUID(), role: "assistant",
          text: res.status === 429
            ? "Limite de requisições atingido. Tente novamente em instantes."
            : res.status === 402
            ? "Créditos esgotados. Adicione créditos no Workspace."
            : `Falha ao processar (${res.status}). ${err.slice(0, 200)}`,
        }]);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const aId = crypto.randomUUID();
      setMessages((m) => [...m, { id: aId, role: "assistant", text: "" }]);
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        // SSE simples: pegar campos data: que contém texto
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const obj = JSON.parse(payload);
            if (obj.type === "text-delta" && typeof obj.delta === "string") {
              acc += obj.delta;
              setMessages((m) => m.map((x) => x.id === aId ? { ...x, text: acc } : x));
            }
          } catch { /* ignore */ }
        }
      }
    } catch (e) {
      setMessages((m) => [...m, {
        id: crypto.randomUUID(), role: "assistant",
        text: "Falha de rede ao contactar o Assistente.",
      }]);
    } finally {
      setBusy(false);
    }
  }, [busy, ctx, messages]);

  const onQuickAction = (cap: typeof CLIENT_CAPABILITIES[number]) => {
    if (!cap.enabled) return;
    const prompt = cap.promptTemplate ?? cap.label;
    setInput(prompt);
  };

  const path = ctx.route.path;
  const hidden = HIDE_ROUTES.some((p) => path === p || (p !== "/" && path.startsWith(p)));
  if (hidden || !user) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Assistente do SISLAC"
        title="Assistente • Ctrl+J"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 h-10 w-10 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:opacity-90 transition"
      >
        <Sparkles className="h-5 w-5" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-[420px] p-0 flex flex-col gap-0"
          data-ai-shell="panel"
        >
          <header className="h-12 px-4 flex items-center justify-between border-b">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Assistente</span>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Fechar">
              <X className="h-4 w-4" />
            </Button>
          </header>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {messages.length === 0 && (
                <>
                  <section>
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                      Ações rápidas
                    </h3>
                    {allowedQuickActions.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Sem ações disponíveis para seu perfil.</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {allowedQuickActions.map((cap) => (
                          <button
                            key={cap.id}
                            onClick={() => onQuickAction(cap)}
                            disabled={!cap.enabled}
                            className="text-left rounded-lg border bg-card p-3 hover:bg-accent transition disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <div className="text-sm font-medium">{cap.label}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">{cap.description}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </section>

                  {suggestions.length > 0 && (
                    <section>
                      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                        Sugestões
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {suggestions.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => send(s.prompt)}
                            className="text-xs rounded-full border px-3 py-1 hover:bg-accent"
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </section>
                  )}
                </>
              )}

              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`rounded-lg p-3 text-sm whitespace-pre-wrap ${
                    m.role === "user" ? "bg-primary/10 ml-8" : "bg-muted mr-8"
                  }`}
                >
                  {m.text || (busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "")}
                </div>
              ))}
            </div>
          </ScrollArea>

          <footer className="border-t p-3">
            <form
              onSubmit={(e) => { e.preventDefault(); send(input); }}
              className="flex items-end gap-2"
            >
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pedir algo..."
                rows={1}
                className="min-h-[40px] resize-none text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
              />
              <Button type="submit" size="icon" disabled={busy || !input.trim()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </footer>
        </SheetContent>
      </Sheet>
    </>
  );
}
