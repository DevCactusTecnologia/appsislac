// AI Shell — Assistente do SISLAC. Fase 2.4: experiência conversacional natural.
// O usuário descreve o que deseja. O Assistente entende. Sem menus, sem cards fixos.
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Sparkles, X, Send, Loader2, Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

import { useAuth } from "@/contexts/AuthContext";
import { useManifest, discoverCapabilities } from "@/lib/ai/manifestClient";
import { useAIContext, getContextualSuggestions } from "@/lib/ai/contextEngine";
import { supabase } from "@/integrations/supabase/client";

interface Msg { id: string; role: "user" | "assistant"; text: string }

const HIDE_ROUTES = ["/", "/login", "/super-admin", "/inscricao", "/laudo/print", "/imprimir", "/verificar", "/r/"];

export default function AiShell() {
  const { user } = useAuth();
  const ctx = useAIContext();
  const { manifest } = useManifest();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Sugestões contextuais surgem APENAS quando há foco real (paciente/atendimento/etc.).
  const suggestions = useMemo(
    () => getContextualSuggestions(ctx, discoverCapabilities(manifest, { suggestionsOnly: true })),
    [ctx, manifest],
  );

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

  // Foco automático no input ao abrir
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy]);

  const send = useCallback(async (text: string) => {
    const value = text.trim();
    if (!value || busy) return;
    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", text: value };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setBusy(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-chat`, {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
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
            ? "Estou recebendo muitas solicitações agora. Tente em alguns instantes."
            : res.status === 402
            ? "Os créditos do Assistente acabaram. Avise o administrador."
            : `Não consegui processar agora (${res.status}).`,
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
    } catch {
      setMessages((m) => [...m, {
        id: crypto.randomUUID(), role: "assistant",
        text: "Tive um problema de conexão. Pode tentar de novo?",
      }]);
    } finally {
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [busy, ctx, messages]);

  // ===== Voz: mesma intenção, mesmo fluxo. =====
  const startRecording = useCallback(async () => {
    if (recording || transcribing || busy) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm"
                 : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4"
                 : "";
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        setRecording(false);
        const tracks = streamRef.current?.getTracks() ?? [];
        tracks.forEach((t) => t.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        if (blob.size < 1500) return; // microfone vazio
        setTranscribing(true);
        try {
          const { data: session } = await supabase.auth.getSession();
          const token = session.session?.access_token;
          const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
          const form = new FormData();
          const ext = blob.type.includes("mp4") ? "mp4" : blob.type.includes("mpeg") ? "mp3" : "webm";
          form.append("file", blob, `recording.${ext}`);
          form.append("language", "pt");
          const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-transcribe`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: form,
          });
          const data = await res.json().catch(() => ({}));
          const text: string = (data?.text ?? "").trim();
          if (res.ok && text) {
            await send(text);
          } else if (!res.ok) {
            setMessages((m) => [...m, {
              id: crypto.randomUUID(), role: "assistant",
              text: "Não consegui entender o áudio. Pode repetir?",
            }]);
          }
        } finally {
          setTranscribing(false);
        }
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
    } catch {
      setMessages((m) => [...m, {
        id: crypto.randomUUID(), role: "assistant",
        text: "Preciso de permissão para usar o microfone.",
      }]);
    }
  }, [recording, transcribing, busy, send]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  }, []);

  const toggleMic = () => { recording ? stopRecording() : startRecording(); };

  const newConversation = () => {
    setMessages([]);
    setInput("");
    setTimeout(() => inputRef.current?.focus(), 30);
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
          <header className="h-12 px-4 flex items-center justify-between border-b shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Assistente</span>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <Button variant="ghost" size="sm" onClick={newConversation} className="h-8 text-xs">
                  Nova conversa
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Fechar">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </header>

          <div ref={scrollRef} className="flex-1 overflow-auto">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center px-6 text-center">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-base font-medium mb-1">Em que posso ajudar hoje?</h2>
                <p className="text-xs text-muted-foreground max-w-[280px]">
                  Descreva o que você precisa. Posso buscar pacientes, abrir resultados, gerar relatórios e muito mais.
                </p>
                {suggestions.length > 0 && (
                  <div className="mt-6 flex flex-wrap gap-1.5 justify-center">
                    {suggestions.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => send(s.prompt)}
                        className="text-xs rounded-full border px-3 py-1 hover:bg-accent transition"
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`text-sm whitespace-pre-wrap leading-relaxed ${
                      m.role === "user"
                        ? "ml-6 rounded-lg bg-primary text-primary-foreground px-3 py-2"
                        : "mr-6 text-foreground"
                    }`}
                  >
                    {m.text || (busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "")}
                  </div>
                ))}
                {busy && messages[messages.length - 1]?.role === "user" && (
                  <div className="mr-6 text-xs text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" /> pensando...
                  </div>
                )}
              </div>
            )}
          </div>

          <footer className="border-t p-3 shrink-0">
            {(recording || transcribing) && (
              <div className="mb-2 text-xs text-muted-foreground flex items-center gap-2">
                {recording ? (
                  <><span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" /> Gravando... toque no microfone para enviar.</>
                ) : (
                  <><Loader2 className="h-3 w-3 animate-spin" /> Transcrevendo áudio...</>
                )}
              </div>
            )}
            <form
              onSubmit={(e) => { e.preventDefault(); send(input); }}
              className="flex items-end gap-2"
            >
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Em que posso ajudar?"
                rows={1}
                disabled={recording || transcribing}
                className="min-h-[40px] max-h-[140px] resize-none text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
              />
              <Button
                type="button"
                size="icon"
                variant={recording ? "destructive" : "ghost"}
                onClick={toggleMic}
                disabled={busy || transcribing}
                aria-label={recording ? "Parar gravação" : "Falar"}
                title={recording ? "Parar gravação" : "Falar"}
              >
                {recording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
              <Button type="submit" size="icon" disabled={busy || !input.trim() || recording || transcribing}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </footer>
        </SheetContent>
      </Sheet>
    </>
  );
}
