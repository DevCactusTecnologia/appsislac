// Fonte única de verdade para resolução de preço de exame no fluxo de
// /novo-atendimento. Substitui as 4 reimplementações in-line do padrão
// `getPrecoExame(nome, tabela) ?? getPrecoExame(nome, "Própria") ?? 0`.
//
// REGRA (preservada literalmente da auditoria):
//  1. Se houver `metaValor` (valor já persistido em `examesCobranca[i].valor`),
//     ele é a fonte de verdade — nunca recalcular.
//  2. Caso contrário, tenta a tabela do convênio.
//  3. Se a tabela do convênio não tiver o exame, cai para "Própria".
//  4. Se não houver nenhum cadastro, retorna 0 (UI exibe "sem preço") —
//     nunca chutar.
//
// Esta função NÃO conhece desconto, acréscimo ou cobrança. Esses são
// calculados/aplicados pelo fluxo do wizard (finalizarAtendimento) — não
// duplicar aqui.
import { getTabelaByConvenioNome } from "@/data/convenioStore";
import { getPrecoExame, type TabelaTipo } from "@/data/tabelaPrecoStore";

export interface CalculateExamPriceInput {
  nomeExame: string;
  convenioNome: string;
  /** Valor já persistido em `examesCobranca[i].valor`, se houver. Tem prioridade absoluta. */
  metaValor?: number | null;
}

export function calculateExamPrice({
  nomeExame,
  convenioNome,
  metaValor,
}: CalculateExamPriceInput): number {
  if (typeof metaValor === "number") return metaValor;
  const tabela = getTabelaByConvenioNome(convenioNome) as TabelaTipo;
  return (
    getPrecoExame(nomeExame, tabela)
    ?? getPrecoExame(nomeExame, "Própria")
    ?? 0
  );
}
