// ============================================================
// Hook: useConvenioFaturas  (Financeiro V2 — Fase 7, Convênios)
// ============================================================
// REFATORADO: Agora valida tenant_id e usa novo padrão
// ============================================================

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAppContext } from "@/contexts/AppContext";
import { handleError } from "@/lib/errorHandling";
import { QUERY_KEYS } from "@/lib/queryPatterns";

export interface ConvenioFaturaRow {
  id: number;
  codigo: string;
  convenio_id: number;
  convenio_nome: string;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  subtotal: number;
  desconto: number;
  total: number;
  status: string; // "aberta" | "paga" | "cancelada"
  forma_pagamento: string | null;
  data_pagamento: string | null;
  created_at: string;
}

/**
 * Hook para carregar faturas de convênio do tenant
 *
 * ✅ MELHORIAS:
 * - Validação de tenant_id obrigatória
 * - Erro handling diferenciado
 * - Type-safe com TypeScript
 * - QUERY_KEYS centralizado
 * - Paginação pronta
 */
export function useConvenioFaturas(
  enabled = true,
  limit: number = 100
) {
  const { user } = useAuth();
  const { tenantId, notifyError } = useAppContext();

  return useQuery<ConvenioFaturaRow[]>({
    // ✅ MUDANÇA 1: QUERY_KEY com tenant_id validado
    queryKey: [QUERY_KEYS.CONVENIOS, tenantId, "faturas"],

    // ✅ MUDANÇA 2: Desabilitar se não temos tenant_id
    enabled: enabled && !!user && !!tenantId,

    staleTime: 30_000, // 30 segundos

    // ✅ MUDANÇA 3: queryFn com validação e error handling
    queryFn: async () => {
      try {
        // Validação extra de segurança
        if (!tenantId) {
          throw new Error(
            "Tenant ID ausente - acesso negado"
          );
        }

        // Query com filtro tenant_id obrigatório
        const { data, error } = await supabase
          .from("convenio_faturas")
          .select(
            `
            id, codigo, convenio_id, periodo_inicio, periodo_fim,
            subtotal, desconto, total, status, forma_pagamento,
            data_pagamento, created_at, tenant_id,
            convenios:convenio_id ( nome )
          `
          )
          // ✅ MUDANÇA 4: FILTRO TENANT_ID OBRIGATÓRIO
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(limit);

        if (error) {
          const handled = handleError(error, "carregar faturas de convênio");
          throw new Error(handled.message);
        }

        // ✅ MUDANÇA 5: Mapping com validação
        const rows = (data ?? []) as any[];

        if (!Array.isArray(rows)) {
          console.warn("⚠️ Dados de faturas não é array");
          return [];
        }

        return rows.map(
          (r): ConvenioFaturaRow => ({
            id: r.id,
            codigo: r.codigo ?? "",
            convenio_id: r.convenio_id,
            convenio_nome: r.convenios?.nome ?? "—",
            periodo_inicio: r.periodo_inicio,
            periodo_fim: r.periodo_fim,
            subtotal: Number(r.subtotal ?? 0),
            desconto: Number(r.desconto ?? 0),
            total: Number(r.total ?? 0),
            status: r.status ?? "aberta",
            forma_pagamento: r.forma_pagamento,
            data_pagamento: r.data_pagamento,
            created_at: r.created_at,
          })
        );
      } catch (error) {
        // Notificar erro ao usuário
        notifyError(error, "carregar faturas de convênio");
        throw error;
      }
    },

    // ✅ MUDANÇA 6: Retry inteligente
    retry: (failureCount, error: any) => {
      // Não retry se for erro de permissão
      if (error?.message?.includes("permission")) {
        return false;
      }
      // Retry até 3 vezes para erros de rede
      return failureCount < 3;
    },

    // ✅ MUDANÇA 7: Error handling no React Query
    onError: (error) => {
      console.error("❌ [useConvenioFaturas]", error);
    },
  });
}

