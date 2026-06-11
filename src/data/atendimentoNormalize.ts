// ============================================================
// normalizeAtendimento — shape único para MockAtendimento
// ------------------------------------------------------------
// Fontes possíveis:
//   1) Cache global (`getAtendimentos()`) — vem completo
//   2) Paginação server-side (`pageRowToLightAtendimento`) — vem parcial
//
// Garantia: TODO consumidor recebe o mesmo shape, sem `undefined`
// em campos coletivos (`exames`, `examesCobranca`, `pagamentosRealizados`).
// Falhas silenciosas em listas eram a causa raiz dos bugs de dialog.
// ============================================================

import type { MockAtendimento, StatusType } from "./types";

const SAFE_STATUS_AT: { label: string; type: StatusType; showIcon?: boolean } = {
  label: "—",
  type: "neutral",
};
const SAFE_STATUS_PG: { label: string; type: StatusType } = {
  label: "Pagamento pendente",
  type: "warning",
};

/**
 * Normaliza um atendimento — independente da origem — para o shape
 * canônico de `MockAtendimento`. Idempotente e fail-safe.
 */
export function normalizeAtendimento(
  input: Partial<MockAtendimento> | null | undefined,
): MockAtendimento {
  const row = (input ?? {}) as Partial<MockAtendimento>;
  return {
    protocolo: row.protocolo ?? "",
    data: row.data ?? "",
    nome: row.nome ?? "",
    cpf: row.cpf ?? "",
    nascimento: row.nascimento ?? "",
    idade: row.idade ?? "",
    statusAtendimento: row.statusAtendimento ?? SAFE_STATUS_AT,
    statusPagamento: row.statusPagamento ?? SAFE_STATUS_PG,
    motivoCancelamento: row.motivoCancelamento,
    solicitante: row.solicitante ?? "",
    convenio: row.convenio ?? "",
    exames: Array.isArray(row.exames) ? row.exames : [],
    examesCobranca: Array.isArray(row.examesCobranca) ? row.examesCobranca : [],
    unidadeId: row.unidadeId,
    pagamentosRealizados: Array.isArray(row.pagamentosRealizados)
      ? row.pagamentosRealizados
      : [],
    updatedAt: row.updatedAt,
  };
}
