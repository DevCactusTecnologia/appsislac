// Cálculo dos exames detalhados de um atendimento para a tela Financeiro.
//
// Fonte da verdade: `atendimento.examesCobranca[]` — `valor` é o efetivo
// (após desconto distribuído) e `valorOriginal` é o preço cheio. A
// diferença `valorOriginal - valor` é o desconto aplicado.
//
// Apenas exames cobrados do PACIENTE entram (convênio é faturado à parte).
//
// Fallback: sem `examesCobranca` hidratado → tabela de preços.
import { getTabelaByConvenioNome } from "@/data/convenioStore";
import { getPrecoExame, type TabelaTipo } from "@/data/tabelaPrecoStore";
import type { MockAtendimento } from "@/data/types";

export interface DetailExameValor {
  nome: string;
  /** Valor efetivo (após desconto distribuído). */
  valor: number;
  /** Preço cheio (antes do desconto). Igual a `valor` quando sem desconto. */
  valorOriginal: number;
}

export function computeDetailExames(
  atendimento: MockAtendimento | null,
): DetailExameValor[] {
  if (!atendimento) return [];

  const tabela = getTabelaByConvenioNome(atendimento.convenio) as TabelaTipo;
  const resolveTabela = (nome: string): number =>
    getPrecoExame(nome, tabela) ?? getPrecoExame(nome, "Própria") ?? 0;

  const cobranca = atendimento.examesCobranca;
  if (cobranca && cobranca.length > 0) {
    return cobranca
      .filter((e) => e.cobrancaDestino !== "convenio")
      .map((e) => {
        const valor = Number(e.valor) || 0;
        const stored = Number(e.valorOriginal) > 0 ? Number(e.valorOriginal) : valor;
        // Reconcilia com a tabela de preço vigente: o "valorOriginal" exibido
        // é o maior entre o armazenado, o efetivo e o preço de tabela atual,
        // garantindo que o modal nunca mostre preço inferior à tabela.
        const tabelaPreco = resolveTabela(e.nome);
        const valorOriginal = Math.max(stored, valor, tabelaPreco);
        return { nome: e.nome, valor, valorOriginal };
      });
  }

  // Fallback (sem examesCobranca hidratado): tabela de preços.
  return atendimento.exames.map((nome) => {
    const valor = resolveTabela(nome);
    return { nome, valor, valorOriginal: valor };
  });
}
