// Hook: useConvenioFaturas — Faturas de convênio do tenant.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { logger } from "@/lib/logger";

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
  status: string;
  forma_pagamento: string | null;
  data_pagamento: string | null;
  created_at: string;
}

export function useConvenioFaturas(enabled = true, limit = 100) {
  const { user } = useAuth();
  const tenantId = user?.tenantId;

  return useQuery<ConvenioFaturaRow[]>({
    queryKey: ["tenant", tenantId, "convenio_faturas"],
    enabled: enabled && !!user && !!tenantId,
    staleTime: 30_000,
    queryFn: async () => {
      if (!tenantId) throw new Error("Tenant ID ausente");
      const { data, error } = await supabase
        .from("convenio_faturas")
        .select(`
          id, codigo, convenio_id, periodo_inicio, periodo_fim,
          subtotal, desconto, total, status, forma_pagamento,
          data_pagamento, created_at, tenant_id,
          convenios:convenio_id ( nome )
        `)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        logger.warn("useConvenioFaturas", error.message);
        throw error;
      }

      const rows = (data ?? []) as any[];
      return rows.map((r): ConvenioFaturaRow => ({
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
      }));
    },
    retry: (failureCount, error: any) => {
      if (error?.message?.includes("permission")) return false;
      return failureCount < 3;
    },
  });
}
