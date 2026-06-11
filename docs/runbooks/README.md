# Runbooks Operacionais — SISLAC

Procedimentos canônicos de resposta a incidentes para a plataforma SISLAC
(Lovable Cloud + edge functions + pg_cron). Cada runbook segue o formato:

1. **Sintomas** — como o problema aparece (alerta, log, reclamação do usuário).
2. **Diagnóstico** — queries/comandos para confirmar o escopo.
3. **Mitigação** — ações de curto prazo para restaurar serviço.
4. **Correção definitiva** — passos para fechar o incidente.
5. **Pós-mortem** — o que registrar e onde.

## Índice

| Runbook | Quando usar |
|---|---|
| [cron-parado.md](./cron-parado.md) | Um ou mais jobs `pg_cron` pararam de executar. |
| [webhook-falhando.md](./webhook-falhando.md) | Webhooks (pagamento, WhatsApp, integrações) com falha recorrente. |
| [provider-offline.md](./provider-offline.md) | Provedor de integração (DBSync, Hermes Pardini, lab de apoio) offline. |
| [rollback.md](./rollback.md) | Reverter um deploy com regressão em PROD. |
| [backup-restore.md](./backup-restore.md) | Política de backup e procedimento de restore. |
| [tenant-auth-issues.md](./tenant-auth-issues.md) | Usuário/tenant sem acesso, RLS suspeita, super_admin lock-out. |

## Princípios

- **Mitigar antes de investigar.** Restaurar serviço primeiro; root cause depois.
- **Nunca rodar comandos destrutivos sem dry-run.** Toda query mutativa precisa
  ser precedida de um `SELECT` equivalente.
- **Tudo registrado.** Toda ação manual em PROD vira nota no canal #ops e,
  quando aplicável, entrada em `audit_logs` ou `cron_health`.
- **Confirmar tenant.** Antes de mexer em dados, validar `tenant_id` afetado —
  jamais rodar UPDATE/DELETE sem filtro de tenant em tabelas operacionais.
- **Escalonar cedo.** Se a mitigação não estabilizar em 15 min, chamar o owner
  da área (ver `mem://architecture/secrets-inventory` quando disponível).

## Acesso

- **Lovable Cloud (DB + edge functions + logs):** painel "Cloud" no projeto.
- **Super admin UI:** `/super-admin` (apenas usuários com role `super_admin`).
- **Vault / secrets:** super_admin via edge function `bootstrap-cron-secret`
  ou painel de secrets da Cloud.