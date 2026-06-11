/**
 * Hook genérico de canal Realtime do Supabase.
 *
 * Encapsula o padrão duplicado hoje em:
 *   - src/pages/SolicitacoesSite.tsx (reconnect manual com back-off)
 *   - src/hooks/useSolicitacoesNaoLidas.ts (mesmo padrão)
 *
 * Funcionalidades:
 *   - Subscribe/cleanup automáticos.
 *   - Back-off exponencial em CHANNEL_ERROR/TIMED_OUT (1s → 30s).
 *   - Pausa quando a aba não está visível (economiza socket).
 *
 * Ver: docs/architecture/realtime-reduction-plan.md (Fase 7)
 */

import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel, RealtimeChannelSendResponse } from "@supabase/supabase-js";

type PostgresEvent = "INSERT" | "UPDATE" | "DELETE" | "*";

export interface UseRealtimeChannelOptions {
  /** Nome único do canal (será sufixado com tenantId quando fornecido). */
  channelName: string;
  /** Schema (default: 'public'). */
  schema?: string;
  /** Tabela a observar. */
  table: string;
  /** Evento (default: '*'). */
  event?: PostgresEvent;
  /** Filtro server-side (ex: `tenant_id=eq.${tid}`). */
  filter?: string;
  /** Callback executado a cada payload recebido. */
  onPayload: (payload: unknown) => void;
  /** Habilita/desabilita o canal sem desmontar o componente. */
  enabled?: boolean;
  /** Pausa quando a aba está oculta (default: true). */
  pauseOnHidden?: boolean;
}

const MIN_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

export function useRealtimeChannel(opts: UseRealtimeChannelOptions): void {
  const {
    channelName,
    schema = "public",
    table,
    event = "*",
    filter,
    onPayload,
    enabled = true,
    pauseOnHidden = true,
  } = opts;

  const onPayloadRef = useRef(onPayload);
  onPayloadRef.current = onPayload;

  useEffect(() => {
    if (!enabled) return;

    let channel: RealtimeChannel | null = null;
    let backoff = MIN_BACKOFF_MS;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    const subscribe = () => {
      if (disposed) return;
      if (pauseOnHidden && typeof document !== "undefined" && document.hidden) return;

      const cfg: Record<string, unknown> = { event, schema, table };
      if (filter) cfg.filter = filter;
      channel = supabase.channel(channelName).on(
        "postgres_changes" as never,
        cfg as never,
        (payload: unknown) => {
          try { onPayloadRef.current(payload); } catch { /* swallow */ }
        },
      );

      channel!.subscribe((status: RealtimeChannelSendResponse | string) => {
        if (status === "SUBSCRIBED") {
          backoff = MIN_BACKOFF_MS;
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          if (disposed) return;
          retryTimer = setTimeout(() => {
            if (channel) { try { supabase.removeChannel(channel); } catch { /* noop */ } channel = null; }
            backoff = Math.min(MAX_BACKOFF_MS, backoff * 2);
            subscribe();
          }, backoff);
        }
      });
    };

    const onVisibility = () => {
      if (!pauseOnHidden) return;
      if (typeof document === "undefined") return;
      if (document.hidden) {
        if (channel) { try { supabase.removeChannel(channel); } catch { /* noop */ } channel = null; }
      } else if (!channel) {
        subscribe();
      }
    };

    subscribe();
    if (pauseOnHidden && typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibility);
    }

    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisibility);
      if (channel) { try { supabase.removeChannel(channel); } catch { /* noop */ } }
    };
  }, [channelName, schema, table, event, filter, enabled, pauseOnHidden]);
}
