# 08 — Events

Inventário de eventos disparados.

## Eventos de domínio (~60 identificados na Fase 03)
- Atendimento: criado, atualizado, cancelado, exame_adicionado, exame_removido.
- Coleta: coletado, recoletado.
- Análise: iniciada, analisado.
- Resultado: liberado, assinado, entregue, retificado.
- Financeiro: pagamento_registrado, pagamento_quitado, saida_registrada, estorno.
- Caixa: aberto, fechado.
- Fatura: fechada, glosa_registrada.
- Amostra: movida, emprestada, expurgada.
- Integração: job_enfileirado, job_completado, job_dead, circuit_open, circuit_close.
- Migração: schema_provisionado, auth_migrada, data_migrada, storage_migrada, flip_realizado, rollback, purge.

## Eventos técnicos
- `supabase.auth.onAuthStateChange` (SIGNED_IN/SIGNED_OUT/TOKEN_REFRESHED).
- `installQueryClientTenantReset` — reset de cache.
- `clearTenantContextCache`.

## Eventos de auditoria
- Escrita em `atendimento_audit`, `financeiro_audit`, `storage_audit`, `pdf_override_audit`, `app_settings_audit`, `platform_audit`, `tenant_provision_audit`, `subscription_changes_log`, `operational_audit`, `protocolo_auditoria`, `audit_logs`, `ai_audit`.
- 100% side-effect de trigger `audit_<tabela>` — jamais escritos pela aplicação.

## Eventos de integração
- Providers: HermesPardini/DBSync (SOAP/HTTP).
- Webhook PIX.
- Lovable AI Gateway (Gemini).

## Eventos de UI
- Realtime broadcast → refetch.
- Framer-motion layoutId (transição visual).
- Toasts via `use-toast`.
- `criticos_comunicacoes` → notificação de valor crítico.
