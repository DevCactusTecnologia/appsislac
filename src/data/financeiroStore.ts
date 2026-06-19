// Store financeiro com cache síncrono backed by Supabase.
// - Saídas: tabela financeiro_saidas (CRUD otimista)
// - Entradas: view financeiro_entradas (read-only, derivada de atendimento_pagamentos)

import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "./_tenant";
import { persistOneOrThrow } from "@/lib/persist";
import { showError } from "@/lib/showError";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

type SaidaRow = Tables<"financeiro_saidas">;
type SaidaInsert = TablesInsert<"financeiro_saidas">;
type EntradaViewRow = Tables<"financeiro_entradas">;

export type SaidaStatus = "aberta" | "paga" | "cancelada";

export interface FinanceiroSaida {
  id?: number;             // id real em financeiro_saidas (resolvido server-side)
  protocolo: string;
  data: string;            // dd/mm/yyyy
  cliente: string;
  valorTotal: number;
  pagamento: string;
  tipoDespesa: string;
  destinoPagamento: string;
  descricao: string;
  dataVencimento: string;  // dd/mm/yyyy
  foiPago: string;         // "Sim" | "Não" — derivado de status (legado)
  dataPagamento: string;   // dd/mm/yyyy
  /** Fase 6 V2 — fonte oficial do estado da despesa. */
  status: SaidaStatus;
}

export interface FinanceiroEntradaView {
  protocolo: string;
  data: string;            // dd/mm/yyyy
  cliente: string;
  valorTotal: number;
  pagamento: string;
  convenio: string;
  observacao: string;
  pagamentoId: number | null;
  atendimentoId: number | null;
  unidadeId: string | null;
  statusPagamento: string;
  /** "pagamento" (avulso de paciente) | "fatura_convenio" (entrada agregada). */
  origem: "pagamento" | "fatura_convenio";
  /** Quando origem = "fatura_convenio", aponta para convenio_faturas.id. */
  faturaId: number | null;
}

let _saidas: FinanceiroSaida[] = [];
let _listeners: Array<() => void> = [];
const _idByProtocolo = new Map<string, number>();

function notify() {
  _listeners.forEach((fn) => fn());
}

function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const dd = pad(d.getDate());
  const mm = pad(d.getMonth() + 1);
  const yyyy = d.getFullYear();
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}:${ss}`;
}

function formatDateOnlyBR(s: string | null | undefined): string {
  if (!s) return "";
  // s pode ser 'YYYY-MM-DD' (date) — evita conversão UTC
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return formatDateBR(s);
}

function ddmmyyyyToISO(s: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

function ddmmyyyyToISODateTime(s: string): string {
  const iso = ddmmyyyyToISO(s);
  if (iso) return new Date(`${iso}T12:00:00Z`).toISOString();
  return new Date().toISOString();
}

// (Função legada `buildSaidaFromRow` removida — Fase 2 Financeiro V2.)

// Fase 2 — Financeiro V2: a forma de pagamento agora vive em coluna própria
// `financeiro_saidas.forma_pagamento`. O antigo sufixo `[pgto:X]` em descricao
// foi normalizado pelo backfill da migration; este código:
//  - sempre ESCREVE em `forma_pagamento` (sem injetar sufixo na descricao);
//  - LÊ preferindo a coluna; se NULL, faz fallback ao decodificador legado para
//    cobrir hipotéticos registros antigos não migrados.

function decodePagamentoLegacy(descricao: string | null | undefined): { descricao: string; pagamento: string; cliente: string } {
  const raw = descricao || "";
  const m = /\s*\[pgto:([^\]]+)\]\s*$/i.exec(raw);
  const pagamento = m ? m[1] : "";
  const clean = raw.replace(/\s*\[pgto:[^\]]+\]\s*$/i, "").trim();
  const parts = clean.split(" — ");
  const cliente = parts[0] || clean;
  return { descricao: clean, pagamento, cliente };
}

function buildSaidaFromRowDecoded(row: SaidaRow): FinanceiroSaida {
  // forma_pagamento é a fonte oficial (Fase 2). Fallback: decodifica [pgto:X] legado.
  const formaCol = (row as SaidaRow & { forma_pagamento?: string | null }).forma_pagamento ?? null;
  const legacy = decodePagamentoLegacy(row.descricao);
  const pagamento = (formaCol && formaCol.trim()) || legacy.pagamento || "—";
  // Se a coluna já existe, a descricao já está limpa; senão, usa a versão decodificada.
  const descricaoLimpa = formaCol ? (row.descricao || "") : legacy.descricao;
  const parts = descricaoLimpa.split(" — ");
  const cliente = parts[0] || descricaoLimpa;
  // Fase 6 V2 — `status` é a fonte oficial; fallback para foi_pago em registros legados.
  const rawStatus = ((row as SaidaRow & { status?: string | null }).status || "").toLowerCase();
  const status: SaidaStatus =
    rawStatus === "paga" || rawStatus === "cancelada" || rawStatus === "aberta"
      ? (rawStatus as SaidaStatus)
      : (row.foi_pago ? "paga" : "aberta");
  return {
    id: row.id,
    protocolo: row.protocolo,
    data: formatDateBR(row.data),
    cliente,
    valorTotal: Number(row.valor) || 0,
    pagamento,
    tipoDespesa: row.tipo_despesa || "",
    destinoPagamento: row.destino_pagamento || "",
    descricao: descricaoLimpa,
    dataVencimento: formatDateOnlyBR(row.data_vencimento),
    foiPago: status === "paga" ? "Sim" : "Não",
    dataPagamento: formatDateOnlyBR(row.data_pagamento),
    status,
  };
}


export async function _initFinanceiroStore(): Promise<void> {
  const { data, error } = await supabase
    .from("financeiro_saidas")
    .select("*")
    .order("data", { ascending: false });

  if (error) {
    showError(error, { scope: "financeiroStore.initSaidas", silent: true });
    return;
  }

  _idByProtocolo.clear();
  _saidas = (data ?? []).map((row) => {
    _idByProtocolo.set(row.protocolo, row.id);
    return buildSaidaFromRowDecoded(row);
  });
  notify();
}

export function getSaidas(): FinanceiroSaida[] {
  return _saidas;
}

export function subscribeFinanceiro(listener: () => void) {
  _listeners.push(listener);
  return () => {
    _listeners = _listeners.filter((l) => l !== listener);
  };
}

/**
 * Gera um protocolo provisório (otimista) para a saída.
 * O protocolo OFICIAL é sempre gerado server-side via trigger
 * e devolvido após o INSERT, substituindo este valor.
 */
export function getNextSaidaProtocolo(): string {
  return `SAI-TMP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function addSaida(saida: FinanceiroSaida): Promise<void> {
  const protocoloProvisorio = saida.protocolo;
  _saidas = [saida, ..._saidas];
  notify();

  try {
    const tenantId = await getCurrentTenantId();
    const descricaoLimpa = (saida.descricao || saida.cliente || "")
      .replace(/\s*\[pgto:[^\]]+\]\s*$/i, "")
      .trim();
    const dataVencISO = ddmmyyyyToISO(saida.dataVencimento);
    const dataPgtoISO = ddmmyyyyToISO(saida.dataPagamento);
    const dataISO = ddmmyyyyToISODateTime(saida.foiPago === "Sim" ? saida.dataPagamento : saida.dataVencimento);

    const statusFinal: SaidaStatus = saida.status
      ?? (saida.foiPago === "Sim" ? "paga" : "aberta");
    const insertPayload: SaidaInsert = {
      tenant_id: tenantId,
      protocolo: protocoloProvisorio,
      data: dataISO,
      descricao: descricaoLimpa,
      forma_pagamento: saida.pagamento || null,
      valor: saida.valorTotal,
      tipo_despesa: saida.tipoDespesa,
      destino_pagamento: saida.destinoPagamento,
      data_vencimento: dataVencISO,
      foi_pago: statusFinal === "paga",
      data_pagamento: dataPgtoISO,
      status: statusFinal,
    };
    const data = await persistOneOrThrow<Pick<SaidaRow, "id" | "protocolo">>(
      supabase.from("financeiro_saidas").insert(insertPayload),
      "financeiro.criarSaida",
      { selectCols: "id, protocolo" },
    );

    const protocoloOficial = data.protocolo;
    _idByProtocolo.set(protocoloOficial, data.id);
    if (protocoloOficial !== protocoloProvisorio) {
      _saidas = _saidas.map((s) =>
        s.protocolo === protocoloProvisorio ? { ...s, protocolo: protocoloOficial } : s,
      );
      notify();
    }
  } catch (err) {
    _saidas = _saidas.filter((s) => s.protocolo !== protocoloProvisorio);
    notify();
    throw err;
  }
}

export async function updateSaida(protocolo: string, updates: Partial<FinanceiroSaida>): Promise<void> {
  const before = _saidas.find((s) => s.protocolo === protocolo);
  if (!before) return;
  const merged: FinanceiroSaida = { ...before, ...updates };
  _saidas = _saidas.map((s) => (s.protocolo === protocolo ? merged : s));
  notify();

  const dbId = _idByProtocolo.get(protocolo);
  if (!dbId) {
    _saidas = _saidas.map((s) => (s.protocolo === protocolo ? before : s));
    notify();
    throw new Error(`Saída ${protocolo} sem id no cache local`);
  }

  const descricaoLimpa = (merged.descricao || merged.cliente || "")
    .replace(/\s*\[pgto:[^\]]+\]\s*$/i, "")
    .trim();
  const dataVencISO = ddmmyyyyToISO(merged.dataVencimento);
  const dataPgtoISO = ddmmyyyyToISO(merged.dataPagamento);
  const dataISO = ddmmyyyyToISODateTime(merged.foiPago === "Sim" ? merged.dataPagamento : merged.dataVencimento);

  const mergedStatus: SaidaStatus = merged.status
    ?? (merged.foiPago === "Sim" ? "paga" : "aberta");
  try {
    await persistOneOrThrow<SaidaRow>(
      supabase.from("financeiro_saidas").update({
        data: dataISO,
        descricao: descricaoLimpa,
        forma_pagamento: merged.pagamento || null,
        valor: merged.valorTotal,
        tipo_despesa: merged.tipoDespesa,
        destino_pagamento: merged.destinoPagamento,
        data_vencimento: dataVencISO,
        foi_pago: mergedStatus === "paga",
        data_pagamento: dataPgtoISO,
        status: mergedStatus,
      }).eq("id", dbId),
      "financeiro.atualizarSaida",
    );
  } catch (err) {
    _saidas = _saidas.map((s) => (s.protocolo === protocolo ? before : s));
    notify();
    throw err;
  }
}

export async function removeSaida(protocolo: string): Promise<void> {
  const before = _saidas.find((s) => s.protocolo === protocolo);
  if (!before) return;
  _saidas = _saidas.filter((s) => s.protocolo !== protocolo);
  notify();

  const dbId = _idByProtocolo.get(protocolo);
  if (!dbId) {
    _saidas = [before, ..._saidas];
    notify();
    throw new Error(`Saída ${protocolo} sem id no cache local`);
  }

  try {
    await persistOneOrThrow<SaidaRow>(
      supabase.from("financeiro_saidas").delete().eq("id", dbId),
      "financeiro.removerSaida",
    );
    _idByProtocolo.delete(protocolo);
  } catch (err) {
    _saidas = [before, ..._saidas];
    notify();
    throw err;
  }
}

// ── Entradas (view read-only) ──
export async function fetchEntradasView(): Promise<FinanceiroEntradaView[]> {
  const { data, error } = await supabase
    .from("financeiro_entradas")
    .select("*")
    .order("data", { ascending: false });

  if (error) {
    showError(error, { scope: "financeiroStore.fetchEntradasView", silent: true });
    return [];
  }

  return (data ?? []).map((row: EntradaViewRow) => ({
    protocolo: row.protocolo || "",
    data: formatDateBR(row.data),
    cliente: row.cliente || "",
    valorTotal: Number(row.valor_total) || 0,
    pagamento: row.payment || "—",
    convenio: row.convenio || "Particular",
    observacao: row.observacao || "",
    pagamentoId: row.pagamento_id ?? null,
    atendimentoId: row.atendimento_id ?? null,
    unidadeId: row.unidade_id ?? null,
    statusPagamento: row.status_pagamento || "",
    origem: (row.origem === "fatura_convenio" ? "fatura_convenio" : "pagamento"),
    faturaId: row.fatura_id ?? null,
  }));
}
