# 10 — Production Observability

## Observabilidade aplicacional

| Sinal | Status | Evidência |
|---|---|---|
| Logs de edge | ✅ | Cloud dashboard (retenção limitada, não confirmada) |
| Logs de DB | ✅ | pg_stat_statements ativo (slow_queries respondeu) |
| Trilhas de auditoria | ✅ | `platform_audit`, `atendimento_audit`, `financeiro_audit`, `storage_audit`, `integration_logs`, `operational_audit`, `audit_logs` |
| APM / tracing distribuído | ❌ | Sem OpenTelemetry, Sentry, Datadog no repo |
| Métricas custom (Prom/OTel) | ❌ | Nenhum exporter |
| Alertas | ❌ | Nenhum canal configurado no repo |
| Health check | Parcial | `provider-health-aggregator` (integrações); sem `/healthz` app |
| Readiness | ❌ | Não aplicável (SPA + serverless) mas sem check de dependências |
| Liveness | ❌ | Delegado ao Cloud provider |
| SLO / SLA | ❌ | Sem documentação |

## Métricas de negócio

- `producaoMetricsStore.ts`, `useDashboardKpis.ts` — KPIs derivados de queries, não métricas emitidas.

## Achados

| # | Item | Severidade |
|---|---|---|
| O01 | Sem APM / tracing distribuído | ALTO |
| O02 | Sem alerta ativo (email/slack/pagerduty) configurado | ALTO |
| O03 | Sem SLO documentado | MÉDIO |
| O04 | Auditoria aplicacional forte, observabilidade operacional fraca | MÉDIO |
