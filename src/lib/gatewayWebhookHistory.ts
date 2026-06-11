/**
 * Histórico local de eventos de webhook dos gateways de pagamento.
 * Compartilhado entre a tela de configuração (Configurações → Gateway de
 * pagamento) e o painel de auditoria em /financeiro (aba Integrações).
 *
 * Persistido em localStorage. É um log local de validações/recebimentos,
 * sem dependência de backend.
 */
const HISTORY_KEY = "sislac:gatewayPagamento:webhookHistory";
export const HISTORY_MAX = 50;

export type WebhookProvider = "mercado_pago" | "infinitepay";
export type WebhookAmbiente = "sandbox" | "producao";

export interface WebhookEvent {
  id: string;
  provider: WebhookProvider;
  ambiente: WebhookAmbiente;
  timestamp: string; // ISO
  status: "success" | "error";
  message: string;
  url?: string;
}

export const WEBHOOK_PROVIDER_LABEL: Record<WebhookProvider, string> = {
  mercado_pago: "Mercado Pago",
  infinitepay: "InfinitePay",
};

export function readWebhookHistory(): WebhookEvent[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function appendWebhookEvent(ev: WebhookEvent): WebhookEvent[] {
  const list = [ev, ...readWebhookHistory()].slice(0, HISTORY_MAX);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
  return list;
}

export function clearWebhookHistory(): void {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    /* ignore */
  }
}
