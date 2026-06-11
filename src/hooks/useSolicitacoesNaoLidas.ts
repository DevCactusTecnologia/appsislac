import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { countSolicitacoesNaoLidas } from "@/lib/tenantSite/vitrineStore";
import { toast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";

/**
 * Mantém em tempo real a contagem de solicitações públicas não lidas do tenant
 * atual. Usado pelo badge da sidebar e como gatilho de notificações toast.
 */
export function useSolicitacoesNaoLidas(opts?: { notify?: boolean }): { count: number; refresh: () => void } {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? "";
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!tenantId) { setCount(0); return; }
    const c = await countSolicitacoesNaoLidas(tenantId);
    setCount(c);
  }, [tenantId]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let currentChannel: ReturnType<typeof supabase.channel> | null = null;

    const subscribe = () => {
      if (cancelled) return;
      const name = `solicpub-unread:${tenantId}:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const channel = supabase.channel(name, { config: { private: true } });
      currentChannel = channel;
      channel
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "solicitacoes_publicas", filter: `tenant_id=eq.${tenantId}` },
          (payload: any) => {
            if (opts?.notify && payload.eventType === "INSERT") {
              const row = payload.new as { nome?: string };
              toast({
                title: "Nova solicitação recebida",
                description: row?.nome ? `De: ${row.nome}` : "Um novo pedido chegou pela landing pública.",
              });
            }
            void refresh();
          }
        )
        .subscribe((status, err) => {
          if (cancelled) return;
          if (status === "SUBSCRIBED") {
            attempt = 0;
            logger.info("useSolicitacoesNaoLidas", "realtime SUBSCRIBED", { channel: name });
            return;
          }
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            logger.warn("useSolicitacoesNaoLidas", `realtime ${status}`, {
              channel: name,
              attempt,
              error: err?.message,
            });
            // Backoff exponencial limitado: 1s, 2s, 4s, 8s, 15s (max)
            const delay = Math.min(15000, 1000 * Math.pow(2, attempt));
            attempt += 1;
            try { void supabase.removeChannel(channel); } catch { /* noop */ }
            currentChannel = null;
            retryTimer = setTimeout(subscribe, delay);
          }
        });
    };

    subscribe();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (currentChannel) { try { void supabase.removeChannel(currentChannel); } catch { /* noop */ } }
    };
  }, [tenantId, refresh, opts?.notify]);

  return { count, refresh };
}