// Cálculo puro dos exames detalhados de um atendimento, com seus valores
// segundo a tabela do convênio (fallback "Própria", senão 0).
// Extraído de Financeiro.tsx > detailExames (Fase 3 — Architectural Split).
// Comportamento preservado literalmente.
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
  const tabela = getTabelaByConvenioNome(atendimento.convenio) as TabelaTipo;
  return atendimento.exames.map((nome) => {
    const valor =
      getPrecoExame(nome, tabela) ?? getPrecoExame(nome, "Própria") ?? 0;
    return { nome, valor };
  });
}
