/**
 * SSOT — Status de Atendimento
 *
 * Fonte única de derivação de status do atendimento.
 * Hoje a derivação está espalhada em vários arquivos; este módulo
 * é o destino canônico para a Fase 2 do Simplification Master Plan.
 *
 * O status REAL vive no banco (colunas `status_atendimento` e
 * `status_pagamento` em `atendimentos`), atualizado por trigger.
 * Este módulo apenas mapeia o valor cru DB → tipo visual + ícone.
 *
 * Regra: nenhum outro arquivo deve manter sua própria tabela
 * de mapeamento de status. Importe `deriveAtendimentoStatus`
 * e `derivePagamentoStatus` daqui.
 */

import type { StatusType } from "@/data/types";

// ─── Catálogo canônico de status ───
// Espelha exatamente os valores produzidos pelo trigger no banco.
export const STATUS_ATENDIMENTO_TYPES: Record<string, { type: StatusType; showIcon?: boolean }> = {
  "Pedido Realizado":   { type: "neutral" },
  "Amostra Coletada":   { type: "purple",  showIcon: true },
  "Em Análise":         { type: "warning", showIcon: true },
  "Amostra Analisada":  { type: "teal",    showIcon: true },
  "Resultado Salvo":    { type: "info",    showIcon: true },
  "Em Retificação":     { type: "warning", showIcon: true },
  "Retificado":         { type: "info",    showIcon: true },
  "Resultado Liberado": { type: "success", showIcon: true },
  "Cancelado":          { type: "danger" },
  "Pedido cancelado":   { type: "danger" },
};

export const STATUS_PAGAMENTO_TYPES: Record<string, StatusType> = {
  "Pagamento efetuado":  "success",
  "Pagamento parcial":   "info",
  "Pagamento pendente":  "warning",
  "Pagamento cancelado": "danger",
};

export interface DerivedStatus {
  label: string;
  type: StatusType;
  showIcon?: boolean;
}

/**
 * Deriva o status de atendimento a partir do valor cru do banco.
 * Fallback `neutral` para qualquer rótulo desconhecido.
 */
export function deriveAtendimentoStatus(rawLabel: string | null | undefined): DerivedStatus {
  const label = rawLabel ?? "";
  const cfg = STATUS_ATENDIMENTO_TYPES[label] ?? { type: "neutral" as StatusType };
  return { label, type: cfg.type, showIcon: cfg.showIcon };
}

/**
 * Deriva o status de pagamento a partir do valor cru do banco.
 * Fallback `warning` (pendente) para qualquer rótulo desconhecido.
 */
export function derivePagamentoStatus(rawLabel: string | null | undefined): DerivedStatus {
  const label = rawLabel ?? "";
  const type = STATUS_PAGAMENTO_TYPES[label] ?? ("warning" as StatusType);
  return { label, type };
}

/**
 * Indica se o atendimento está em estado terminal (cancelado ou liberado).
 * Útil para bloquear edições.
 */
export function isAtendimentoTerminal(rawLabel: string | null | undefined): boolean {
  return rawLabel === "Cancelado" || rawLabel === "Pedido cancelado" || rawLabel === "Resultado Liberado";
}

/**
 * Indica se o atendimento está cancelado.
 */
export function isAtendimentoCancelado(rawLabel: string | null | undefined): boolean {
  return rawLabel === "Cancelado" || rawLabel === "Pedido cancelado";
}
