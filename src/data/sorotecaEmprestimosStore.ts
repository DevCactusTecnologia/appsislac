/**
 * Soroteca — Empréstimos de Amostras (Fase 6)
 *
 * Workflow:
 *   PENDENTE → APROVADO → RETIRADO → DEVOLVIDO
 *   PENDENTE → REJEITADO | CANCELADO
 *   APROVADO → CANCELADO
 *
 * Regra: cada amostra pode ter no máximo 1 empréstimo ATIVO
 * (PENDENTE/APROVADO/RETIRADO) — garantido por índice único parcial.
 */

import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/lib/showError";

export type EmprestimoStatus =
  | "PENDENTE"
  | "APROVADO"
  | "REJEITADO"
  | "RETIRADO"
  | "DEVOLVIDO"
  | "CANCELADO";

export const EMPRESTIMO_STATUS_ATIVOS: EmprestimoStatus[] = [
  "PENDENTE",
  "APROVADO",
  "RETIRADO",
];

export interface AmostraEmprestimo {
  id: string;
  tenant_id: string;
  amostra_id: string;
  status: EmprestimoStatus;

  solicitante_user_id: string | null;
  solicitante_nome: string;
  destinatario_nome: string;
  motivo: string;
  prazo_devolucao: string | null;
  observacao_solicitacao: string | null;
  solicitado_em: string;

  aprovador_user_id: string | null;
  aprovador_nome: string | null;
  decidido_em: string | null;
  motivo_rejeicao: string | null;

  retirado_em: string | null;
  retirado_por_user_id: string | null;
  retirado_por_nome: string | null;

  devolvido_em: string | null;
  devolvido_por_user_id: string | null;
  devolvido_por_nome: string | null;
  observacao_devolucao: string | null;

  cancelado_em: string | null;
  motivo_cancelamento: string | null;

  created_at: string;
  updated_at: string;
}

async function nomeUsuarioAtual(): Promise<{ id: string | null; nome: string }> {
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
// SOLICITAR
// ---------------------------------------------------------------------------
export async function solicitarEmprestimo(input: {
  amostraId: string;
  destinatarioNome: string;
  motivo: string;
  prazoDevolucao?: string | null;
  observacao?: string | null;
}): Promise<{ ok: boolean; emprestimo?: AmostraEmprestimo; error?: string }> {
  const destinatario = input.destinatarioNome.trim();
  const motivo = input.motivo.trim();
  if (!destinatario) return { ok: false, error: "Informe o destinatário." };
  if (!motivo) return { ok: false, error: "Informe o motivo do empréstimo." };

  // tenant_id é resolvido server-side via RLS — buscamos do registro da amostra.
  const { data: amostra, error: errAm } = await supabase
    .from("amostras")
    .select("id, tenant_id, status")
    .eq("id", input.amostraId)
    .maybeSingle();
  if (errAm || !amostra) return { ok: false, error: "Amostra não encontrada." };
  if (amostra.status === "DESCARTADA") {
    return { ok: false, error: "Amostra descartada não pode ser emprestada." };
  }

  const me = await nomeUsuarioAtual();

  const { data, error } = await supabase
    .from("amostra_emprestimos")
    .insert({
      amostra_id: input.amostraId,
      tenant_id: amostra.tenant_id,
      status: "PENDENTE",
      solicitante_user_id: me.id,
      solicitante_nome: me.nome,
      destinatario_nome: destinatario,
      motivo,
      prazo_devolucao: input.prazoDevolucao || null,
      observacao_solicitacao: input.observacao?.trim() || null,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Já existe um empréstimo ativo para esta amostra." };
    }
    showError(error, { scope: "soroteca.emprestimos.solicitar", silent: true });
    return { ok: false, error: error.message };
  }
  return { ok: true, emprestimo: data as AmostraEmprestimo };
}

// ---------------------------------------------------------------------------
// APROVAR / REJEITAR
// ---------------------------------------------------------------------------
export async function aprovarEmprestimo(id: string): Promise<{ ok: boolean; error?: string }> {
  const me = await nomeUsuarioAtual();
  const { error } = await supabase
    .from("amostra_emprestimos")
    .update({
      status: "APROVADO",
      aprovador_user_id: me.id,
      aprovador_nome: me.nome,
      decidido_em: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "PENDENTE");
  if (error) {
    showError(error, { scope: "soroteca.emprestimos.aprovar", silent: true });
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function rejeitarEmprestimo(
  id: string,
  motivo: string,
): Promise<{ ok: boolean; error?: string }> {
  const m = motivo.trim();
  if (!m) return { ok: false, error: "Informe o motivo da rejeição." };
  const me = await nomeUsuarioAtual();
  const { error } = await supabase
    .from("amostra_emprestimos")
    .update({
      status: "REJEITADO",
      aprovador_user_id: me.id,
      aprovador_nome: me.nome,
      decidido_em: new Date().toISOString(),
      motivo_rejeicao: m,
    })
    .eq("id", id)
    .eq("status", "PENDENTE");
  if (error) {
    showError(error, { scope: "soroteca.emprestimos.rejeitar", silent: true });
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// RETIRADA / DEVOLUÇÃO
// ---------------------------------------------------------------------------
export async function registrarRetirada(id: string): Promise<{ ok: boolean; error?: string }> {
  const me = await nomeUsuarioAtual();
  const { error } = await supabase
    .from("amostra_emprestimos")
    .update({
      status: "RETIRADO",
      retirado_em: new Date().toISOString(),
      retirado_por_user_id: me.id,
      retirado_por_nome: me.nome,
    })
    .eq("id", id)
    .eq("status", "APROVADO");
  if (error) {
    showError(error, { scope: "soroteca.emprestimos.retirar", silent: true });
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function registrarDevolucao(
  id: string,
  observacao?: string,
): Promise<{ ok: boolean; error?: string }> {
  const me = await nomeUsuarioAtual();
  const { error } = await supabase
    .from("amostra_emprestimos")
    .update({
      status: "DEVOLVIDO",
      devolvido_em: new Date().toISOString(),
      devolvido_por_user_id: me.id,
      devolvido_por_nome: me.nome,
      observacao_devolucao: observacao?.trim() || null,
    })
    .eq("id", id)
    .eq("status", "RETIRADO");
  if (error) {
    showError(error, { scope: "soroteca.emprestimos.devolver", silent: true });
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// CANCELAR
// ---------------------------------------------------------------------------
export async function cancelarEmprestimo(
  id: string,
  motivo: string,
): Promise<{ ok: boolean; error?: string }> {
  const m = motivo.trim();
  if (!m) return { ok: false, error: "Informe o motivo do cancelamento." };
  const { error } = await supabase
    .from("amostra_emprestimos")
    .update({
      status: "CANCELADO",
      cancelado_em: new Date().toISOString(),
      motivo_cancelamento: m,
    })
    .eq("id", id)
    .in("status", ["PENDENTE", "APROVADO"]);
  if (error) {
    showError(error, { scope: "soroteca.emprestimos.cancelar", silent: true });
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// CONSULTAS
// ---------------------------------------------------------------------------
export interface EmprestimoListaFiltros {
  status?: EmprestimoStatus[];
  search?: string;
  amostraId?: string;
}

export async function listarEmprestimos(
  filtros: EmprestimoListaFiltros = {},
): Promise<AmostraEmprestimo[]> {
  let q = supabase
    .from("amostra_emprestimos")
    .select("*")
    .order("solicitado_em", { ascending: false })
    .limit(500);
  if (filtros.status && filtros.status.length > 0) q = q.in("status", filtros.status);
  if (filtros.amostraId) q = q.eq("amostra_id", filtros.amostraId);
  if (filtros.search && filtros.search.trim()) {
    const s = filtros.search.trim().replace(/[%]/g, "");
    q = q.or(
      `destinatario_nome.ilike.%${s}%,solicitante_nome.ilike.%${s}%,motivo.ilike.%${s}%`,
    );
  }
  const { data, error } = await q;
  if (error) {
    showError(error, { scope: "soroteca.emprestimos.listar", silent: true });
    return [];
  }
  return (data ?? []) as AmostraEmprestimo[];
}

export async function getEmprestimoAtivoPorAmostra(
  amostraId: string,
): Promise<AmostraEmprestimo | null> {
  const { data } = await supabase
    .from("amostra_emprestimos")
    .select("*")
    .eq("amostra_id", amostraId)
    .in("status", EMPRESTIMO_STATUS_ATIVOS)
    .maybeSingle();
  return (data as AmostraEmprestimo) ?? null;
}

/** Empréstimos com prazo de devolução vencido (status RETIRADO e prazo < hoje). */
export async function contarEmprestimosVencidos(): Promise<number> {
  const hoje = new Date().toISOString().slice(0, 10);
  const { count } = await supabase
    .from("amostra_emprestimos")
    .select("id", { count: "exact", head: true })
    .eq("status", "RETIRADO")
    .lt("prazo_devolucao", hoje);
  return count ?? 0;
}

export function emprestimoStatusLabel(s: EmprestimoStatus): string {
  return {
    PENDENTE: "Pendente",
    APROVADO: "Aprovado",
    REJEITADO: "Rejeitado",
    RETIRADO: "Retirado",
    DEVOLVIDO: "Devolvido",
    CANCELADO: "Cancelado",
  }[s];
}

export function emprestimoStatusBadge(s: EmprestimoStatus): string {
  return {
    PENDENTE: "bg-amber-500/10 text-amber-700 border-amber-500/30",
    APROVADO: "bg-blue-500/10 text-blue-700 border-blue-500/30",
    REJEITADO: "bg-red-500/10 text-red-700 border-red-500/30",
    RETIRADO: "bg-violet-500/10 text-violet-700 border-violet-500/30",
    DEVOLVIDO: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
    CANCELADO: "bg-muted text-muted-foreground border-border",
  }[s];
}

export function emprestimoVencido(e: AmostraEmprestimo): boolean {
  if (e.status !== "RETIRADO") return false;
  if (!e.prazo_devolucao) return false;
  return new Date(e.prazo_devolucao).getTime() < Date.now();
}
