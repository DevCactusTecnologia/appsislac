// Convênios 2.0 — Fase 4
// Store de competências e fechamento mensal de convênios.
//
// Princípios (do SSOT):
//   - Competência é o agrupamento mensal (YYYY-MM) derivado de `periodo_fim`.
//   - Competência fechada NUNCA permite alteração estrutural de fatura/itens/glosas.
//   - Apenas admin/super_admin podem reabrir, e o motivo é obrigatório.
//   - Toda mutação passa por RPC SECURITY DEFINER e gera trilha em `financeiro_audit`.
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/lib/showError";

export interface CompetenciaResumo {
  competencia: string;            // YYYY-MM
  status: "aberta" | "fechada";
  qtdFaturas: number;
  totalFaturado: number;
  totalRecebido: number;
  totalGlosado: number;
  totalGlosadoAberto: number;
  totalReapresentado: number;
  totalCancelado: number;
  saldoPendente: number;
  fechadaEm: string | null;
  abertaEm: string | null;
}

export async function fetchCompetenciasResumo(): Promise<CompetenciaResumo[]> {
  const { data, error } = await supabase
    .from("convenio_competencia_resumo" as never)
    .select("*")
    .order("competencia", { ascending: false });
  if (error) {
    showError(error, { scope: "competenciasStore.fetchResumo", silent: true });
    return [];
  }
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    competencia: String(r.competencia ?? ""),
    status: (r.status === "fechada" ? "fechada" : "aberta") as "aberta" | "fechada",
    qtdFaturas: Number(r.qtd_faturas) || 0,
    totalFaturado: Number(r.total_faturado) || 0,
    totalRecebido: Number(r.total_recebido) || 0,
    totalGlosado: Number(r.total_glosado) || 0,
    totalGlosadoAberto: Number(r.total_glosado_aberto) || 0,
    totalReapresentado: Number(r.total_reapresentado) || 0,
    totalCancelado: Number(r.total_cancelado) || 0,
    saldoPendente: Number(r.saldo_pendente) || 0,
    fechadaEm: (r.fechada_em as string | null) ?? null,
    abertaEm: (r.aberta_em as string | null) ?? null,
  }));
}

export async function fetchCompetenciaAtual(): Promise<CompetenciaResumo | null> {
  const yyyymm = new Date().toISOString().slice(0, 7);
  const { data, error } = await supabase
    .from("convenio_competencia_resumo" as never)
    .select("*")
    .eq("competencia", yyyymm)
    .maybeSingle();
  if (error) {
    showError(error, { scope: "competenciasStore.fetchAtual", silent: true });
    return null;
  }
  if (!data) {
    return {
      competencia: yyyymm, status: "aberta",
      qtdFaturas: 0, totalFaturado: 0, totalRecebido: 0,
      totalGlosado: 0, totalGlosadoAberto: 0, totalReapresentado: 0,
      totalCancelado: 0, saldoPendente: 0,
      fechadaEm: null, abertaEm: null,
    };
  }
  const r = data as Record<string, unknown>;
  return {
    competencia: String(r.competencia ?? yyyymm),
    status: (r.status === "fechada" ? "fechada" : "aberta") as "aberta" | "fechada",
    qtdFaturas: Number(r.qtd_faturas) || 0,
    totalFaturado: Number(r.total_faturado) || 0,
    totalRecebido: Number(r.total_recebido) || 0,
    totalGlosado: Number(r.total_glosado) || 0,
    totalGlosadoAberto: Number(r.total_glosado_aberto) || 0,
    totalReapresentado: Number(r.total_reapresentado) || 0,
    totalCancelado: Number(r.total_cancelado) || 0,
    saldoPendente: Number(r.saldo_pendente) || 0,
    fechadaEm: (r.fechada_em as string | null) ?? null,
    abertaEm: (r.aberta_em as string | null) ?? null,
  };
}

export async function fecharCompetencia(competencia: string, observacao = ""): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc("competencia_fechar" as never, {
    p_competencia: competencia,
    p_observacao: observacao,
  } as never);
  if (error) {
    showError(error, { scope: "competenciasStore.fechar", silent: true });
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function reabrirCompetencia(competencia: string, motivo: string): Promise<{ ok: boolean; error?: string }> {
  const motivoTrim = (motivo || "").trim();
  if (!motivoTrim) return { ok: false, error: "Informe o motivo da reabertura" };
  const { error } = await supabase.rpc("competencia_reabrir" as never, {
    p_competencia: competencia,
    p_motivo: motivoTrim,
  } as never);
  if (error) {
    showError(error, { scope: "competenciasStore.reabrir", silent: true });
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function abrirCompetencia(competencia: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc("competencia_abrir" as never, {
    p_competencia: competencia,
  } as never);
  if (error) {
    showError(error, { scope: "competenciasStore.abrir", silent: true });
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
