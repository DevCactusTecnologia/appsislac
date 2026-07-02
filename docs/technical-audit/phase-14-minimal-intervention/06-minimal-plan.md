# 06 — Minimal Plan

13 intervenções obrigatórias. Cada uma rastreável a achado(s) Phase 13.

| ID | Objetivo | Achados | Arquivos | Impacto | Complex. | Estim. | Depende de |
|---|---|---|---|---|---|---|---|
| I01 | MFA obrigatório super_admin + refresh via cookie httpOnly | F-SEC-01, F-SEC-02, F-SEC-10 | AuthContext, config Supabase, guard super-admin | Login super_admin muda | BAIXA | 1d | — |
| I02 | Remover policy anon `doc_templates_demo_anon_select` + tornar buckets `tenant-site`/`tenant-assets` privados com signed URLs | F-SEC-03, F-SEC-04 | 1 migration + code de geração de URL | Assets via URL assinada | BAIXA | 0.5d | — |
| I03 | Edge `upload-guard` (mime sniff, block svg/exe) | F-SEC-06, F-SEC-08 | 1 edge + hooks de upload | Upload passa por edge | BAIXA | 1d | — |
| I04 | Rate-limit persistido em tabela + rotina de rotação service-role documentada | F-SEC-05, F-SEC-07 | 1 migration + doc | Nenhum runtime | BAIXA | 1d | — |
| I05 | Fechar enumeração no signup GoTrue | F-SEC-11 | 1 config | Nenhum | MÍNIMA | 0.2d | — |
| I06 | Portal do titular `/privacidade/meus-dados` + edge cron `lgpd-anonymize` | F-LGPD-01, F-LGPD-02 | 1 página + 1 edge + 1 tabela request | Público | BAIXA | 2d | I02 |
| I07 | Backup Storage + procedimento de restore end-to-end + drill trimestral + down-migration template | F-DR-01, F-DR-02, F-MIG-01 | 2 scripts + 1 runbook + 1 CI job | Rotina ops | MÉDIA | 3d | I10 |
| I08 | Runbooks: incident, DR, dependências | F-OPS-01, F-DEP-01, F-DOC-01 | 4 .md | Governança | MÍNIMA | 1d | — |
| I09 | Integrar Sentry (frontend + edges wrapper) | F-OBS-01 | main.tsx + edgeBoot | Erros visíveis | BAIXA | 1d | — |
| I10 | Provisionar staging (tenant Cloud dedicado + `.env.staging`) | F-ENV-01 | .env + config | Deploy seguro | BAIXA | 0.5d | — |
| I11 | Keyset em `documento_templates` + partição mensal `audit_logs`/`whatsapp_outbox` + `react-window` em 2 listas hot | F-PERF-01, F-PERF-02, F-PERF-04 | 1 store + 1 migration + 2 componentes | Perf | MÉDIA | 3d | — |
| I12 | Testes de contrato 8 RPCs críticas + smoke Playwright fluxo clínico; split `ResultadoDetalhe.tsx` e `NovoAtendimento.tsx` por seções existentes | F-QA-01, F-CODE-01 | +20 specs + 2 splits | Manutenção | MÉDIA | 5d | I10 |
| I13 | Remover `LandingPageResponsive.tsx` e consolidar rota | F-FE-03 | 1 remoção + rota | Simplifica | MÍNIMA | 0.2d | — |

**Total: 13 intervenções obrigatórias.** Estimativa somada: ~19 dias-engenheiro.
