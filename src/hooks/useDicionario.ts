// React Query hook para dicionários unificados (`select_options`).
//
// Read-only — escritas continuam nas stores legadas (motivosCancelamento,
// recoletasMotivos, financeiroListas), que mantêm `select_options`
// sincronizada via trigger `fwd_legacy_dict_to_select_options`.
//
// Use o queryKey padrão `["tenant", tenantId, "dicionario", categoria]`
// para isolar cache por tenant (Cache Governance).
import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchDicionario,
  type DicionarioCategoria,
  type DicionarioOption,
} from "@/domains/tenant/services/selectOptionsReader";

export interface UseDicionarioOptions {
  ativosOnly?: boolean;
  enabled?: boolean;
  staleTime?: number;
}

export function useDicionario(
  categoria: DicionarioCategoria,
  opts: UseDicionarioOptions = {},
) {
  const { user } = useAuth();
  const tenantId = (user as { tenantId?: string } | null)?.tenantId ?? "anon";
  return useQuery<DicionarioOption[]>({
    queryKey: ["tenant", tenantId, "dicionario", categoria, !!opts.ativosOnly],
    queryFn: () => fetchDicionario({ categoria, ativosOnly: opts.ativosOnly }),
    enabled: opts.enabled ?? true,
    staleTime: opts.staleTime ?? 60_000,
  });
}
