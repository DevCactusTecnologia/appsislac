# 01 — Intervention Groups

Base: 24 achados CORRIGIR da Decision Matrix (Phase 13/10).

Agrupamento por natureza operacional (menor conjunto de mudanças coerentes):

| Grupo | Achados absorvidos | Natureza |
|---|---|---|
| G1 — Sessão & MFA | F-SEC-01, F-SEC-02, F-SEC-10 | Config Supabase Auth + hardening cliente |
| G2 — RLS/Policies pontuais | F-SEC-03, F-SEC-04 | 2 policies + 2 buckets |
| G3 — Uploads server-side | F-SEC-06, F-SEC-08 | 1 edge de validação de upload |
| G4 — Rate-limit & Rotação | F-SEC-05, F-SEC-07 | Config + rotina documentada |
| G5 — Auth hygiene | F-SEC-11 | Config GoTrue |
| G6 — LGPD mínimo | F-LGPD-01, F-LGPD-02 | 1 página portal + 1 job cron |
| G7 — Backup & Restore | F-DR-01, F-DR-02, F-MIG-01 | Runbook + script backup Storage + down-migrations |
| G8 — Runbooks & DR | F-OPS-01, F-DEP-01 | Documentação operacional |
| G9 — Observabilidade | F-OBS-01 | Integração 1 APM (Sentry) |
| G10 — Ambientes | F-ENV-01 | Provisionar staging Lovable Cloud |
| G11 — Performance pontual | F-PERF-01, F-PERF-02, F-PERF-04 | Keyset pagination + partição + virtualização |
| G12 — Qualidade de código | F-QA-01, F-CODE-01 | Testes críticos + split de 2-3 arquivos gigantes |
| G13 — Frontend cleanup | F-FE-03 | Remover landing duplicada |
| G14 — Documentação | F-DOC-01 | Runbooks (coincide com G7/G8) → absorvido |

**Grupos reais de intervenção: 13** (G14 é absorvido por G7+G8).
