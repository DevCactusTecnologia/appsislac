// Store de faturas de convênio (fechamento em lote).
// Tabelas envolvidas:
//   - convenio_faturas       (cabeçalho da fatura)
//   - convenio_fatura_itens  (vínculo fatura ↔ atendimento_exames)
//
// Conceito:
//   - A "fatura" agrupa N exames de N atendimentos de UM convênio em UM período.
//   - Status: "aberta" | "paga" | "cancelada".
//   - Ao marcar como paga, a view financeiro_entradas exibe a fatura como
//     UMA linha agregada na aba "Entradas" do Financeiro.

import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "./_tenant";
import { persistOneOrThrow, persistOrThrow } from "@/lib/persist";
import { showError } from "@/lib/showError";
import type { Tables } from "@/integrations/supabase/types";

type FaturaRow = Tables<"convenio_faturas">;
type FaturaItemRow = Tables<"convenio_fatura_itens">;
type ConvenioRow = Pick<Tables<"convenios">, "id" | "nome">;
type AtendimentoExameRow = Tables<"atendimento_exames">;
type AtendimentoRow = Tables<"atendimentos">;

export interface ConvenioFatura {
  id: number;
  codigo: string;
  convenioId: number;
  convenioNome: string;
  periodoInicio: string;   // ISO YYYY-MM-DD
  periodoFim: string;      // ISO YYYY-MM-DD
  subtotal: number;
  desconto: number;
  total: number;
  status: "aberta" | "paga" | "cancelada";
  formaPagamento: string;
  dataPagamento: string | null; // ISO YYYY-MM-DD
  observacao: string;
  createdAt: string;
}

export interface ConvenioFaturaItem {
  id: number;
  faturaId: number;
  atendimentoExameId: number;
  valor: number;
  // Snapshot resolvido (join):
  atendimentoId: number | null;
  atendimentoProtocolo: string | null;
  atendimentoData: string | null;
  pacienteNome: string | null;
  exameNome: string | null;
}

export interface ItemFaturavel {
  atendimentoExameId: number;
  atendimentoId: number;
  protocolo: string;
  pacienteNome: string;
  data: string;            // ISO
  exameNome: string;
  valor: number;
  convenioCobrancaId: number | null;
}

function fromFaturaRow(r: FaturaRow, convenioNome: string): ConvenioFatura {
  return {
    id: Number(r.id),
    codigo: r.codigo,
    convenioId: Number(r.convenio_id),
    convenioNome,
    periodoInicio: r.periodo_inicio,
    periodoFim: r.periodo_fim,
    subtotal: Number(r.subtotal) || 0,
    desconto: Number(r.desconto) || 0,
    total: Number(r.total) || 0,
    status: (r.status === "paga" || r.status === "cancelada") ? r.status : "aberta",
    formaPagamento: r.forma_pagamento ?? "",
    dataPagamento: r.data_pagamento ?? null,
    observacao: r.observacao ?? "",
    createdAt: r.created_at,
  };
}

/** Lista todas as faturas (com nome do convênio resolvido). */
export async function fetchFaturas(): Promise<ConvenioFatura[]> {
  const [{ data: faturas, error: e1 }, { data: convenios, error: e2 }] = await Promise.all([
    supabase.from("convenio_faturas").select("*").order("created_at", { ascending: false }),
    supabase.from("convenios").select("id, nome"),
  ]);
  if (e1) {
    showError(e1, { scope: "convenioFaturasStore.fetchFaturas", silent: true });
    return [];
  }
  if (e2) {
    showError(e2, { scope: "convenioFaturasStore.fetchFaturas.convenios", silent: true });
  }
  const convMap = new Map<number, string>();
  (convenios ?? []).forEach((c: ConvenioRow) => convMap.set(Number(c.id), c.nome));
  return (faturas ?? []).map((r: FaturaRow) => fromFaturaRow(r, convMap.get(Number(r.convenio_id)) ?? "—"));
}

/** Lista faturas de um convênio específico. */
export async function fetchFaturasDoConvenio(convenioId: number): Promise<ConvenioFatura[]> {
  const all = await fetchFaturas();
  return all.filter(f => f.convenioId === convenioId);
}

/** Busca itens detalhados de uma fatura (drill-down). */
export async function fetchItensFatura(faturaId: number): Promise<ConvenioFaturaItem[]> {
  const { data: itens, error } = await supabase
    .from("convenio_fatura_itens")
    .select("id, fatura_id, atendimento_exame_id, valor")
    .eq("fatura_id", faturaId);
  if (error) {
    showError(error, { scope: "convenioFaturasStore.fetchItensFatura", silent: true });
    return [];
  }
  if (!itens || itens.length === 0) return [];
  const exameIds = itens.map((i) => Number(i.atendimento_exame_id));
  const { data: exRows } = await supabase
    .from("atendimento_exames")
    .select("id, atendimento_id, nome_exame, valor")
    .in("id", exameIds);
  type ExameLite = Pick<AtendimentoExameRow, "id" | "atendimento_id" | "nome_exame" | "valor">;
  const exMap = new Map<number, ExameLite>();
  (exRows ?? []).forEach((e) => exMap.set(Number(e.id), e as ExameLite));

  const atIds = Array.from(new Set((exRows ?? []).map((e) => Number(e.atendimento_id))));
  const { data: atRows } = atIds.length > 0
    ? await supabase
        .from("atendimentos")
        .select("id, protocolo, paciente_nome, data")
        .in("id", atIds)
    : { data: [] as Array<Pick<AtendimentoRow, "id" | "protocolo" | "paciente_nome" | "data">> };
  type AtLite = Pick<AtendimentoRow, "id" | "protocolo" | "paciente_nome" | "data">;
  const atMap = new Map<number, AtLite>();
  (atRows ?? []).forEach((a) => atMap.set(Number(a.id), a as AtLite));

  return (itens ?? []).map((i) => {
    const ex = exMap.get(Number(i.atendimento_exame_id));
    const at = ex ? atMap.get(Number(ex.atendimento_id)) : null;
    return {
      id: Number(i.id),
      faturaId: Number(i.fatura_id),
      atendimentoExameId: Number(i.atendimento_exame_id),
      valor: Number(i.valor) || 0,
      atendimentoId: ex ? Number(ex.atendimento_id) : null,
      atendimentoProtocolo: at?.protocolo ?? null,
      atendimentoData: at?.data ?? null,
      pacienteNome: at?.paciente_nome ?? null,
      exameNome: ex?.nome_exame ?? null,
    };
  });
}

/**
 * Lista exames faturáveis de UM convênio dentro de um período.
 * Critério: cobranca_destino='convenio', status='finalizado',
 *           convenio_cobranca_id = convênio escolhido,
 *           AINDA NÃO incluído em nenhuma fatura aberta/paga.
 */
export async function fetchItensFaturaveis(
  convenioId: number,
  periodoInicio: string, // ISO YYYY-MM-DD
  periodoFim: string,    // ISO YYYY-MM-DD
): Promise<ItemFaturavel[]> {
  // 1) Exames finalizados do convênio
  const { data: exames, error } = await supabase
    .from("atendimento_exames")
    .select("id, atendimento_id, nome_exame, valor, convenio_cobranca_id, cobranca_destino, status")
    .eq("cobranca_destino", "convenio")
    .eq("convenio_cobranca_id", convenioId)
    .eq("status", "finalizado");
  if (error) {
    showError(error, { scope: "convenioFaturasStore.fetchItensFaturaveis", silent: true });
    return [];
  }
  if (!exames || exames.length === 0) return [];

  // 2) Filtra IDs já vinculados a alguma fatura NÃO cancelada
  //    (itens de faturas canceladas voltam a ser elegíveis — SSOT Fase 2.3)
  const exameIds = exames.map((e) => Number(e.id));
  const { data: jaVinc } = await supabase
    .from("convenio_fatura_itens")
    .select("atendimento_exame_id, convenio_faturas!inner(status)")
    .in("atendimento_exame_id", exameIds)
    .neq("convenio_faturas.status", "cancelada");
  const jaSet = new Set<number>((jaVinc ?? []).map((j) => Number(j.atendimento_exame_id)));

  // 3) Busca atendimentos para filtro por período + dados de exibição
  const atIds = Array.from(new Set(exames.map((e) => Number(e.atendimento_id))));
  const { data: atRows } = await supabase
    .from("atendimentos")
    .select("id, protocolo, paciente_nome, data")
    .in("id", atIds)
    .gte("data", `${periodoInicio}T00:00:00`)
    .lte("data", `${periodoFim}T23:59:59.999`);
  type AtLite = Pick<AtendimentoRow, "id" | "protocolo" | "paciente_nome" | "data">;
  const atMap = new Map<number, AtLite>();
  (atRows ?? []).forEach((a) => atMap.set(Number(a.id), a as AtLite));

  return exames
    .filter((e) => !jaSet.has(Number(e.id)) && atMap.has(Number(e.atendimento_id)))
    .map((e) => {
      const at = atMap.get(Number(e.atendimento_id))!;
      return {
        atendimentoExameId: Number(e.id),
        atendimentoId: Number(e.atendimento_id),
        protocolo: at.protocolo,
        pacienteNome: at.paciente_nome,
        data: at.data,
        exameNome: e.nome_exame,
        valor: Number(e.valor) || 0,
        convenioCobrancaId: e.convenio_cobranca_id ?? null,
      };
    })
    .sort((a, b) => (a.data > b.data ? -1 : 1));
}

// fetchSaldoEmAbertoPorConvenio removido (Convênios 2.0 — Fase 2.5).
// Substituído oficialmente por `useAReceberConvenios` (RPC financeiro_a_receber_v2).

/**
 * @deprecated O código oficial é gerado server-side por trigger.
 * Mantido apenas como fallback de UI; o valor é descartado pelo banco.
 */
export async function getNextFaturaCodigo(): Promise<string> {
  return `FAT-TMP-${Date.now()}`;
}

export interface CriarFaturaInput {
  convenioId: number;
  periodoInicio: string;
  periodoFim: string;
  desconto: number;
  observacao: string;
  itens: ItemFaturavel[];
}

/** Cria uma fatura "aberta" e vincula os itens. O código é gerado pelo banco (FAT-AAAA-NNNNNNN). */
export async function criarFatura(input: CriarFaturaInput): Promise<{ ok: boolean; faturaId?: number; codigo?: string; error?: string }> {
  if (input.itens.length === 0) {
    return { ok: false, error: "Selecione ao menos um item" };
  }
  const tenantId = await getCurrentTenantId();
  const subtotal = input.itens.reduce((s, i) => s + i.valor, 0);
  const total = Math.max(0, subtotal - (input.desconto || 0));

  let fatRow: { id: number; codigo: string } | null = null;
  try {
    fatRow = await persistOneOrThrow<{ id: number; codigo: string }>(
      supabase.from("convenio_faturas").insert({
        tenant_id: tenantId,
        codigo: `FAT-TMP-${Date.now()}`,
        convenio_id: input.convenioId,
        periodo_inicio: input.periodoInicio,
        periodo_fim: input.periodoFim,
        subtotal,
        desconto: input.desconto || 0,
        total,
        status: "aberta",
        observacao: input.observacao || "",
      }),
      "convenioFaturas.criar.cabecalho",
      { selectCols: "id, codigo" },
    );
  } catch (e) {
    showError(e, { scope: "convenioFaturasStore.criar.cabecalho", silent: true });
    return { ok: false, error: (e as Error).message };
  }

  const itensPayload = input.itens.map(i => ({
    tenant_id: tenantId,
    fatura_id: fatRow!.id,
    atendimento_exame_id: i.atendimentoExameId,
    valor: i.valor,
  }));
  try {
    await persistOrThrow(
      supabase.from("convenio_fatura_itens").insert(itensPayload),
      "convenioFaturas.criar.itens",
      { expectAtLeast: itensPayload.length },
    );
  } catch (e) {
    showError(e, { scope: "convenioFaturasStore.criar.itens", silent: true });
    // rollback do cabeçalho
    await supabase.from("convenio_faturas").delete().eq("id", fatRow!.id);
    return { ok: false, error: (e as Error).message };
  }
  return { ok: true, faturaId: Number(fatRow!.id), codigo: fatRow!.codigo };
}

/** Marca fatura como paga (gera entrada agregada via view). */
export async function marcarFaturaPaga(
  faturaId: number,
  formaPagamento: string,
  dataPagamentoISO: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await persistOrThrow(
      supabase.from("convenio_faturas").update({
        status: "paga",
        forma_pagamento: formaPagamento,
        data_pagamento: dataPagamentoISO,
      }).eq("id", faturaId),
      "convenioFaturas.marcarPaga",
    );
    return { ok: true };
  } catch (e) {
    showError(e, { scope: "convenioFaturasStore.marcarPaga", silent: true });
    return { ok: false, error: (e as Error).message };
  }
}

/** Cancela uma fatura (libera os exames para uma nova fatura). */
export async function cancelarFatura(faturaId: number): Promise<{ ok: boolean; error?: string }> {
  try {
    await persistOrThrow(
      supabase.from("convenio_fatura_itens").delete().eq("fatura_id", faturaId),
      "convenioFaturas.cancelar.itens",
      { expectAtLeast: 0 },
    );
    await persistOrThrow(
      supabase.from("convenio_faturas").update({ status: "cancelada" }).eq("id", faturaId),
      "convenioFaturas.cancelar.cabecalho",
    );
    return { ok: true };
  } catch (e) {
    showError(e, { scope: "convenioFaturasStore.cancelar", silent: true });
    return { ok: false, error: (e as Error).message };
  }
}
