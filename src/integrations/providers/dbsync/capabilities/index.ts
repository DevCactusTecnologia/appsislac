import type { ProviderCapabilities } from "../../../contracts/capabilities";

/**
 * Capacidades declaradas pelo DBSync (DB Diagnósticos).
 *
 * Embora declaradas como `true`, NÃO implica que estejam implementadas
 * nesta rodada — apenas reserva semântica para o frontend já saber
 * o que o provider é capaz de fazer quando ativado.
 *
 * Implementações reais ficam na responsabilidade do dispatcher
 * (em rodadas futuras).
 */
export const DBSYNC_CAPABILITIES: ProviderCapabilities = {
  send_order: true,
  polling: true,
  fetch_pdf: true,
  fetch_pending: true,
  fetch_trace: true,
  fetch_label: true,
  cancel_exam: false,
  cancel_sample: false,
  webhook: false,
};