// Cálculo dos exames detalhados de um atendimento para a tela Financeiro.
//
// Fonte da verdade: `atendimento.examesCobranca[].valor` — já reflete
// descontos distribuídos no momento da finalização/pagamento. Usar a
// tabela de preços aqui produziria um total inflado (valor cheio) e um
// "saldo devedor" fantasma equivalente ao desconto aplicado.
//
// Apenas exames cobrados do PACIENTE entram (convênio é faturado à parte
// e não compõe o saldo do atendimento na visão financeira).
//
// Fallback: se `examesCobranca` não estiver hidratado (ex.: registros
// antigos), caímos na tabela de preços para preservar comportamento.
import { getTabelaByConvenioNome } from "@/data/convenioStore";
import { getPrecoExame, type TabelaTipo } from "@/data/tabelaPrecoStore";
import type { MockAtendimento } from "@/data/types";

export interface DetailExameValor {
  nome: string;
  valor: number;
}

export function computeDetailExames(
  atendimento: MockAtendimento | null,
): DetailExameValor[] {
  if (!atendimento) return [];

  const cobranca = atendimento.examesCobranca;
  if (cobranca && cobranca.length > 0) {
    return cobranca
      .filter((e) => e.cobrancaDestino !== "convenio")
      .map((e) => ({ nome: e.nome, valor: Number(e.valor) || 0 }));
  }

  // Fallback (sem examesCobranca hidratado): tabela de preços.
  const tabela = getTabelaByConvenioNome(atendimento.convenio) as TabelaTipo;
  return atendimento.exames.map((nome) => {
    const valor =
      getPrecoExame(nome, tabela) ?? getPrecoExame(nome, "Própria") ?? 0;
    return { nome, valor };
  });
}
