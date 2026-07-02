# 03 — Risk Reduction

Justificativa evidencial (fase de origem entre parênteses).

| Grupo | Risco eliminado | Complexidade | LOC est. | Arquivos | Impacto operacional |
|---|---|---|---|---|---|
| G1 | XSS-hijack de JWT + acesso indevido super_admin (09/02, 09/07) | BAIXA | ~150 | 3 (AuthContext, config, guard) | Login super_admin exige MFA |
| G2 | Vazamento anon templates + enum path buckets (09/04, 09/14) | MÍNIMA | ~30 SQL | 1 migration + 2 buckets | Nenhum |
| G3 | Upload malicioso SVG/executáveis (09/09, 09/14 M02) | BAIXA | ~200 | 1 edge + 1 hook | Upload passa por edge |
| G4 | Rate-limit bypass isolates + service-role stale (09/14 M03/M04) | BAIXA | ~80 | 1 tabela + 1 doc | Rotação trimestral doc |
| G5 | Enumeração usuários signup (09/14 M08) | MÍNIMA | 0 código | 1 config Supabase | Nenhum |
| G6 | Não conformidade LGPD Art.18 (09/11) | BAIXA | ~300 | 1 página + 1 cron edge | Portal titular público |
| G7 | Perda de dados sem restore (12/04) — **CRÍTICO** | MÉDIA | ~400 | 2 scripts + 1 runbook + 1 migration down | Drill trimestral |
| G8 | Sem plano incidente/DR (12/05, 12/11) | MÍNIMA | 0 código | 4 .md runbooks | Governança operacional |
| G9 | Sem alertas ativos (12/06) | BAIXA | ~50 | 1 init Sentry | Erros visíveis |
| G10 | Dev==Prod (12/01) | BAIXA | 0 código | 1 tenant Cloud + .env staging | Deploy seguro |
| G11 | OFFSET lento + audit_logs sem partição + listas travando (10/03, 10/11, 10/05) | MÉDIA | ~250 | 3-4 arquivos + 1 migration | Perf visível |
| G12 | Baixa cobertura + arquivos gigantes (11/09, 11/02) | MÉDIA | tests only | +20 spec files | Manutenibilidade |
| G13 | Landing duplicada (08/03) | MÍNIMA | -600 | remove 1 arquivo | Simplifica |

Risco total eliminado (soma ponderada CRÍT+ALTO): ~90% dos achados CORRIGIR.
