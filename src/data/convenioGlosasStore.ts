// Convênios 2.0 — Fase 3
// Store de glosas e reapresentações de faturas de convênio.
//
// Princípios (do SSOT):
//   - Glosa NUNCA apaga itens nem fatura.
//   - Glosa parcial: valor_glosado < valor_original.
//   - Glosa total:   valor_glosado = valor_original (item ou fatura inteira).
//   - Reapresentação cria NOVA fatura vinculada (`fatura_origem_id`) com `tentativa+1`.
//   - Toda mutação passa por RPC SECURITY DEFINER e gera trilha em `financeiro_audit`.
import { db as supabase } from "@/runtime/db";
import { showError } from "@/lib/showError";
import type { Tables } from "@/integrations/supabase/types";

type GlosaRow = Tables<"convenio_glosas">;

export interface ConvenioGlosa {
  id: number;
  faturaId: number;
  faturaItemId: number | null;
  valorOriginal: number;
  valorGlosado: number;
  motivo: string;
  status: "aberta" | "reapresentada" | "aceita_perda" | "cancelada";
  reapresentadaEmFaturaId: number | null;
  reapresentadaEm: string | null;
  observacao: string;
  createdAt: string;
}

export interface FaturaResumo {
  faturaId: number;
  codigo: string;
  status: string;
  faturaOrigemId: number | null;
  tentativa: number;
  totalFaturado: number;
  totalRecebido: number;
  totalGlosado: number;
  totalGlosadoAberto: number;
  totalReapresentado: number;
  saldoPendente: number;
}

function fromRow(r: GlosaRow): ConvenioGlosa {
  const status = (r.status ?? "aberta") as ConvenioGlosa["status"];
  return {
    id: Number(r.id),
    faturaId: Number(r.fatura_id),
    faturaItemId: r.fatura_item_id != null ? Number(r.fatura_item_id) : null,
    valorOriginal: Number(r.valor_original) || 0,
    valorGlosado: Number(r.valor_glosado) || 0,
    motivo: r.motivo ?? "",
    status,
    reapresentadaEmFaturaId: r.reapresentada_em_fatura_id != null ? Number(r.reapresentada_em_fatura_id) : null,
    reapresentadaEm: r.reapresentada_em ?? null,
    observacao: r.observacao ?? "",
    createdAt: r.created_at,
  };
}

/** Lista todas as glosas de uma fatura (incluindo já reapresentadas/canceladas). */
export async function fetchGlosasDaFatura(faturaId: number): Promise<ConvenioGlosa[]> {
  const { data, error } = await supabase
    .from("convenio_glosas")
    .select("*")
    .eq("fatura_id", faturaId)
    .order("created_at", { ascending: false });
  if (error) {
    showError(error, { scope: "convenioGlosasStore.fetchGlosasDaFatura", silent: true });
    return [];
  }
  return (data ?? []).map(fromRow);
}

/** Resumo SSOT (faturado/recebido/glosado/reapresentado/saldo). */
export async function fetchResumoFatura(faturaId: number): Promise<FaturaResumo | null> {
  const { data, error } = await supabase
    .from("convenio_fatura_resumo")
    .select("*")
    .eq("fatura_id", faturaId)
    .maybeSingle();
  if (error || !data) {
    if (error) showError(error, { scope: "convenioGlosasStore.fetchResumoFatura", silent: true });
    return null;
  }
  return {
    faturaId: Number(data.fatura_id),
    codigo: data.codigo ?? "",
    status: data.status ?? "aberta",
    faturaOrigemId: data.fatura_origem_id != null ? Number(data.fatura_origem_id) : null,
    tentativa: Number(data.tentativa) || 1,
    totalFaturado: Number(data.total_faturado) || 0,
    totalRecebido: Number(data.total_recebido) || 0,
    totalGlosado: Number(data.total_glosado) || 0,
    totalGlosadoAberto: Number(data.total_glosado_aberto) || 0,
    totalReapresentado: Number(data.total_reapresentado) || 0,
    saldoPendente: Number(data.saldo_pendente) || 0,
  };
}

/** Cadeia de tentativas de uma fatura (raiz + reapresentações). */
export async function fetchCadeiaReapresentacao(faturaId: number): Promise<FaturaResumo[]> {
  // Descobre a raiz: ou ela é raiz, ou aponta para uma.
  const { data: head } = await supabase
    .from("convenio_faturas")
    .select("id, fatura_origem_id")
    .eq("id", faturaId)
    .maybeSingle();
  if (!head) return [];
  const raizId = head.fatura_origem_id ?? head.id;
  const { data, error } = await supabase
    .from("convenio_fatura_resumo")
    .select("*")
    .or(`fatura_id.eq.${raizId},fatura_origem_id.eq.${raizId}`)
    .order("tentativa", { ascending: true });
  if (error) {
    showError(error, { scope: "convenioGlosasStore.fetchCadeia", silent: true });
    return [];
  }
  return (data ?? []).map((d) => ({
    faturaId: Number(d.fatura_id),
    codigo: d.codigo ?? "",
    status: d.status ?? "aberta",
    faturaOrigemId: d.fatura_origem_id != null ? Number(d.fatura_origem_id) : null,
    tentativa: Number(d.tentativa) || 1,
    totalFaturado: Number(d.total_faturado) || 0,
    totalRecebido: Number(d.total_recebido) || 0,
    totalGlosado: Number(d.total_glosado) || 0,
    totalGlosadoAberto: Number(d.total_glosado_aberto) || 0,
    totalReapresentado: Number(d.total_reapresentado) || 0,
    saldoPendente: Number(d.saldo_pendente) || 0,
  }));
}

export interface RegistrarGlosaItem {
  itemId: number;
  valorGlosado: number;
}

/** Registra glosa parcial ou total (lista de itens com valor glosado). */
export async function registrarGlosa(
  faturaId: number,
  motivo: string,
  itens: RegistrarGlosaItem[],
): Promise<{ ok: boolean; error?: string }> {
  const motivoTrim = (motivo || "").trim();
  if (!motivoTrim) return { ok: false, error: "Informe o motivo da glosa" };
  if (itens.length === 0) return { ok: false, error: "Selecione ao menos um item" };
  try {
    const payload = itens.map((i) => ({ item_id: i.itemId, valor_glosado: i.valorGlosado }));
    const { error } = await supabase.rpc("convenio_fatura_glosar", {
      p_fatura_id: faturaId,
      p_motivo: motivoTrim,
      p_itens: payload,
    });
    if (error) throw error;
    return { ok: true };
  } catch (e) {
    showError(e, { scope: "convenioGlosasStore.registrarGlosa", silent: true });
    return { ok: false, error: (e as Error).message };
  }
}

/** Reapresenta glosas → cria nova fatura vinculada (tentativa+1). */
export async function reapresentarGlosas(input: {
  faturaOrigemId: number;
  glosaIds: number[];
  motivo: string;
  periodoInicio: string;
  periodoFim: string;
}): Promise<{ ok: boolean; faturaId?: number; codigo?: string; tentativa?: number; error?: string }> {
  const motivoTrim = (input.motivo || "").trim();
  if (!motivoTrim) return { ok: false, error: "Informe o motivo da reapresentação" };
  if (input.glosaIds.length === 0) return { ok: false, error: "Selecione ao menos uma glosa" };
  try {
    const { data, error } = await supabase.rpc("convenio_fatura_reapresentar", {
      p_fatura_origem_id: input.faturaOrigemId,
      p_glosa_ids: input.glosaIds,
      p_motivo: motivoTrim,
      p_periodo_inicio: input.periodoInicio,
      p_periodo_fim: input.periodoFim,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return {
      ok: true,
      faturaId: row?.fatura_id != null ? Number(row.fatura_id) : undefined,
      codigo: row?.codigo ?? undefined,
      tentativa: row?.tentativa != null ? Number(row.tentativa) : undefined,
    };
  } catch (e) {
    showError(e, { scope: "convenioGlosasStore.reapresentar", silent: true });
    return { ok: false, error: (e as Error).message };
  }
}

/** Cancela uma glosa (registro permanece, status='cancelada'). */
export async function cancelarGlosa(glosaId: number, motivo: string): Promise<{ ok: boolean; error?: string }> {
  const motivoTrim = (motivo || "").trim();
  if (!motivoTrim) return { ok: false, error: "Informe o motivo do cancelamento" };
  try {
    const { error } = await supabase
      .from("convenio_glosas")
      .update({
        status: "cancelada",
        cancelada_em: new Date().toISOString(),
        motivo_cancelamento: motivoTrim,
      })
      .eq("id", glosaId);
    if (error) throw error;
    return { ok: true };
  } catch (e) {
    showError(e, { scope: "convenioGlosasStore.cancelar", silent: true });
    return { ok: false, error: (e as Error).message };
  }
}
