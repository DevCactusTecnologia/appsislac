# 11 — Impact Estimation

Contabilidade agregada das 13 intervenções (Phase 14/06).

| Métrica | Total estimado |
|---|---|
| Arquivos criados | ~15 (edges, scripts, runbooks, specs) |
| Arquivos modificados | ~12 (AuthContext, stores, main.tsx, hooks upload, rotas) |
| Arquivos removidos | 1 (LandingPageResponsive) + 1 landing route |
| Migrations SQL | 4 (policies/buckets, rate_limit, particionamento, portal LGPD) |
| Edge Functions novas | 3 (`upload-guard`, `lgpd-anonymize`, opcional wrapper Sentry) |
| Edge Functions modificadas | ~5 (edgeBoot + Sentry wrapper) |
| Páginas novas | 1 (`/privacidade/meus-dados`) |
| Componentes tocados | ~4 (2 listas virtualizadas, 2 splits) |
| LOC líquidas | +2.500 / -800 = **+1.700 LOC** |
| Módulos novos | 0 |
| Camadas novas | 0 |
| Providers novos | 0 |
| Dependências npm novas | 2 (`@sentry/react`, `react-window`) |
| Dependências edge novas | 1 (`file-type` deno) |

**Impacto arquitetural: nulo.** Todas as mudanças são aditivas ou pontuais.
