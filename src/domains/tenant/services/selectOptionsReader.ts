// Reader unificado de dicionários a partir de `public.select_options`.
//
// `select_options` é a fonte canônica única para listas de domínio
// (motivos de cancelamento, motivos de recoleta, formas/destinos de
// pagamento, tipos de despesa, canais de comunicação). As tabelas
// dicionário legadas foram consolidadas/removidas (C.1 + C.3 — 2026-06-13).
// `recoletas_motivos` ainda existe (FK ativa) e é espelhada para
// `select_options` por trigger `trg_fwd_recoletas_motivos`.
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
  /** uuid de select_options.id — chave canônica da nova arquitetura. */
  id: string;
  /** uuid da tabela legada equivalente (ex.: motivos_cancelamento.id).
   *  Use este valor enquanto writes ainda dependem das FKs legadas. */
  legacyId: string | null;
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
    .select("id, legacy_id, valor, label, ordem, ativo, sistema")
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
    legacyId: r.legacy_id ? String(r.legacy_id) : null,
    valor: String(r.valor ?? ""),
    label: String(r.label ?? r.valor ?? ""),
    ordem: Number(r.ordem ?? 0),
    ativo: !!r.ativo,
    sistema: !!r.sistema,
  }));
}
