---
name: Notification policy por laboratório (Fase 3E.1)
description: Tabela tenant_notification_settings + serviço notificationPolicy decidem automatic|manual por tipo de aviso WhatsApp
type: feature
---

Política única de envio WhatsApp por tenant. **Token, número, webhook,
provider e credenciais Meta continuam exclusivos do Super Admin** —
esta política só decide se cada tipo de aviso é `automatic` (enfileira
no evento) ou `manual` (espera clique do operador).

- Tabela: `public.tenant_notification_settings` (PK `tenant_id`).
  Colunas: `resultado_pronto_mode`, `recoleta_mode`, `orcamento_mode`,
  `atendimento_mode`, `agendamento_mode`, `consulta_mode`. Type
  `public.notification_mode` = `automatic|manual`.
- Defaults: resultado/atendimento/agendamento/consulta = automatic;
  recoleta/orcamento = manual.
- RLS: SELECT por tenant ou super_admin; INSERT/UPDATE exigem
  `has_permission(auth.uid(),'configurar_lab')`.
- Serviço único: `src/lib/whatsapp/notificationPolicy.ts`
  (`getNotificationMode`, `getNotificationSettings`,
  `saveNotificationSettings`). Cache 60s por tenant. Produtores NUNCA
  leem a tabela direto.
- UI: aba **Notificações** em `/configuracoes`
  (`src/components/configuracoes/NotificacoesTab.tsx`).
- `notifyResultadoPronto({force?})` consulta a política; modo `manual`
  cancela o auto-fire e o operador dispara via "Mais ações → Enviar
  WhatsApp ao paciente" em `ResultadoDetalhe`.
- Sem segunda outbox, sem segundo dispatcher, sem template adicional —
  o caminho final continua sendo `enqueueNotification` → `whatsapp_outbox`
  → `whatsapp-dispatcher` → Meta.
