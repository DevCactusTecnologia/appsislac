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

export function computePainelKpis(
  entradas: FinanceiroEntry[],
  saidas: FinanceiroEntry[],
  aReceberPacientes: AReceberRow[],
  aReceberConvenios: AReceberConvenioRow[],
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

  const aReceberPacientesTotal = aReceberPacientes.reduce((sum, r) => sum + r.saldo, 0);
  const aReceberConveniosTotal = aReceberConvenios.reduce((sum, r) => sum + r.saldo, 0);
  const aReceberTotal = aReceberPacientesTotal + aReceberConveniosTotal;

  const saldoAtual = receitaMes - despesasMes;

  return {
    receitaHoje:           Math.round(receitaHoje  * 100) / 100,
    receitaMes:            Math.round(receitaMes   * 100) / 100,
    aReceberTotal:         Math.round(aReceberTotal * 100) / 100,
    despesasMes:           Math.round(despesasMes  * 100) / 100,
    saldoAtual:            Math.round(saldoAtual   * 100) / 100,
    conveniosPendentes:    aReceberConvenios.length,
    qtdEntradasHoje,
    qtdEntradasMes,
    qtdAReceberPacientes:  aReceberPacientes.length,
    qtdDespesasMes,
  };
}
