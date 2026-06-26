// AI Shell — Assistente do SISLAC.
// Design ChatGPT-like: limpo, espaçoso, moderno. Voz com comandos de navegação.
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Send, Loader2, Mic, Square, ArrowUp, PlusCircle, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

import { useAuth } from "@/contexts/AuthContext";
import { useManifest, discoverCapabilities } from "@/lib/ai/manifestClient";
import { useAIContext, getContextualSuggestions } from "@/lib/ai/contextEngine";
import { supabase } from "@/integrations/supabase/client";

interface Msg { id: string; role: "user" | "assistant"; text: string }

const HIDE_ROUTES = ["/", "/login", "/super-admin", "/inscricao", "/laudo/print", "/imprimir", "/verificar", "/r/"];

// ----- Comandos de voz: navegação ------------------------------------------------
// Mapa simples PT-BR de termos → rota. Avaliado após transcrição (e em texto manual).
const NAV_INTENTS: { rx: RegExp; path: string; label: string }[] = [
  { rx: /\b(atendimento|atendimentos)\b/, path: "/atendimentos", label: "Atendimentos" },
  { rx: /\b(novo atendimento|cadastrar atendimento|criar atendimento)\b/, path: "/atendimentos/novo", label: "Novo atendimento" },
  { rx: /\b(coleta|registrar coleta)\b/, path: "/registrar-coleta", label: "Coleta" },
  { rx: /\b(analise|análise|analisar amostra|amostras?)\b/, path: "/analisar-amostra", label: "Análise" },
  { rx: /\b(resultados?)\b/, path: "/resultados", label: "Resultados" },
  { rx: /\b(pacientes?)\b/, path: "/pacientes", label: "Pacientes" },
  { rx: /\b(especialistas?|m[eé]dicos?)\b/, path: "/especialistas", label: "Especialistas" },
  { rx: /\b(or[cç]amentos?)\b/, path: "/orcamentos", label: "Orçamentos" },
  { rx: /\b(financeiro|caixa|entradas?|sa[ií]das?)\b/, path: "/financeiro", label: "Financeiro" },
  { rx: /\b(dashboard|in[ií]cio|home|painel)\b/, path: "/dashboard", label: "Dashboard" },
  { rx: /\b(cat[áa]logo|exames)\b/, path: "/configuracoes/exames", label: "Catálogo de exames" },
  { rx: /\b(configura[cç][õo]es|ajustes|prefer[êe]ncias)\b/, path: "/configuracoes", label: "Configurações" },
  { rx: /\b(soroteca|amostras estocadas)\b/, path: "/soroteca", label: "Soroteca" },
  { rx: /\b(auditoria|logs?)\b/, path: "/auditoria", label: "Auditoria" },
];

function parseNavIntent(raw: string): { path: string; label: string } | null {
  const txt = raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  if (!/^(abr[ai]r?|abra|ir|v[áa]|vai|leve|abrir|navegar|mostre|mostrar|acessar|acesse)\b/.test(txt)) return null;
  for (const it of NAV_INTENTS) {
    if (it.rx.test(txt)) return { path: it.path, label: it.label };
  }
  return null;
}

export default function AiShell() {
  const { user } = useAuth();
  const ctx = useAIContext();
  const { manifest } = useManifest();
  const navigate = useNavigate();
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
  // Reconhecimento contínuo (Web Speech API) — hands-free.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const speechRecRef = useRef<any>(null);
  const continuousRef = useRef(false);
  const sendRef = useRef<(t: string) => Promise<void> | void>(() => {});
  const [interimText, setInterimText] = useState("");


  const suggestions = useMemo(
    () => getContextualSuggestions(ctx, discoverCapabilities(manifest, { suggestionsOnly: true })),
    [ctx, manifest],
  );

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

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy]);

  const send = useCallback(async (text: string) => {
    const value = text.trim();
    if (!value || busy) return;

    // 1) Comando de navegação: executa direto, sem chamar o LLM.
    const nav = parseNavIntent(value);
    if (nav) {
      const userMsg: Msg = { id: crypto.randomUUID(), role: "user", text: value };
      const ack: Msg = { id: crypto.randomUUID(), role: "assistant", text: `Abrindo **${nav.label}**…` };
      setMessages((m) => [...m, userMsg, ack]);
      setInput("");
      navigate(nav.path);
      return;
    }

    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", text: value };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setBusy(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
      const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-chat`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          apikey: ANON,
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
            // Navegação automática quando uma tool devolve { navigate: "/rota" }.
            const out = obj.output ?? obj.result ?? obj.toolResult;
            const nav = out && typeof out === "object" ? (out as { navigate?: unknown }).navigate : undefined;
            if (typeof nav === "string" && nav.startsWith("/")) {
              setTimeout(() => navigate(nav), 50);
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
  }, [busy, ctx, messages, navigate]);

  // ===== Microfone (push-to-talk) =====
  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const startRecording = useCallback(async () => {
    if (recording || transcribing || busy) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setMessages((m) => [...m, {
        id: crypto.randomUUID(), role: "assistant",
        text: "Seu navegador não suporta gravação de áudio.",
      }]);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus"
                : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm"
                : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4"
                : "";
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        setRecording(false);
        stopTracks();
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        if (blob.size < 1200) return;
        setTranscribing(true);
        try {
          const { data: session } = await supabase.auth.getSession();
          const token = session.session?.access_token;
          const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
          const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
          const form = new FormData();
          const ext = blob.type.includes("mp4") ? "mp4" : blob.type.includes("mpeg") ? "mp3" : "webm";
          form.append("file", blob, `recording.${ext}`);
          form.append("language", "pt");
          const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-transcribe`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, apikey: ANON },
            body: form,
          });
          const data = await res.json().catch(() => ({}));
          const text: string = (data?.text ?? "").trim();
          if (res.ok && text) {
            await send(text);
          } else {
            setMessages((m) => [...m, {
              id: crypto.randomUUID(), role: "assistant",
              text: res.status === 401
                ? "Sessão expirou. Faça login novamente."
                : "Não consegui entender o áudio. Pode repetir?",
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
      stopTracks();
      setMessages((m) => [...m, {
        id: crypto.randomUUID(), role: "assistant",
        text: "Preciso de permissão para usar o microfone. Verifique as permissões do navegador.",
      }]);
    }
  }, [recording, transcribing, busy, send]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    } else {
      stopTracks();
      setRecording(false);
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

  const canSend = !busy && !recording && !transcribing && input.trim().length > 0;

  return (
    <>
      <button
        type="button"
        aria-label="Assistente do SISLAC"
        title="Assistente • Ctrl+J"
        onClick={() => setOpen(true)}
        className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 sm:bottom-5 sm:right-5 z-40 h-11 w-11 sm:h-12 sm:w-12 rounded-full bg-primary text-primary-foreground shadow-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
      >
        <Sparkles className="h-5 w-5" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-[440px] md:max-w-[480px] p-0 flex flex-col gap-0 bg-background border-l"
          data-ai-shell="panel"
        >
          {/* Header minimalista — botão fechar nativo do Sheet */}
          <header className="h-14 px-3 sm:px-5 flex items-center justify-between border-b shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shrink-0">
                <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
              <div className="leading-tight min-w-0">
                <div className="text-sm font-semibold truncate">Assistente</div>
                <div className="text-[10px] text-muted-foreground truncate">SISLAC Intelligence</div>
              </div>
            </div>
            <div className="pr-8 shrink-0">
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={newConversation}
                  className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground px-2"
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Nova conversa</span>
                  <span className="sm:hidden">Nova</span>
                </Button>
              )}
            </div>
          </header>

          {/* Stream de mensagens */}
          <div ref={scrollRef} className="flex-1 overflow-auto scroll-smooth">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center px-8 text-center">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center mb-5">
                  <Sparkles className="h-7 w-7 text-primary" />
                </div>
                <h2 className="text-lg font-semibold mb-1.5 tracking-tight">Em que posso ajudar?</h2>
                <p className="text-sm text-muted-foreground max-w-[300px] leading-relaxed">
                  Pergunte, peça relatórios, abra páginas por voz ou converse normalmente.
                </p>
                {suggestions.length > 0 && (
                  <div className="mt-7 flex flex-wrap gap-2 justify-center max-w-[360px]">
                    {suggestions.slice(0, 4).map((s) => (
                      <button
                        key={s.id}
                        onClick={() => send(s.prompt)}
                        className="text-xs rounded-full border bg-card px-3.5 py-1.5 hover:bg-accent hover:border-primary/40 transition-all"
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-6 text-[11px] text-muted-foreground/70">
                  Dica: diga <span className="font-medium text-foreground/70">"abra atendimentos"</span> usando o microfone.
                </div>
              </div>
            ) : (
              <div className="px-3 sm:px-5 py-5 sm:py-6 space-y-4 sm:space-y-5">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex gap-2 sm:gap-3 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                  >
                    <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${
                      m.role === "user"
                        ? "bg-muted text-muted-foreground"
                        : "bg-gradient-to-br from-primary to-primary/70 text-primary-foreground"
                    }`}>
                      {m.role === "user"
                        ? <UserIcon className="h-3.5 w-3.5" />
                        : <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />}
                    </div>
                    <div className={`max-w-[85%] sm:max-w-[80%] text-sm leading-relaxed whitespace-pre-wrap break-words ${
                      m.role === "user"
                        ? "rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-3.5 py-2.5"
                        : "text-foreground pt-1"
                    }`}>
                      {m.text || (busy ? <span className="inline-flex gap-1"><span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "0ms" }} /><span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "120ms" }} /><span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "240ms" }} /></span> : "")}
                    </div>
                  </div>
                ))}
                {busy && messages[messages.length - 1]?.role === "user" && (
                  <div className="flex gap-3">
                    <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                      <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
                    </div>
                    <div className="pt-1.5 text-xs text-muted-foreground">pensando…</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Composer */}
          <footer className="border-t bg-background/95 backdrop-blur p-2.5 sm:p-3 pb-[max(0.625rem,env(safe-area-inset-bottom))] shrink-0">
            {(recording || transcribing) && (
              <div className="mb-2 px-2 text-xs text-muted-foreground flex items-center gap-2">
                {recording ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                    </span>
                    Ouvindo… toque no microfone para enviar.
                  </>
                ) : (
                  <><Loader2 className="h-3 w-3 animate-spin" /> Transcrevendo…</>
                )}
              </div>
            )}
            <form
              onSubmit={(e) => { e.preventDefault(); send(input); }}
              className="flex items-end gap-2 rounded-2xl border bg-card focus-within:border-primary/50 focus-within:shadow-sm transition-all px-2 py-1.5"
            >
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={recording ? "Estou ouvindo…" : "Escreva uma mensagem ou use o microfone"}
                rows={3}
                disabled={recording || transcribing}
                className="min-h-[84px] max-h-[280px] resize-y text-sm border-0 focus-visible:ring-0 shadow-none bg-transparent px-2 py-2 leading-relaxed"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
              />
              <div className="flex flex-col items-center gap-1 pb-1">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={toggleMic}
                  disabled={busy || transcribing}
                  aria-label={recording ? "Parar gravação" : "Falar"}
                  title={recording ? "Parar gravação" : "Falar"}
                  className={`h-8 w-8 rounded-full ${recording ? "bg-red-500/10 text-red-600 hover:bg-red-500/15" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {recording ? <Square className="h-3.5 w-3.5 fill-current" /> : <Mic className="h-4 w-4" />}
                </Button>
                <Button
                  type="submit"
                  size="icon"
                  disabled={!canSend}
                  aria-label="Enviar"
                  className="h-8 w-8 rounded-full disabled:opacity-40"
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
                </Button>
              </div>
            </form>
            <div className="mt-2 text-[10px] text-center text-muted-foreground/70">
              O Assistente pode cometer erros. Verifique informações importantes.
            </div>
          </footer>
        </SheetContent>
      </Sheet>
    </>
  );
}
