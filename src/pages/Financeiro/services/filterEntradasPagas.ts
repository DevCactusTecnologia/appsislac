// Filtra entradas em regime de caixa e ordena por data desc.
//
// Cada linha de `financeiro_entradas` representa um recebimento real
// (origem = "pagamento" ou "fatura_convenio"). O `statusPagamento` reflete
// o estado do atendimento como um todo, não do pagamento individual — por
// isso pagamentos parciais TAMBÉM contam como entrada de caixa do dia/mês.
//
// Antes esta função filtrava apenas status "Pago"/"Pagamento efetuado",
// o que zerava Receita Hoje/Mês quando só havia pagamentos parciais.
import type { FinanceiroEntradaView } from "@/data/financeiroStore";
import type { FinanceiroEntry } from "../types";
import { entradaViewToEntry } from "../helpers";

export function filterEntradasPagas(
  entradasView: FinanceiroEntradaView[],
): FinanceiroEntry[] {
  return entradasView
    .map(entradaViewToEntry)
    .sort((a, b) => b.data.localeCompare(a.data));
}
