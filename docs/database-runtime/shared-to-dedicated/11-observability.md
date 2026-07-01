# 11 — Observabilidade

## Frontend

`src/runtime/db/telemetry.ts` — emite:
- `runtime.resolve.start/end`
- `runtime.client.created/cache_hit/disposed`
- `runtime.route.dedicated/shared_fallback`
- `runtime.failure`

**Apenas em dev** (`import.meta.env.DEV`). Em produção é no-op. Nenhum sink (PostHog/Sentry) plugado.

## Backend

`_shared/hardening.ts` provê `createLogger(name, requestId)` — `log.info/warn/error` com JSON estruturado por request. Usado em `tenant-runtime-config`, `tenant-dedicated-login-gate`, gate/health functions.

Tabelas de auditoria no shared:
- `platform_audit`, `operational_audit`, `atendimento_audit`, `pdf_override_audit`, `storage_audit`, `financeiro_audit`, `app_settings_audit`, `subscription_changes_log`, `tenant_provision_audit`, `tenant_migration_runs`, `tenant_migration_log`.
- `cron_health` — 9 colunas para saúde de crons.
- `tenant_registry.last_health_*` — atualizada por `tenant-healthcheck`.

## Métricas & tracing

- Sem OpenTelemetry / tracing distribuído.
- Sem exportador de métricas (Prometheus/StatsD).
- Health por tenant existe (`tenant-healthcheck` + colunas em `tenant_registry`), mas não há dashboard consolidado além de `SuperAdminMetrics`.

## Respostas objetivas

- **Visibilidade por tenant?** △ Parcial — tabelas de auditoria carregam `tenant_id`; `tenant_registry.last_health_*` dá snapshot. Não há distributed tracing, não há métrica agregada por tenant em runtime (latência, error rate, cache hit).
