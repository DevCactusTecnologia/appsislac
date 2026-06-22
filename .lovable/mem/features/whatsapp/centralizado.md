---
name: WhatsApp 2.0 corporativo
description: Arquitetura centralizada Meta — outbox + dispatcher + opt-out + rate limit + templates como SSOT
type: feature
---

WhatsApp do SISLAC é **corporativo centralizado**:

- **1 Conta Meta Business** (credenciais em Secrets: `WHATSAPP_META_PHONE_NUMBER_ID`, `WHATSAPP_META_ACCESS_TOKEN`, `WHATSAPP_META_VERIFY_TOKEN`, `WHATSAPP_META_APP_SECRET`, `WHATSAPP_META_BUSINESS_ACCOUNT_ID`).
- **Meta = SSOT dos templates.** Tabela `whatsapp_templates_cache` é populada SOMENTE pela edge function `whatsapp-template-sync`. Proibido cadastro manual de template no SISLAC.
- **Produtores chamam `enqueueNotification()`** (`src/lib/whatsapp/enqueueNotification.ts`). Nunca chamar Meta direto, nem `whatsapp-send` em código novo.
- **Pipeline:** `enqueue_whatsapp` RPC → `whatsapp_outbox` → `whatsapp-dispatcher` (imediato + cron de retry) → Meta → `whatsapp_mensagens` + `whatsapp_metrics_tenant`.
- **Opt-out:** tabela `whatsapp_opt_out` (paciente prioritário, telefone fallback). Captura automática no webhook em `STOP/SAIR/CANCELAR/PARAR/UNSUBSCRIBE`. Templates `AUTHENTICATION` (OTP) ignoram opt-out.
- **Rate limit por tenant:** `tenant_rate_limit` (defaults 250/h, 1000/dia). Protege quality rating corporativo.
- **Painel único:** `/super-admin/notificacoes` (KPIs, outbox, templates, opt-outs). Sem editor de campanha, sem chatbot, sem IA, sem disparo em massa.
- **Legado `whatsapp-send` + `simples/cloud_api/zapi`:** marcados `@deprecated`. Mantidos enquanto houver tenant nesses modos. Remover apenas com 0 imports / 0 referências.

Todo novo produtor deve usar `enqueueNotification`. Qualquer fluxo que ainda usa `wa.me` ou `whatsapp-send` é tecnicamente legado e deve ser migrado quando o template Meta correspondente estiver aprovado.
