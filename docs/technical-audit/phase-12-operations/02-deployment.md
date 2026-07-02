# 02 — Deployment

| Item | Evidência | Status |
|---|---|---|
| Deploy frontend | Lovable Cloud (botão Publish) — sem workflow custom | ✓ COMPROVADA |
| Deploy edge functions | Automático via Lovable Cloud ao salvar `supabase/functions/*` | ✓ COMPROVADA |
| Deploy migrations | Automático via Lovable Cloud (`supabase/migrations/`) | ✓ COMPROVADA |
| Pipeline CI bloqueante | `.github/workflows/ci.yml` (guards, typecheck, lint, test, build) | ✓ COMPROVADA |
| Aprovação manual (gate) | Nenhuma etapa `environment:` com reviewers no workflow | ✗ NÃO ENCONTRADA |
| Rollback frontend | Restore de versão via Lovable UI | △ PARCIALMENTE COMPROVADA |
| Rollback edge/migration | Sem down-migrations; edges são forward-only | ✗ NÃO ENCONTRADA |
| Versionamento | Git — sem tags/semver observadas no repo | △ PARCIALMENTE COMPROVADA |
| Deploy tenant flip/rollback | `super-admin-migration-flip`, `super-admin-migration-rollback` (janela 30d) | ✓ COMPROVADA |

## Achados
| # | Item | Severidade |
|---|---|---|
| DEP01 | Sem gate de aprovação em produção | ALTO |
| DEP02 | Sem versionamento semântico/tags | MÉDIO |
| DEP03 | Sem down-migrations | ALTO |
