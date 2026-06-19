// ============================================================
// Hook: useConvenioFaturas  (Financeiro V2 — Fase 7, Convênios)
// ------------------------------------------------------------
// Lista as faturas de convênio (`convenio_faturas`) do tenant atual.
// Read-only. Usado pela aba dedicada "Convênios".
// ============================================================
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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
  status: string;            // "aberta" | "paga" | "cancelada" (livre)
  forma_pagamento: string | null;
  data_pagamento: string | null;
  created_at: string;
}

export function useConvenioFaturas(enabled = true) {
  const { user, currentTenantId } = useAuth() as any;

  return useQuery<ConvenioFaturaRow[]>({
    queryKey: ["tenant", currentTenantId, "convenio_faturas"],
    enabled: enabled && !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("convenio_faturas")
        .select(`
          id, codigo, convenio_id, periodo_inicio, periodo_fim,
          subtotal, desconto, total, status, forma_pagamento,
          data_pagamento, created_at,
          convenios:convenio_id ( nome )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        id: r.id,
        codigo: r.codigo,
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
      })) as ConvenioFaturaRow[];
    },
  });
}
