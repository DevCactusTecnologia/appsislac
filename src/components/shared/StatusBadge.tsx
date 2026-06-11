// Shared design system — re-export do StatusBadge do /super-admin
// + helpers de mapeamento para os status do laboratório.
// Princípio: nenhum componente do lab inventa cor de status própria —
// tudo passa por este wrapper para garantir consistência light/dark.

import {
  StatusBadge,
  type StatusTone,
  type StatusBadgeProps,
  toneForHealth,
  toneForProvisioningStatus,
  toneForTenantStatus,
} from "@/components/superadmin/StatusBadge";

export { StatusBadge, toneForHealth, toneForProvisioningStatus, toneForTenantStatus };
export type { StatusTone, StatusBadgeProps };

// ──────────────────────────────────────────────────────────────────
// Helpers de mapeamento — domínio do laboratório
// ──────────────────────────────────────────────────────────────────

export function toneForAtendimento(status?: string | null): StatusTone {
  switch ((status ?? "").toLowerCase()) {
    case "aguardando":
    case "agendado":
      return "pending";
    case "em coleta":
    case "coletando":
    case "em análise":
    case "em analise":
    case "analisando":
      return "provisioning";
    case "concluído":
    case "concluido":
    case "finalizado":
    case "liberado":
      return "active";
    case "cancelado":
      return "failed";
    case "pendente":
      return "pending";
    default:
      return "neutral";
  }
}

export function toneForColeta(status?: string | null): StatusTone {
  switch ((status ?? "").toLowerCase()) {
    case "aguardando coleta":
    case "aguardando":
      return "pending";
    case "coletado":
    case "coletada":
      return "active";
    case "recoleta":
      return "failed";
    case "em andamento":
      return "provisioning";
    default:
      return "neutral";
  }
}

export function toneForAnalise(status?: string | null): StatusTone {
  switch ((status ?? "").toLowerCase()) {
    case "aguardando análise":
    case "aguardando analise":
      return "pending";
    case "em análise":
    case "em analise":
      return "provisioning";
    case "analisado":
    case "concluído":
    case "concluido":
      return "active";
    case "rejeitado":
    case "recoleta":
      return "failed";
    default:
      return "neutral";
  }
}

export function toneForResultado(status?: string | null): StatusTone {
  switch ((status ?? "").toLowerCase()) {
    case "liberado":
    case "validado":
      return "active";
    case "aguardando validação":
    case "aguardando validacao":
    case "pendente":
      return "pending";
    case "em digitação":
    case "em digitacao":
    case "digitando":
      return "provisioning";
    case "bloqueado":
    case "rejeitado":
      return "failed";
    default:
      return "neutral";
  }
}

export function toneForFinanceiro(status?: string | null): StatusTone {
  switch ((status ?? "").toLowerCase()) {
    case "pago":
    case "quitado":
      return "active";
    case "parcial":
    case "parcialmente pago":
      return "pending";
    case "pendente":
    case "em aberto":
      return "pending";
    case "vencido":
    case "atrasado":
      return "failed";
    case "estornado":
    case "cancelado":
      return "suspended";
    default:
      return "neutral";
  }
}
