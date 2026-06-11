// FinanceiroService — derivações PURAS da página /financeiro (Fase 3 split).
//
// Regra absoluta: nenhuma função aqui referencia React, hooks, JSX, toast,
// router, supabase ou stores. Tudo recebe `inputs` e devolve `outputs`.
// Os corpos abaixo são CÓPIAS LITERAIS dos `useMemo` / helpers internos
// de `Financeiro.tsx` (Sprint 3 — Architectural Split Program, Parte 1).
//
// Resultado esperado: mesmo input ⇒ mesmo output, byte-a-byte, comparado
// ao comportamento anterior do componente monolítico.

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { fmtBRLNumber, searchNormalize } from "@/lib/utils";
import type {
  FinanceiroSaida, FinanceiroEntradaView,
} from "@/data/financeiroStore";
import type { MockAtendimento, ExameCobrancaInfo } from "@/data/types";
import { getTabelaByConvenioNome } from "@/data/convenioStore";
import { getPrecoExame, type TabelaTipo } from "@/data/tabelaPrecoStore";
import { parseDate } from "../helpers";
import type {
  FinanceiroEntry, SaidaStatusFilter,
  AReceberRow, AReceberConvenioRow, CaixaMov, CaixaLinhaComSaldo,
  TabType,
} from "../types";

type AReceberStatus = "todas" | "parciais" | "pendentes";

// ── A RECEBER ────────────────────────────────────────────────────────────

/** Pacientes com saldo > 0, a partir do cache de atendimentos. */
export function buildAReceberRowsFromAtendimentos(
  atendimentos: MockAtendimento[],
): AReceberRow[] {
  const rows: AReceberRow[] = [];
  atendimentos.forEach((at) => {
    if (at.statusAtendimento.label === "Cancelado") return;
    const tabela = getTabelaByConvenioNome(at.convenio) as TabelaTipo;
    // SOMENTE exames cobrados do paciente entram no saldo paciente
    const valorTotalPaciente = at.exames.reduce((s, nome) => {
      const meta: ExameCobrancaInfo | undefined = at.examesCobranca?.find((c) => c.nome === nome);
      if (meta && meta.cobrancaDestino === "convenio") return s; // exclui convênio
      const v = getPrecoExame(nome, tabela) ?? getPrecoExame(nome, "Própria") ?? 0;
      return s + v;
    }, 0);
    const valorPago = (at.pagamentosRealizados ?? []).reduce((s, p) => s + p.valor, 0);
    const saldo = valorTotalPaciente - valorPago;
    if (saldo <= 0.009) return;
    rows.push({
      protocolo: at.protocolo,
      data: at.data,
      cliente: at.nome,
      convenio: at.convenio,
      valorTotal: valorTotalPaciente,
      valorPago,
      saldo: Math.round(saldo * 100) / 100,
      status: valorPago > 0 ? "parcial" : "pendente",
      atendimento: at,
    });
  });
  return rows.sort((a, b) => b.data.localeCompare(a.data));
}

/** Adaptador AReceberRowDTO (RPC) → AReceberRow do template. */
export interface AReceberRowDTO {
  protocolo: string;
  data: string;
  paciente_nome: string;
  convenio_nome: string | null;
  valor_total: number | string;
  valor_pago: number | string;
  saldo: number | string;
  status: "parcial" | "pendente";
}
export function buildAReceberRowsFromRpc(rows: AReceberRowDTO[]): AReceberRow[] {
  return rows.map((r) => {
    const atStub = {
      protocolo: r.protocolo,
      data: r.data,
      nome: r.paciente_nome,
      convenio: r.convenio_nome || "Particular",
      cpf: "",
      nascimento: "",
      idade: "",
      statusAtendimento: { label: "—", type: "neutral" as const },
      statusPagamento: { label: "—", type: "warning" as const },
      solicitante: "",
      exames: [],
      examesCobranca: [],
      pagamentosRealizados: [],
    } as unknown as MockAtendimento;
    return {
      protocolo: r.protocolo,
      data: r.data,
      cliente: r.paciente_nome,
      convenio: r.convenio_nome || "Particular",
      valorTotal: Number(r.valor_total) || 0,
      valorPago: Number(r.valor_pago) || 0,
      saldo: Number(r.saldo) || 0,
      status: r.status,
      atendimento: atStub,
    };
  });
}

/** Saldo agregado por convênio (lista para a sub-aba "Convênios" de A Receber). */
export function buildAReceberConvenioRows(
  saldoConvenios: Map<number, { saldo: number; exames: number; pacientes: Set<string> }>,
  convenios: Array<{ id: number; nome: string }>,
): AReceberConvenioRow[] {
  const rows: AReceberConvenioRow[] = [];
  saldoConvenios.forEach((v, cid) => {
    const c = convenios.find((cc) => cc.id === cid);
    if (!c || c.id === 0) return; // ignora Particular
    rows.push({
      convenioId: cid,
      convenioNome: c.nome,
      saldo: Math.round(v.saldo * 100) / 100,
      qtdExames: v.exames,
      qtdPacientes: v.pacientes.size,
    });
  });
  return rows.sort((a, b) => b.saldo - a.saldo);
}

/** Filtragem + busca da aba "A Receber" (não pagina). */
export function filterAReceberRows(
  rows: AReceberRow[],
  opts: {
    aReceberStatusFilter: AReceberStatus;
    convenioFilter: string;
    searchQuery: string;
    dateFrom?: Date;
    dateTo?: Date;
  },
): AReceberRow[] {
  let data = rows;
  if (opts.aReceberStatusFilter !== "todas") {
    data = data.filter((r) => r.status === (opts.aReceberStatusFilter === "parciais" ? "parcial" : "pendente"));
  }
  if (opts.convenioFilter !== "all") data = data.filter((r) => r.convenio === opts.convenioFilter);
  if (opts.dateFrom || opts.dateTo) {
    data = data.filter((r) => {
      const d = parseDate(r.data);
      if (!d) return true;
      if (opts.dateFrom && d < opts.dateFrom) return false;
      if (opts.dateTo) { const toEnd = new Date(opts.dateTo); toEnd.setHours(23, 59, 59, 999); if (d > toEnd) return false; }
      return true;
    });
  }
  if (opts.searchQuery) {
    const q = searchNormalize(opts.searchQuery);
    data = data.filter((r) =>
      searchNormalize(r.protocolo).includes(q)
      || searchNormalize(r.cliente).includes(q)
      || searchNormalize(r.convenio).includes(q),
    );
  }
  return data;
}

// ── ENTRADAS / SAÍDAS / KPIs ─────────────────────────────────────────────

/** Aplica filtros (data, convênio, tipoDespesa, destino, status saída, busca). */
export function applyFinanceiroFilters(
  allEntries: FinanceiroEntry[],
  opts: {
    activeTab: TabType;
    searchQuery: string;
    dateFrom?: Date;
    dateTo?: Date;
    convenioFilter: string;
    tipoDespesaFilter: string;
    destinoPagamentoFilter: string;
    saidaStatusFilter: SaidaStatusFilter;
  },
): FinanceiroEntry[] {
  let data = allEntries;
  if (opts.dateFrom || opts.dateTo) {
    data = data.filter((e) => {
      const d = parseDate(e.data);
      if (!d) return true;
      if (opts.dateFrom && d < opts.dateFrom) return false;
      if (opts.dateTo) { const toEnd = new Date(opts.dateTo); toEnd.setHours(23, 59, 59, 999); if (d > toEnd) return false; }
      return true;
    });
  }
  if (opts.activeTab === "entrada" && opts.convenioFilter !== "all") data = data.filter((e) => e.convenio === opts.convenioFilter);
  if (opts.activeTab === "saida" && opts.tipoDespesaFilter !== "all") data = data.filter((e) => e.tipoDespesa === opts.tipoDespesaFilter);
  if (opts.activeTab === "saida" && opts.destinoPagamentoFilter !== "all") data = data.filter((e) => e.destinoPagamento === opts.destinoPagamentoFilter);
  if (opts.activeTab === "saida" && opts.saidaStatusFilter !== "todas") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    data = data.filter((e) => {
      const venc = e.dataVencimento ? parseDate(e.dataVencimento) : null;
      const paga = e.foiPago === "Sim";
      if (opts.saidaStatusFilter === "pagas") return paga;
      if (opts.saidaStatusFilter === "vencidas") return !paga && venc !== null && venc < today;
      if (opts.saidaStatusFilter === "vencendo7") {
        if (paga || !venc) return false;
        const diff = Math.round((venc.getTime() - today.getTime()) / 86400000);
        return diff >= 0 && diff <= 7;
      }
      return true;
    });
  }
  if (!opts.searchQuery) return data;
  const q = searchNormalize(opts.searchQuery);
  return data.filter((e) =>
    searchNormalize(e.protocolo).includes(q)
    || searchNormalize(e.cliente).includes(q)
    || searchNormalize(e.pagamento).includes(q),
  );
}

/** KPIs da aba Entradas (regime de caixa, ignora busca textual). */
export function computeEntradaCounts(
  entradas: FinanceiroEntry[],
  opts: { convenioFilter: string; dateFrom?: Date; dateTo?: Date },
): { todas: number; totalRecebido: number; byPagamento: Array<{ nome: string; count: number; total: number }> } {
  const filtered = entradas.filter((e) => {
    if (opts.convenioFilter !== "all" && e.convenio !== opts.convenioFilter) return false;
    if (opts.dateFrom || opts.dateTo) {
      const d = parseDate(e.data);
      if (!d) return true;
      if (opts.dateFrom && d < opts.dateFrom) return false;
      if (opts.dateTo) {
        const toEnd = new Date(opts.dateTo);
        toEnd.setHours(23, 59, 59, 999);
        if (d > toEnd) return false;
      }
    }
    return true;
  });
  const total = filtered.reduce((s, e) => s + e.valorTotal, 0);
  const byPagamentoMap = new Map<string, { count: number; total: number }>();
  filtered.forEach((e) => {
    const key = (e.pagamento || "—").trim() || "—";
    const cur = byPagamentoMap.get(key) ?? { count: 0, total: 0 };
    cur.count += 1;
    cur.total += e.valorTotal;
    byPagamentoMap.set(key, cur);
  });
  const byPagamento = Array.from(byPagamentoMap.entries())
    .map(([nome, v]) => ({ nome, count: v.count, total: v.total }))
    .sort((a, b) => b.total - a.total);
  return { todas: filtered.length, totalRecebido: total, byPagamento };
}

/** KPIs da aba "A Receber". */
export function computeAReceberCounts(rows: AReceberRow[]) {
  let parciais = 0, pendentes = 0;
  let totalParciais = 0, totalPendentes = 0, totalGeral = 0;
  rows.forEach((r) => {
    totalGeral += r.saldo;
    if (r.status === "parcial") { parciais++; totalParciais += r.saldo; }
    else { pendentes++; totalPendentes += r.saldo; }
  });
  return { todas: rows.length, parciais, pendentes, totalParciais, totalPendentes, totalGeral };
}

/** KPIs da aba Saídas (sempre sobre o universo de saídas, não filtered). */
export function computeSaidaCounts(saidas: FinanceiroEntry[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let vencidas = 0, vencendo7 = 0, pagas = 0, pendentes = 0;
  let totalVencidas = 0, totalVencendo7 = 0, totalPagas = 0, totalPendentes = 0;
  saidas.forEach((e) => {
    const venc = e.dataVencimento ? parseDate(e.dataVencimento) : null;
    const paga = e.foiPago === "Sim";
    if (paga) { pagas++; totalPagas += e.valorTotal; return; }
    pendentes++; totalPendentes += e.valorTotal;
    if (!venc) return;
    if (venc < today) { vencidas++; totalVencidas += e.valorTotal; return; }
    const diff = Math.round((venc.getTime() - today.getTime()) / 86400000);
    if (diff <= 7) { vencendo7++; totalVencendo7 += e.valorTotal; }
  });
  return {
    todas: saidas.length, vencidas, vencendo7, pagas, pendentes,
    totalVencidas, totalVencendo7, totalPagas, totalPendentes,
  };
}

// ── LIVRO-CAIXA ──────────────────────────────────────────────────────────

/** Lançamentos cronológicos unificados (entradas + saídas pagas). */
export function buildCaixaMovimentos(
  entradas: FinanceiroEntry[],
  saidas: FinanceiroEntry[],
): CaixaMov[] {
  const ents: CaixaMov[] = entradas.map((e) => {
    const d = parseDate(e.data) ?? new Date();
    return {
      data: e.data, dataObj: d, tipo: "entrada" as const,
      protocolo: e.protocolo, descricao: e.cliente,
      categoria: e.convenio || "—", pagamento: e.pagamento || "—",
      valor: e.valorTotal,
    };
  });
  const sais: CaixaMov[] = saidas
    .filter((s) => s.foiPago === "Sim")
    .map((s) => {
      const dataExib = s.data || s.dataPagamento || "";
      const d = parseDate(s.dataPagamento || "") ?? parseDate(s.data || "") ?? new Date();
      return {
        data: dataExib, dataObj: d, tipo: "saida" as const,
        protocolo: s.protocolo, descricao: s.descricao || s.cliente || "—",
        categoria: s.tipoDespesa || "—", pagamento: s.pagamento || "—",
        valor: s.valorTotal,
      };
    });
  return [...ents, ...sais].sort((a, b) => a.dataObj.getTime() - b.dataObj.getTime());
}

/** Filtragem por período + busca textual nos movimentos do caixa. */
export function filterCaixaMovimentos(
  movs: CaixaMov[],
  opts: { dateFrom?: Date; dateTo?: Date; searchQuery: string },
): CaixaMov[] {
  let data = movs;
  if (opts.dateFrom || opts.dateTo) {
    data = data.filter((m) => {
      if (opts.dateFrom && m.dataObj < opts.dateFrom) return false;
      if (opts.dateTo) { const toEnd = new Date(opts.dateTo); toEnd.setHours(23, 59, 59, 999); if (m.dataObj > toEnd) return false; }
      return true;
    });
  }
  if (opts.searchQuery) {
    const q = searchNormalize(opts.searchQuery);
    data = data.filter((m) =>
      searchNormalize(m.protocolo).includes(q)
      || searchNormalize(m.descricao).includes(q)
      || searchNormalize(m.categoria).includes(q)
      || searchNormalize(m.pagamento).includes(q),
    );
  }
  return data;
}

/** Saldo inicial = soma dos movimentos ANTERIORES ao período filtrado. */
export function computeCaixaSaldoInicial(movs: CaixaMov[], dateFrom: Date | undefined): number {
  if (!dateFrom) return 0;
  return movs
    .filter((m) => m.dataObj < dateFrom)
    .reduce((s, m) => s + (m.tipo === "entrada" ? m.valor : -m.valor), 0);
}

/** Aplica saldo acumulado linha a linha. */
export function applyCaixaSaldoAcumulado(
  movs: CaixaMov[],
  saldoInicial: number,
): CaixaLinhaComSaldo[] {
  let saldo = saldoInicial;
  return movs.map((m) => {
    saldo += m.tipo === "entrada" ? m.valor : -m.valor;
    return { ...m, saldoAcumulado: saldo };
  });
}

/** Totais do período + saldo final. */
export function computeCaixaTotais(
  movsFiltrados: CaixaMov[],
  saldoInicial: number,
): { totalEntradas: number; totalSaidas: number; saldoPeriodo: number; saldoFinal: number } {
  const totalEntradas = movsFiltrados.filter((m) => m.tipo === "entrada").reduce((s, m) => s + m.valor, 0);
  const totalSaidas = movsFiltrados.filter((m) => m.tipo === "saida").reduce((s, m) => s + m.valor, 0);
  const saldoPeriodo = totalEntradas - totalSaidas;
  const saldoFinal = saldoInicial + saldoPeriodo;
  return { totalEntradas, totalSaidas, saldoPeriodo, saldoFinal };
}

/**
 * Monta o HTML do Livro-Caixa para impressão (pure builder).
 * Caller é responsável por chamar `printHtmlInHiddenFrame({ html })`.
 */
export function buildLivroCaixaHtml(opts: {
  linhas: CaixaLinhaComSaldo[];
  totais: { totalEntradas: number; totalSaidas: number; saldoFinal: number };
  saldoInicial: number;
  dateFrom?: Date;
  dateTo?: Date;
}): string {
  const { linhas, totais, saldoInicial, dateFrom, dateTo } = opts;
  const periodoLabel =
    dateFrom && dateTo ? `${format(dateFrom, "dd/MM/yyyy")} a ${format(dateTo, "dd/MM/yyyy")}`
    : dateFrom ? `A partir de ${format(dateFrom, "dd/MM/yyyy")}`
    : dateTo ? `Até ${format(dateTo, "dd/MM/yyyy")}`
    : "Todos os períodos";

  const linhasHtml = linhas.map((m) => `
      <tr>
        <td>${m.data}</td>
        <td>${m.protocolo}</td>
        <td>${m.descricao}</td>
        <td>${m.categoria}</td>
        <td>${m.pagamento}</td>
        <td class="r ${m.tipo === "entrada" ? "pos" : ""}">${m.tipo === "entrada" ? "+ R$ " + fmtBRLNumber(m.valor) : "—"}</td>
        <td class="r ${m.tipo === "saida" ? "neg" : ""}">${m.tipo === "saida" ? "- R$ " + fmtBRLNumber(m.valor) : "—"}</td>
        <td class="r ${m.saldoAcumulado >= 0 ? "pos" : "neg"}"><b>R$ ${fmtBRLNumber(m.saldoAcumulado)}</b></td>
      </tr>`).join("");

  return `<html><head><title>Livro-Caixa</title>
      <style>
        *{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;padding:24px;color:#222;font-size:12px}
        h1{font-size:18px;margin:0 0 4px}.sub{color:#666;font-size:11px;margin-bottom:12px}
        .meta{display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;border:1px solid #e5e5e5;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:11px}
        .meta b{color:#000}
        table{width:100%;border-collapse:collapse;font-size:11px}
        th,td{padding:8px 10px;border-bottom:1px solid #eee;text-align:left;vertical-align:top}
        th{background:#fafafa;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#555}
        .r{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
        .pos{color:#16a34a;font-weight:600}.neg{color:#dc2626;font-weight:600}
        tfoot td{font-weight:700;border-top:2px solid #222;background:#fafafa}
        .empty{padding:40px;text-align:center;color:#888;border:1px dashed #ddd;border-radius:8px}
        .footer{margin-top:18px;font-size:10px;color:#888;text-align:right}
        .saldo-inicial{background:#fafafa;font-weight:600}
      </style></head><body>
      <h1>Livro-Caixa</h1>
      <p class="sub">Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
      <div class="meta">
        <div><b>Período:</b> ${periodoLabel}</div>
        <div><b>Lançamentos:</b> ${linhas.length}</div>
        <div><b>Saldo inicial:</b> R$ ${fmtBRLNumber(saldoInicial)}</div>
        <div><b>Entradas:</b> <span style="color:#16a34a">+ R$ ${fmtBRLNumber(totais.totalEntradas)}</span></div>
        <div><b>Saídas:</b> <span style="color:#dc2626">- R$ ${fmtBRLNumber(totais.totalSaidas)}</span></div>
        <div><b>Saldo final:</b> R$ ${fmtBRLNumber(totais.saldoFinal)}</div>
      </div>
      ${linhas.length === 0 ? `<div class="empty">Nenhuma movimentação no período.</div>` : `
      <table>
        <thead><tr>
          <th>Data</th><th>Protocolo</th><th>Descrição</th>
          <th>Categoria</th><th>Pagamento</th>
          <th class="r">Entrada</th><th class="r">Saída</th><th class="r">Saldo</th>
        </tr></thead>
        <tbody>
          ${dateFrom ? `<tr class="saldo-inicial"><td colspan="7">Saldo inicial em ${format(dateFrom, "dd/MM/yyyy")}</td><td class="r">R$ ${fmtBRLNumber(saldoInicial)}</td></tr>` : ""}
          ${linhasHtml}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="5" class="r">Totais do período</td>
            <td class="r pos">+ R$ ${fmtBRLNumber(totais.totalEntradas)}</td>
            <td class="r neg">- R$ ${fmtBRLNumber(totais.totalSaidas)}</td>
            <td class="r"><b>R$ ${fmtBRLNumber(totais.saldoFinal)}</b></td>
          </tr>
        </tfoot>
      </table>`}
      <div class="footer">SISLAC — Livro-Caixa</div>
      </body></html>`;
}
