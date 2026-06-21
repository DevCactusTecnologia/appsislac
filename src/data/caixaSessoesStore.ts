// Fase 5 — Caixa Operacional (store thin: wrappers RPC + queries)
//
// Modelo aprovado: 1 caixa aberto por unidade. Sem operador. Sem múltiplos turnos.
// Apenas Dinheiro e PIX presencial entram via vinculação automática (trigger DB).
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/lib/showError";

export interface CaixaSessao {
  id: number;
  tenant_id: string;
  unidade_id: string;
  aberta_em: string;
  fechada_em: string | null;
  responsavel_id: string | null;
  fechado_por: string | null;
  valor_abertura: number;
  valor_fechamento: number | null;
  observacoes: string | null;
  status: "aberta" | "fechada";
  created_at: string;
  updated_at: string;
}

export interface CaixaFechamentoResumo {
  sessao_id: number;
  valor_abertura: number;
  entradas_dinheiro: number;
  entradas_pix: number;
  saidas: number;
  saldo_final: number;
  aberta_em: string;
  fechada_em: string;
}

/** Sessão aberta da unidade (ou null). */
export async function getCaixaAbertaPorUnidade(unidadeId: string): Promise<CaixaSessao | null> {
  const { data, error } = await supabase
    .from("caixa_sessoes")
    .select("*")
    .eq("unidade_id", unidadeId)
    .eq("status", "aberta")
    .maybeSingle();
  if (error) {
    showError(error, { scope: "caixa.getAberta" });
    throw error;
  }
  return (data as CaixaSessao) ?? null;
}

export async function abrirCaixa(args: {
  unidadeId: string;
  valorAbertura: number;
  observacoes?: string | null;
}): Promise<CaixaSessao> {
  const { data, error } = await supabase.rpc("caixa_abrir", {
    p_unidade_id: args.unidadeId,
    p_valor_abertura: args.valorAbertura,
    p_observacoes: args.observacoes ?? undefined,
  });
  if (error) {
    showError(error, { scope: "caixa.abrir" });
    throw error;
  }
  return data as unknown as CaixaSessao;
}

export async function fecharCaixa(args: {
  sessaoId: number;
  observacoes?: string | null;
}): Promise<CaixaFechamentoResumo> {
  const { data, error } = await supabase.rpc("caixa_fechar", {
    p_sessao_id: args.sessaoId,
    p_observacoes: args.observacoes ?? undefined,
  });
  if (error) {
    showError(error, { scope: "caixa.fechar" });
    throw error;
  }
  return data as unknown as CaixaFechamentoResumo;
}

/** Histórico (últimas N sessões da unidade). Para auditoria leve. */
export async function listarSessoesDaUnidade(unidadeId: string, limit = 20): Promise<CaixaSessao[]> {
  const { data, error } = await supabase
    .from("caixa_sessoes")
    .select("*")
    .eq("unidade_id", unidadeId)
    .order("aberta_em", { ascending: false })
    .limit(limit);
  if (error) {
    showError(error, { scope: "caixa.listar" });
    throw error;
  }
  return (data ?? []) as CaixaSessao[];
}
