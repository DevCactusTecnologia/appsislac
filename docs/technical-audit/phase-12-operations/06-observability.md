# 06 — Observability

| Sinal | Evidência | Status |
|---|---|---|
| Logs Edge | Lovable Cloud dashboard + `createLogger` em `_shared/hardening.ts` | ✓ COMPROVADA |
| Logs DB | `pg_stat_statements` ativo | ✓ COMPROVADA |
| Auditoria aplicacional | `platform_audit`, `atendimento_audit`, `financeiro_audit`, `operational_audit`, `audit_logs` | ✓ COMPROVADA |
| Tracing distribuído (OTel) | Nenhum import | ✗ NÃO ENCONTRADA |
| APM (Sentry/Datadog) | Nenhuma dependência | ✗ NÃO ENCONTRADA |
| Métricas Prometheus | Nenhum exporter | ✗ NÃO ENCONTRADA |
| Dashboards | Nenhum (apenas KPIs internos `useDashboardKpis`) | ✗ NÃO ENCONTRADA |
| Alertas ativos | Nenhum canal | ✗ NÃO ENCONTRADA |
| Health Check `/healthz` | Nenhum endpoint (SPA); `provider-health-aggregator` cobre integrações | △ PARCIALMENTE COMPROVADA |
| Readiness / Liveness | Delegado ao Cloud | ✗ NÃO ENCONTRADA |
| SLO/SLA | Nenhum documento | ✗ NÃO ENCONTRADA |

## Achados
| # | Item | Severidade |
|---|---|---|
| OBS01 | Sem APM/tracing | ALTO |
| OBS02 | Sem alertas ativos | CRÍTICO |
| OBS03 | Sem SLO documentado | ALTO |
| OBS04 | Sem dashboards operacionais | MÉDIO |
