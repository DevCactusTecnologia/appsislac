// PainelKpis — Fase 3 do Financeiro V2 (Laboratorial Simples e Profissional).
//
// Calcula os 6 cards do Painel Financeiro a partir das listas já carregadas:
//   • Receita Hoje      — soma de entradas com data de hoje
//   • Receita Mês       — soma de entradas no mês corrente
//   • A Receber         — saldo total (pacientes + convênios)
//   • Despesas Mês      — soma de saídas pagas no mês corrente
//   • Saldo Atual       — Receita Mês − Despesas Mês
//   • Convênios Pendentes — quantidade de convênios com saldo aberto
//
// 100% derivação pura. Nenhum hook, nenhum efeito.
import { parseDate } from "../helpers";
import type { FinanceiroEntry, AReceberRow, AReceberConvenioRow } from "../types";

export interface PainelKpis {
  receitaHoje: number;
  receitaMes: number;
  aReceberTotal: number;
  despesasMes: number;
  saldoAtual: number;
  conveniosPendentes: number;
  /** Quantidades para subtítulo opcional dos cards. */
  qtdEntradasHoje: number;
  qtdEntradasMes: number;
  qtdAReceberPacientes: number;
  qtdDespesasMes: number;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export interface AReceberTotaisInput {
  /** Total geral (pacientes + convênios) — vem da RPC SSOT. */
  totalGeral: number;
  /** Quantidade de pacientes com saldo > 0 — vem da RPC SSOT. */
  qtdPacientes: number;
  /** Quantidade de convênios com saldo aberto — vem da RPC SSOT. */
  qtdConvenios: number;
}

export function computePainelKpis(
  entradas: FinanceiroEntry[],
  saidas: FinanceiroEntry[],
  aReceberTotais: AReceberTotaisInput,
  hoje: Date = new Date(),
): PainelKpis {
  let receitaHoje = 0, qtdEntradasHoje = 0;
  let receitaMes = 0, qtdEntradasMes = 0;
  for (const e of entradas) {
    const d = parseDate(e.data);
    if (!d) continue;
    if (isSameDay(d, hoje))   { receitaHoje += e.valorTotal; qtdEntradasHoje += 1; }
    if (isSameMonth(d, hoje)) { receitaMes  += e.valorTotal; qtdEntradasMes  += 1; }
  }

  let despesasMes = 0, qtdDespesasMes = 0;
  for (const s of saidas) {
    if (s.foiPago !== "Sim") continue;
    // Usa data de pagamento se houver, senão data principal.
    const d = parseDate(s.dataPagamento || s.data);
    if (!d) continue;
    if (isSameMonth(d, hoje)) { despesasMes += s.valorTotal; qtdDespesasMes += 1; }
  }

  // Fase 7 — SSOT: o "A Receber" SEMPRE vem da RPC `financeiro_a_receber_totais`.
  // Não há mais soma local de `aReceberPacientes.reduce(...)` (que era enganosa
  // porque o array é paginado em 50 linhas).
  const saldoAtual = receitaMes - despesasMes;

  return {
    receitaHoje:           Math.round(receitaHoje  * 100) / 100,
    receitaMes:            Math.round(receitaMes   * 100) / 100,
    aReceberTotal:         Math.round(aReceberTotais.totalGeral * 100) / 100,
    despesasMes:           Math.round(despesasMes  * 100) / 100,
    saldoAtual:            Math.round(saldoAtual   * 100) / 100,
    conveniosPendentes:    aReceberTotais.qtdConvenios,
    qtdEntradasHoje,
    qtdEntradasMes,
    qtdAReceberPacientes:  aReceberTotais.qtdPacientes,
    qtdDespesasMes,
  };
}
