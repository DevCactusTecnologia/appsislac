# 12 — Auditability

## Tabelas de log identificadas
- `platform_audit` — ações administrativas globais
- `atendimento_audit` — mudanças de status/resultado
- `financeiro_audit` — operações de pagamento/estorno
- `storage_audit` — upload/download signed URL
- `integration_logs` — chamadas externas (WhatsApp, PIX, providers)
- `tenant_migration_runs` — trilha da migração shared→dedicated
- `ai_chat_messages` — histórico do assistente
- `notificacoes_log`

## Escritores
- Trigger `AFTER INSERT/UPDATE/DELETE` em tabelas críticas → função `*_audit_fn`.
- RPCs `*_tx` gravam explicitamente linhas de auditoria antes de commit.
- Edge Functions gravam em `integration_logs` via `logIntegrationCall`.

## Rastreabilidade
- Campos padrão: `actor_id (uuid)`, `tenant_id`, `action`, `entity_id`, `payload_before`, `payload_after`, `created_at`, `ip`, `user_agent` (nem todas as tabelas têm `ip`/`ua`).
- Impersonation: eventos marcados por `actor_id` (super) + `on_behalf_of` — **verificar**.

## Lacunas
- Logs de auth (login/logout/refresh) ficam apenas no GoTrue interno (Supabase dashboard) — sem espelho aplicacional.
- Retenção não definida por policy.
- Sem hash/encadeamento (WORM/append-only cryptográfico) — logs podem ser alterados por service_role.
- Sem export automático para SIEM externo.

## Veredito
Rastreabilidade **presente e consistente para dados operacionais**; **fraca para auth e integridade forense**.
