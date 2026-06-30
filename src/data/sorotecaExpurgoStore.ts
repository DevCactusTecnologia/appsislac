/**
 * Soroteca — Expurgo Programado (Fase 7)
 *
 * Workflow:
 *   PROGRAMADO → EM_EXECUCAO → CONCLUIDO
 *   PROGRAMADO → CANCELADO
 *
 * Itens: PENDENTE → EXECUTADO | PULADO
 * Ao executar item, a amostra é marcada DESCARTADA e a alocação ativa é liberada
 * (trigger aplicar_expurgo_amostra).
 */

import { db as supabase } from "@/runtime/db";
import { showError } from "@/lib/showError";
import { resolveMaterialNome } from "./materiaisAmostraStore";


export type ExpurgoLoteStatus =
  | "PROGRAMADO"
  | "EM_EXECUCAO"
  | "CONCLUIDO"
  | "CANCELADO";

export type ExpurgoItemStatus = "PENDENTE" | "EXECUTADO" | "PULADO";

export interface ExpurgoLote {
  id: string;
  tenant_id: string;
  titulo: string;
  descricao: string | null;
  data_programada: string;
  status: ExpurgoLoteStatus;
  criterio_material_ids: string[] | null;
  criterio_coleta_ate: string | null;
  criterio_validade_ate: string | null;
  criterio_observacao: string | null;
  total_itens: number;
  total_executados: number;
  total_pulados: number;
  criado_por_user_id: string | null;
  criado_por_nome: string | null;
  concluido_em: string | null;
  cancelado_em: string | null;
  motivo_cancelamento: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpurgoItem {
  id: string;
  tenant_id: string;
  lote_id: string;
  amostra_id: string;
  status: ExpurgoItemStatus;
  snapshot_codigo_barra: string | null;
  snapshot_material: string | null;
  snapshot_localizacao: string | null;
  snapshot_data_coleta: string | null;
  snapshot_data_validade: string | null;
  executado_em: string | null;
  executado_por_user_id: string | null;
  executado_por_nome: string | null;
  motivo_pulo: string | null;
  observacao: string | null;
  created_at: string;
  updated_at: string;
}

async function usuarioAtual(): Promise<{ id: string | null; nome: string }> {
  const { data } = await supabase.auth.getUser();
  const u = data.user;
  if (!u) return { id: null, nome: "—" };
  const nome =
    (u.user_metadata?.full_name as string | undefined) ||
    (u.user_metadata?.name as string | undefined) ||
    u.email ||
    "Usuário";
  return { id: u.id, nome };
}

// ---------------------------------------------------------------------------
// PREVIEW: amostras candidatas a um critério
// ---------------------------------------------------------------------------
export interface ExpurgoCriterio {
  material_ids?: string[];
  coleta_ate?: string | null;
  validade_ate?: string | null;
}

export async function preverCandidatas(criterio: ExpurgoCriterio) {
  // Hardening Soroteca 2.1:
  //  - status='DISPONIVEL' já exclui DESCARTADA / UTILIZADA / VENCIDA.
  //  - exige localização física registrada (defesa contra amostras "perdidas").
  let q = supabase
    .from("amostras")
    .select("id, codigo_barra, localizacao, data_coleta, data_validade, material_id")
    .eq("status", "DISPONIVEL")
    .not("localizacao", "is", null)
    .neq("localizacao", "");

  if (criterio.material_ids && criterio.material_ids.length > 0) {
    q = q.in("material_id", criterio.material_ids);
  }
  if (criterio.coleta_ate) q = q.lte("data_coleta", criterio.coleta_ate);
  if (criterio.validade_ate) q = q.lte("data_validade", criterio.validade_ate);

  const { data, error } = await q.order("data_coleta", { ascending: true }).limit(2000);
  if (error) throw error;

  // Remove já agendadas em lote pendente
  const ids = (data ?? []).map((a) => a.id);
  if (ids.length === 0) return [];

  const { data: jaAgendadas, error: e2 } = await supabase
    .from("expurgo_itens")
    .select("amostra_id")
    .in("amostra_id", ids)
    .eq("status", "PENDENTE");
  if (e2) throw e2;

  const bloq = new Set((jaAgendadas ?? []).map((r) => r.amostra_id));
  return (data ?? []).filter((a) => !bloq.has(a.id));
}

// ---------------------------------------------------------------------------
// CRIAR LOTE com amostras
// ---------------------------------------------------------------------------
export async function criarLote(input: {
  titulo: string;
  descricao?: string;
  data_programada: string;
  criterio: ExpurgoCriterio;
  amostraIds: string[];
}): Promise<ExpurgoLote> {
  try {
    const me = await usuarioAtual();

    const { data: tenantRow, error: tErr } = await supabase.rpc("current_tenant_id");
    if (tErr) throw tErr;
    const tenant_id = tenantRow as unknown as string;

    const { data: lote, error } = await supabase
      .from("expurgo_lotes")
      .insert({
        tenant_id,
        titulo: input.titulo,
        descricao: input.descricao ?? null,
        data_programada: input.data_programada,
        criterio_material_ids: input.criterio.material_ids ?? [],
        criterio_coleta_ate: input.criterio.coleta_ate ?? null,
        criterio_validade_ate: input.criterio.validade_ate ?? null,
        total_itens: input.amostraIds.length,
        criado_por_user_id: me.id,
        criado_por_nome: me.nome,
      })
      .select()
      .single();
    if (error) throw error;

    if (input.amostraIds.length > 0) {
      // pega snapshot
      const { data: amostras, error: aErr } = await supabase
        .from("amostras")
        .select("id, codigo_barra, material_id, localizacao, data_coleta, data_validade")
        .in("id", input.amostraIds);
      if (aErr) throw aErr;

      const itens = (amostras ?? []).map((a) => ({
        tenant_id,
        lote_id: lote.id,
        amostra_id: a.id,
        snapshot_codigo_barra: a.codigo_barra,
        snapshot_material: resolveMaterialNome(a.material_id) || "",
        snapshot_localizacao: a.localizacao,
        snapshot_data_coleta: a.data_coleta,
        snapshot_data_validade: a.data_validade,
      }));


      const { error: iErr } = await supabase.from("expurgo_itens").insert(itens);
      if (iErr) throw iErr;
    }

    return lote as ExpurgoLote;
  } catch (err) {
    showError(err, { scope: "sorotecaExpurgoStore", userMessage: "Erro ao criar lote de expurgo" });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// LISTAR LOTES
// ---------------------------------------------------------------------------
export async function listarLotes(status?: ExpurgoLoteStatus): Promise<ExpurgoLote[]> {
  let q = supabase.from("expurgo_lotes").select("*").order("data_programada", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ExpurgoLote[];
}

export async function obterLote(id: string): Promise<ExpurgoLote | null> {
  const { data, error } = await supabase.from("expurgo_lotes").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data ?? null) as ExpurgoLote | null;
}

export async function listarItens(loteId: string): Promise<ExpurgoItem[]> {
  const { data, error } = await supabase
    .from("expurgo_itens")
    .select("*")
    .eq("lote_id", loteId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ExpurgoItem[];
}

// ---------------------------------------------------------------------------
// EXECUÇÃO
// ---------------------------------------------------------------------------
export async function iniciarExecucao(loteId: string) {
  const { error } = await supabase
    .from("expurgo_lotes")
    .update({ status: "EM_EXECUCAO" })
    .eq("id", loteId)
    .eq("status", "PROGRAMADO");
  if (error) {
    showError(error, { scope: "sorotecaExpurgoStore", userMessage: "Erro ao iniciar execução" });
    throw error;
  }
}

export async function executarItem(itemId: string, observacao?: string) {
  try {
    const me = await usuarioAtual();
    const { error } = await supabase
      .from("expurgo_itens")
      .update({
        status: "EXECUTADO",
        executado_em: new Date().toISOString(),
        executado_por_user_id: me.id,
        executado_por_nome: me.nome,
        observacao: observacao ?? null,
      })
      .eq("id", itemId)
      .eq("status", "PENDENTE");
    if (error) throw error;
  } catch (err) {
    showError(err, { scope: "sorotecaExpurgoStore", userMessage: "Erro ao executar expurgo" });
    throw err;
  }
}

export async function pularItem(itemId: string, motivo: string) {
  try {
    const me = await usuarioAtual();
    const { error } = await supabase
      .from("expurgo_itens")
      .update({
        status: "PULADO",
        executado_em: new Date().toISOString(),
        executado_por_user_id: me.id,
        executado_por_nome: me.nome,
        motivo_pulo: motivo,
      })
      .eq("id", itemId)
      .eq("status", "PENDENTE");
    if (error) throw error;
  } catch (err) {
    showError(err, { scope: "sorotecaExpurgoStore", userMessage: "Erro ao pular item" });
    throw err;
  }
}

export async function concluirLote(loteId: string) {
  const { error } = await supabase
    .from("expurgo_lotes")
    .update({ status: "CONCLUIDO", concluido_em: new Date().toISOString() })
    .eq("id", loteId)
    .in("status", ["PROGRAMADO", "EM_EXECUCAO"]);
  if (error) {
    showError(error, { scope: "sorotecaExpurgoStore", userMessage: "Erro ao concluir lote" });
    throw error;
  }
}

export async function cancelarLote(loteId: string, motivo: string) {
  const { error } = await supabase
    .from("expurgo_lotes")
    .update({
      status: "CANCELADO",
      cancelado_em: new Date().toISOString(),
      motivo_cancelamento: motivo,
    })
    .eq("id", loteId)
    .in("status", ["PROGRAMADO", "EM_EXECUCAO"]);
  if (error) {
    showError(error, { scope: "sorotecaExpurgoStore", userMessage: "Erro ao cancelar lote" });
    throw error;
  }
}
