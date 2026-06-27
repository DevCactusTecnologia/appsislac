// Assistente SISLAC — texto + voz 100% Lovable AI Gateway.
// - Texto: streaming via edge function ai-chat (Gemini + skills do servidor).
// - Voz: MediaRecorder → ai-transcribe (STT) → ai-chat → ai-speak (TTS).
// - Comandos rápidos (navegação) interceptados localmente para resposta instantânea.
// Zero dependência de ElevenLabs ou qualquer provedor externo.

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Loader2, MessageCircle, Mic, Send, Sparkles, Square, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AssistantMode = "voice" | "text";
type ChatMessage = { role: "user" | "agent"; message: string };

/** Mapa de navegação amigável → caminho. */
const ROUTE_MAP: Record<string, { path: string; name: string }> = {
  dashboard: { path: "/dashboard", name: "dashboard" },
  atendimentos: { path: "/atendimentos", name: "atendimentos" },
  novo_atendimento: { path: "/atendimentos/novo", name: "novo atendimento" },
  coleta: { path: "/registrar-coleta", name: "coleta" },
  analise: { path: "/analisar-amostra", name: "análise de amostras" },
  resultados: { path: "/resultados", name: "resultados" },
  pacientes: { path: "/pacientes", name: "pacientes" },
  orcamentos: { path: "/orcamentos", name: "orçamentos" },
  lab_apoio: { path: "/lab-apoio", name: "lab apoio" },
  auditoria: { path: "/auditoria", name: "auditoria" },
  especialistas: { path: "/especialistas", name: "especialistas" },
  producao: { path: "/relatorios/producao", name: "produção" },
  impressao: { path: "/relatorios/impressao", name: "impressão" },
};

type LocalIntent = { reply: string; run: () => void | Promise<void> };

/** Atalho local para comandos triviais — evita round-trip no LLM. */
function parseLocalIntent(raw: string, navigate: (p: string) => void): LocalIntent | null {
  const t = raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  if (!t) return null;

  if (/\b(novo|criar|cadastrar|abrir novo)\b.*\batendimento/.test(t) || /^novo atendimento/.test(t)) {
    return { reply: "Abrindo novo atendimento.", run: () => navigate("/atendimentos/novo") };
  }

  const navMap: Array<{ re: RegExp; path: string; name: string }> = [
    { re: /\batendimento(s)?\b/, path: "/atendimentos", name: "atendimentos" },
    { re: /\borcament/, path: "/orcamentos", name: "orçamentos" },
    { re: /\bpaciente/, path: "/pacientes", name: "pacientes" },
    { re: /\bresultado(s)?\b/, path: "/resultados", name: "resultados" },
    { re: /\bcoleta/, path: "/registrar-coleta", name: "coleta" },
    { re: /\b(analise|analisar)/, path: "/analisar-amostra", name: "análise de amostras" },
    { re: /\b(dashboard|inicio|home|painel)/, path: "/dashboard", name: "dashboard" },
    { re: /\b(lab.?apoio|apoio)/, path: "/lab-apoio", name: "lab apoio" },
    { re: /\bauditoria/, path: "/auditoria", name: "auditoria" },
    { re: /\bespecialista/, path: "/especialistas", name: "especialistas" },
    { re: /\bproducao/, path: "/relatorios/producao", name: "produção" },
    { re: /\bimpress/, path: "/relatorios/impressao", name: "impressão" },
  ];

  const isNav = /\b(abr(?:ir|a)|ir|vai|vamos|mostr|ver|exib|list|acess|entrar|ativ|abre)\b/.test(t);
  const startsWithSection = /^(atendimento|orcament|paciente|resultado|coleta|dashboard|painel|analise|auditoria|especialista|producao|impress|lab)/.test(t);
  if (isNav || startsWithSection) {
    for (const m of navMap) {
      if (m.re.test(t)) return { reply: `Abrindo ${m.name}.`, run: () => navigate(m.path) };
    }
  }
  return null;
}

function normalizeErrorMessage(error: unknown): string {
  if (!error) return "Erro desconhecido";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return String(error);
}

/** Streaming SSE da edge function `ai-chat` — acesso completo às skills do servidor. */
async function streamAiChat(opts: {
  messages: Array<{ role: "user" | "assistant"; text: string }>;
  routePath: string;
  onDelta: (chunk: string) => void;
}): Promise<string> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? anonKey;

  const uiMessages = opts.messages.map((m) => ({
    id: crypto.randomUUID(),
    role: m.role,
    parts: [{ type: "text", text: m.text }],
  }));

  const res = await fetch(`${supabaseUrl}/functions/v1/ai-chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
    },
    body: JSON.stringify({
      messages: uiMessages,
      context: { route: { path: opts.routePath } },
    }),
  });

  if (!res.ok || !res.body) {
    throw new Error((await res.text().catch(() => "")) || `ai-chat ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const event = JSON.parse(data) as { type?: string; delta?: string; textDelta?: string };
        const delta = event.delta ?? event.textDelta;
        if ((event.type === "text-delta" || event.type === "text") && typeof delta === "string") {
          full += delta;
          opts.onDelta(delta);
        }
      } catch { /* heartbeat */ }
    }
  }
  return full;
}

/** Reproduz mp3 base64 — usado para falar a resposta no modo voz. */
async function speak(text: string): Promise<void> {
  if (!text.trim()) return;
  const { data, error } = await supabase.functions.invoke("ai-speak", { body: { text } });
  if (error || !data?.audio) throw error ?? new Error("Falha ao sintetizar voz");
  const audio = new Audio(`data:${data.mime ?? "audio/mpeg"};base64,${data.audio}`);
  await audio.play().catch(() => { /* autoplay bloqueado */ });
  await new Promise<void>((resolve) => {
    audio.onended = () => resolve();
    audio.onerror = () => resolve();
  });
}

export function AssistenteSISLAC() {
  const navigate = useNavigate();
  const location = useLocation();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  const [mode, setMode] = useState<AssistantMode>("text");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const pushUser = (text: string) =>
    setChatMessages((c) => [...c.slice(-30), { role: "user", message: text }]);
  const pushAgent = (text: string) =>
    setChatMessages((c) => [...c.slice(-30), { role: "agent", message: text }]);

  /** Pipeline: texto → intent local → (se nada) ai-chat streaming. Retorna a resposta final. */
  const runText = useCallback(async (text: string): Promise<string> => {
    const intent = parseLocalIntent(text, navigateRef.current);
    if (intent) {
      await intent.run();
      pushAgent(intent.reply);
      return intent.reply;
    }

    setSending(true);
    pushAgent("");
    try {
      const history = [
        ...chatMessages,
        { role: "user" as const, message: text },
      ].map((m) => ({
        role: m.role === "user" ? ("user" as const) : ("assistant" as const),
        text: m.message,
      }));
      const full = await streamAiChat({
        messages: history,
        routePath: location.pathname,
        onDelta: (chunk) => {
          setChatMessages((current) => {
            const next = [...current];
            const last = next[next.length - 1];
            if (last && last.role === "agent") {
              next[next.length - 1] = { ...last, message: last.message + chunk };
            }
            return next;
          });
        },
      });
      const finalText = full.trim() || "Pronto.";
      if (!full.trim()) {
        setChatMessages((current) => {
          const last = current[current.length - 1];
          if (last && last.role === "agent" && !last.message.trim()) {
            return [...current.slice(0, -1), { role: "agent", message: finalText }];
          }
          return current;
        });
      }
      return finalText;
    } catch (error) {
      const msg = `Não consegui responder: ${normalizeErrorMessage(error)}`;
      setChatMessages((current) => {
        const next = [...current];
        const last = next[next.length - 1];
        if (last && last.role === "agent" && !last.message) {
          next[next.length - 1] = { role: "agent", message: msg };
        } else {
          next.push({ role: "agent", message: msg });
        }
        return next;
      });
      return msg;
    } finally {
      setSending(false);
    }
  }, [chatMessages, location.pathname]);

  // ===================== Modo Texto =====================
  const sendTextMessage = useCallback(async () => {
    const text = chatInput.trim();
    if (!text || sending) return;
    setChatInput("");
    pushUser(text);
    await runText(text);
  }, [chatInput, sending, runText]);

  // ===================== Modo Voz =====================
  const stopRecording = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    setRecording(false);
  }, []);

  const startRecording = useCallback(async () => {
    if (recording || processing) return;
    setMode("voice");
    setChatOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recorderRef.current = rec;
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || "audio/webm" });
        chunksRef.current = [];
        if (blob.size < 2048) { toast.info("Gravação muito curta — tente novamente."); return; }
        setProcessing(true);
        try {
          const ext = blob.type.includes("mp4") ? "mp4" : blob.type.includes("wav") ? "wav" : "webm";
          const form = new FormData();
          form.append("file", blob, `recording.${ext}`);
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
          const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token ?? anonKey;
          const res = await fetch(`${supabaseUrl}/functions/v1/ai-transcribe`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
            body: form,
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(json?.message || `STT ${res.status}`);
          const transcript: string = (json?.text ?? "").trim();
          if (!transcript) { toast.info("Não entendi o áudio."); return; }
          pushUser(transcript);
          const reply = await runText(transcript);
          await speak(reply).catch((e) => console.warn("[Assistente] speak", e));
        } catch (e) {
          toast.error("Falha ao processar voz", { description: normalizeErrorMessage(e) });
        } finally {
          setProcessing(false);
        }
      };
      rec.start();
      setRecording(true);
    } catch (e) {
      toast.error("Microfone indisponível", { description: normalizeErrorMessage(e) });
      setRecording(false);
    }
  }, [recording, processing, runText]);

  useEffect(() => () => {
    // cleanup ao desmontar
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const toggleMic = () => (recording ? stopRecording() : startRecording());
  const openChat = () => { setMode("text"); setChatOpen(true); };

  const statusLabel = recording ? "Ouvindo…" : processing ? "Processando…" : sending ? "Pensando…" : "Pronto";

  return (
    <>
      {chatOpen && (
        <div className="fixed bottom-16 right-4 z-40 w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-border/70 bg-background/95 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                {processing || sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
              </span>
              <div>
                <p className="text-sm font-semibold leading-none">Assistente SISLAC</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{statusLabel}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant={recording ? "default" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={toggleMic}
                aria-label={recording ? "Parar gravação" : "Falar"}
                title={recording ? "Parar (clique para enviar)" : "Falar"}
              >
                {recording ? <Square className="h-3.5 w-3.5 fill-current" /> : <Mic className="h-4 w-4" />}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => { stopRecording(); setChatOpen(false); }}
                aria-label="Fechar Assistente"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="max-h-[360px] min-h-[220px] space-y-3 overflow-y-auto px-4 py-3">
            {!chatMessages.length && (
              <p className="text-xs text-muted-foreground">
                Digite ou fale: "abrir atendimentos", "listar pacientes devedores", "abrir resultado 12345".
              </p>
            )}
            {chatMessages.map((item, index) => (
              <div key={`${item.role}-${index}`} className={cn("flex", item.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[82%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap",
                  item.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                )}>
                  {item.message || (sending ? "…" : "")}
                </div>
              </div>
            ))}
          </div>

          <form
            className="flex gap-2 border-t border-border/70 p-3"
            onSubmit={(event) => { event.preventDefault(); void sendTextMessage(); }}
          >
            <Input
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              placeholder="Digite um comando..."
              className="h-10"
              autoFocus
            />
            <Button type="submit" size="icon" disabled={sending || !chatInput.trim()} aria-label="Enviar mensagem">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={chatOpen ? toggleMic : openChat}
        aria-label="Assistente SISLAC"
        title="Assistente SISLAC"
        className={cn(
          "fixed bottom-4 right-4 z-40 h-10 w-10 rounded-full",
          "flex items-center justify-center border border-border/60",
          "bg-muted/60 text-muted-foreground backdrop-blur-sm shadow-sm",
          "hover:bg-muted hover:text-foreground transition-all",
          (recording || processing) && "bg-primary/10 text-primary border-primary/30",
          recording && "ring-2 ring-primary/40 ring-offset-2 ring-offset-background animate-pulse",
        )}
      >
        {processing || sending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : recording ? (
          <Square className="h-3.5 w-3.5 fill-current" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
      </button>
    </>
  );
}

export default AssistenteSISLAC;
