import { useCallback, useState } from "react";
import { useConversation } from "@elevenlabs/react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const AGENT_ID = "agent_2801kw31qjftetpbefenctpfnm8n";

/**
 * Assistente SISLAC — Agente conversacional ElevenLabs (público, WebRTC).
 * Botão flutuante global.
 */
export function AssistenteSISLAC() {
  const [connecting, setConnecting] = useState(false);

  const conversation = useConversation({
    onConnect: () => toast.success("Assistente SISLAC conectado"),
    onDisconnect: () => toast.message("Assistente SISLAC desconectado"),
    onError: (err) => {
      console.error("[AssistenteSISLAC]", err);
      toast.error("Falha na conexão com o Assistente SISLAC");
    },
  });

  const isConnected = conversation.status === "connected";
  const isSpeaking = conversation.isSpeaking;

  const start = useCallback(async () => {
    if (connecting || isConnected) return;
    setConnecting(true);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      await conversation.startSession({
        agentId: AGENT_ID,
        connectionType: "webrtc",
      });
    } catch (e) {
      console.error("[AssistenteSISLAC] start", e);
      toast.error("Permita o microfone para falar com o Assistente SISLAC");
    } finally {
      setConnecting(false);
    }
  }, [conversation, connecting, isConnected]);

  const stop = useCallback(async () => {
    await conversation.endSession();
  }, [conversation]);

  const onClick = isConnected ? stop : start;
  const label = isConnected ? "Encerrar Assistente SISLAC" : "Falar com o Assistente SISLAC";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "fixed bottom-4 left-4 z-40 h-10 w-10 rounded-lg",
        "flex items-center justify-center border border-border",
        "bg-background text-foreground shadow-sm hover:bg-accent transition-colors",
        isConnected && "bg-primary text-primary-foreground border-primary hover:bg-primary/90",
        isSpeaking && "animate-pulse",
      )}
    >
      {connecting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isConnected ? (
        <MicOff className="h-4 w-4" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </button>
  );
}

export default AssistenteSISLAC;
