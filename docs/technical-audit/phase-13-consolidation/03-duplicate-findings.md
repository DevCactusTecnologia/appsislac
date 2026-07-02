# 03 — Duplicate Findings

Achados que aparecem em múltiplas fases são consolidados em um único ID na matriz mestre (relatório 04). Abaixo o mapa de duplicidade.

| Tema | Fases | Consolidado em |
|---|---|---|
| Ausência de APM/tracing/alertas ativos | 07 (parcial), 10, 12 | F-OBS-01 |
| Ausência de staging | 10, 12 | F-ENV-01 |
| Sem down-migrations / rollback de schema | 10, 12 | F-MIG-01 |
| Sem restore documentado / RPO/RTO ausentes | 10, 12 | F-DR-01 |
| Cobertura de testes baixa | 08, 10, 11 | F-QA-01 |
| Arquivos densos (>800 LOC) | 08, 11 | F-CODE-01 |
| Dualidade fetch (stores custom × TanStack Query) | 08, 11 | F-FE-01 |
| Edge Functions fora do `edgeBoot` (60/74) | 07, 11 | F-BE-01 |
| Runtime dedicated implementado sem uso produtivo | 10, 11 | F-RT-01 |
| Rate-limit in-memory bypassável | 09, 10 | F-SEC-05 |
| Buckets públicos `tenant-site/tenant-assets` | 09 | F-SEC-04 (único) |
| JWT em `localStorage` | 09 | F-SEC-01 (único) |
| MFA opcional (inclusive super_admin) | 09 | F-SEC-02 (único) |
| Policy `doc_templates_demo_anon_select` | 09 | F-SEC-03 (único) |
| Portal LGPD do titular ausente | 09 | F-LGPD-01 (único) |
| Anonimização automática LGPD ausente | 09 | F-LGPD-02 (único) |
| Sanitização SVG inconfirmada | 09 | F-SEC-06 (único) |
| OFFSET pagination em `documento_templates`/`pacientes` | 10 | F-PERF-01 (único) |
| Sem particionamento em tabelas hot (audit_logs, whatsapp_outbox) | 10 | F-PERF-02 (único) |
| Dependências externas sem fallback | 12 | F-DEP-01 (único) |
| Sem runbooks de incidente | 12 | F-OPS-01 (único) |
| Secrets sem rotação automática | 09, 12 | F-SEC-07 |

## Total
- Achados brutos citados nas fases 09/10/11/12: ~74
- Após deduplicação: **44 achados únicos** (ver relatório 04).
