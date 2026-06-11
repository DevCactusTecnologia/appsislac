// Reader unificado de dicionários a partir de `public.select_options`.
//
// `select_options` é a fonte canônica futura para listas de domínio
// (motivos de cancelamento, motivos de recoleta, formas/destinos de
// pagamento, tipos de despesa, canais de comunicação). Os dicionários
// legados (`motivos_cancelamento`, `recoletas_motivos`,
// `financeiro_*`) continuam recebendo escrita pelas stores existentes;
// triggers `fwd_legacy_dict_to_select_options` mantêm `select_options`
// sincronizada — então este reader sempre vê o estado atual.
//
// Tenant: a RLS de `select_options` já filtra por `tenant_id = current_tenant_id()`
// e expõe linhas globais (`tenant_id IS NULL`) como dicionário compartilhado.
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/lib/showError";

export type DicionarioCategoria =
  | "motivo_cancelamento"
  | "recoleta_motivo"
  | "financeiro_destino_pagamento"
  | "financeiro_forma_pagamento"
  | "financeiro_tipo_despesa"
  | "canais_comunicacao";

export interface DicionarioOption {
  id: string;          // uuid (select_options.id)
  valor: string;       // chave estável
  label: string;       // texto visível
  ordem: number;
  ativo: boolean;
  sistema: boolean;
}

export interface FetchDicionarioParams {
  categoria: DicionarioCategoria;
  ativosOnly?: boolean;
}

export async function fetchDicionario(
  params: FetchDicionarioParams,
): Promise<DicionarioOption[]> {
  let req = supabase
    .from("select_options")
    .select("id, valor, label, ordem, ativo, sistema")
    .eq("categoria", params.categoria)
    .order("ordem", { ascending: true });
  if (params.ativosOnly) req = req.eq("ativo", true);

  const { data, error } = await req;
  if (error) {
    showError(error, { scope: `selectOptionsReader.${params.categoria}`, silent: true });
    return [];
  }
  return (data ?? []).map((r: any) => ({
    id: String(r.id),
    valor: String(r.valor ?? ""),
    label: String(r.label ?? r.valor ?? ""),
    ordem: Number(r.ordem ?? 0),
    ativo: !!r.ativo,
    sistema: !!r.sistema,
  }));
}
