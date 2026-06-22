// WhatsApp 2.0 — Fase 3E.1 — Notification Policy
// ------------------------------------------------------------------
// Resolve, por tenant, se cada tipo de notificação WhatsApp deve ser
// enviado **automaticamente** após o evento de origem ou se deve ficar
// **pendente** aguardando um clique manual do operador.
//
// Fonte de verdade: tabela `tenant_notification_settings`.
// Produtores NÃO acessam a tabela direto — chamam `getNotificationMode`.
//
// Sem segunda outbox, sem segundo dispatcher, sem fila paralela: a
// política só decide "enfileirar agora?" ou "esperar o usuário clicar".
// Quando o usuário clica em "Enviar WhatsApp", o mesmo
// `enqueueNotification` é usado.

import { supabase } from "@/integrations/supabase/client";

export type NotificationType =
  | "resultado_pronto"
  | "recoleta"
  | "orcamento"
  | "atendimento"
  | "agendamento"
  | "consulta";

export type NotificationMode = "automatic" | "manual";

export type NotificationSettings = Record<NotificationType, NotificationMode>;

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  resultado_pronto: "automatic",
  recoleta: "manual",
  orcamento: "manual",
  atendimento: "automatic",
  agendamento: "automatic",
  consulta: "automatic",
};

const COLUMN_BY_TYPE: Record<NotificationType, string> = {
  resultado_pronto: "resultado_pronto_mode",
  recoleta: "recoleta_mode",
  orcamento: "orcamento_mode",
  atendimento: "atendimento_mode",
  agendamento: "agendamento_mode",
  consulta: "consulta_mode",
};

// Cache TTL curto: configurações mudam raramente; 60s é seguro e evita
// pingar o banco a cada liberação de exame em lote.
const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { at: number; settings: NotificationSettings }>();

export function clearNotificationPolicyCache(tenantId?: string): void {
  if (tenantId) cache.delete(tenantId);
  else cache.clear();
}

export async function getNotificationSettings(
  tenantId: string,
): Promise<NotificationSettings> {
  if (!tenantId) return { ...DEFAULT_NOTIFICATION_SETTINGS };
  const hit = cache.get(tenantId);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.settings;

  const { data } = await supabase
    .from("tenant_notification_settings")
    .select(
      "resultado_pronto_mode, recoleta_mode, orcamento_mode, atendimento_mode, agendamento_mode, consulta_mode",
    )
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const settings: NotificationSettings = data
    ? {
        resultado_pronto:
          (data.resultado_pronto_mode as NotificationMode) ??
          DEFAULT_NOTIFICATION_SETTINGS.resultado_pronto,
        recoleta:
          (data.recoleta_mode as NotificationMode) ??
          DEFAULT_NOTIFICATION_SETTINGS.recoleta,
        orcamento:
          (data.orcamento_mode as NotificationMode) ??
          DEFAULT_NOTIFICATION_SETTINGS.orcamento,
        atendimento:
          (data.atendimento_mode as NotificationMode) ??
          DEFAULT_NOTIFICATION_SETTINGS.atendimento,
        agendamento:
          (data.agendamento_mode as NotificationMode) ??
          DEFAULT_NOTIFICATION_SETTINGS.agendamento,
        consulta:
          (data.consulta_mode as NotificationMode) ??
          DEFAULT_NOTIFICATION_SETTINGS.consulta,
      }
    : { ...DEFAULT_NOTIFICATION_SETTINGS };

  cache.set(tenantId, { at: Date.now(), settings });
  return settings;
}

export async function getNotificationMode(
  tenantId: string,
  type: NotificationType,
): Promise<NotificationMode> {
  const s = await getNotificationSettings(tenantId);
  return s[type];
}

export async function saveNotificationSettings(
  tenantId: string,
  settings: NotificationSettings,
): Promise<void> {
  const payload = {
    tenant_id: tenantId,
    resultado_pronto_mode: settings.resultado_pronto,
    recoleta_mode: settings.recoleta,
    orcamento_mode: settings.orcamento,
    atendimento_mode: settings.atendimento,
    agendamento_mode: settings.agendamento,
    consulta_mode: settings.consulta,
  };
  const { error } = await supabase
    .from("tenant_notification_settings")
    .upsert(payload, { onConflict: "tenant_id" });
  if (error) throw new Error(error.message || "save_notification_settings_failed");
  clearNotificationPolicyCache(tenantId);
}
