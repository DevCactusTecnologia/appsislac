import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { countSolicitacoesNaoLidas } from "@/lib/tenantSite/vitrineStore";
import { toast } from "@/hooks/use-toast";
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel";

/**
 * Mantém em tempo real a contagem de solicitações públicas não lidas do tenant
 * atual. Usado pelo badge da sidebar e como gatilho de notificações toast.
 *
 * Refatorado (Fase 1): usa `useRealtimeChannel` (back-off + pauseOnHidden encapsulados).
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function useSolicitacoesNaoLidas(opts?: { notify?: boolean }): { count: number; refresh: () => void } {
  const { user } = useAuth();
  const rawTenantId = user?.tenantId ?? "";
  // Tenants mock/demo (não-UUID) não existem no banco — evita 400 em query
  // e CHANNEL_ERROR em loop infinito no Realtime.
  const tenantId = UUID_RE.test(rawTenantId) ? rawTenantId : "";
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!tenantId) { setCount(0); return; }
    const c = await countSolicitacoesNaoLidas(tenantId);
    setCount(c);
  }, [tenantId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const notify = !!opts?.notify;
  useRealtimeChannel({
    channelName: tenantId ? `solicpub-unread:${tenantId}` : "solicpub-unread:disabled",
    table: "solicitacoes_publicas",
    filter: tenantId ? `tenant_id=eq.${tenantId}` : undefined,
    enabled: !!tenantId,
    onPayload: (payload) => {
      const p = payload as { eventType?: string; new?: { nome?: string } };
      if (notify && p.eventType === "INSERT") {
        toast({
          title: "Nova solicitação recebida",
          description: p.new?.nome ? `De: ${p.new.nome}` : "Um novo pedido chegou pela landing pública.",
        });
      }
      void refresh();
    },
  });

  return { count, refresh };
}
