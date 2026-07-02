# 13 — Production Readiness

Evidências reais no repo/plataforma (sem assumir):

| Capacidade | Evidência | Status |
|---|---|---|
| **Backup** | `super-admin-tenant-backup`, `super-admin-tenant-snapshot`, `scripts/backup-sql.ts`. Lovable Cloud faz backup gerenciado (não configurado no repo). | PARCIAL |
| **Restore** | Edge de snapshot existe; procedimento de restore end-to-end não documentado. | INCONCLUSIVO |
| **Rollback (migração de tenant)** | `super-admin-migration-rollback` — testado (memory). | ✅ |
| **Rollback (schema DB)** | 355 migrations forward-only; sem `down` migrations. | ❌ |
| **Deploy** | Lovable Cloud + push git. Sem CI/CD custom além de `.github/workflows/ci.yml`. | PARCIAL |
| **Canary** | Não encontrado. | ❌ |
| **Blue/Green** | Não encontrado. | ❌ |
| **Failover** | Nenhum secondary DB. Lovable Cloud gerenciado. | INCONCLUSIVO |
| **Disaster Recovery** | Sem RPO/RTO documentado. | ❌ |
| **Feature flags** | Não encontrado global; `tenant_lab_config` funciona como switch por tenant. | PARCIAL |
| **Smoke test pós-deploy** | `super-admin-migration-smoke-test` (escopo migração). Sem smoke aplicacional. | PARCIAL |

## Testes

- `e2e/mapa-preview-cell-formatting.spec.ts` — 1 spec Playwright.
- `src/__tests__/validation.spec.ts`, `scripts/test-rls.js`, `scripts/test-validacoes.js`.
- `supabase/tests/update_atendimento_tx_preserves_state.sql`.
- **Cobertura**: baixa em relação ao tamanho da base (469 arquivos TS).

## Achados

| # | Item | Severidade |
|---|---|---|
| PR01 | Sem down-migrations — rollback de schema manual | ALTO |
| PR02 | Sem canary / blue-green | MÉDIO |
| PR03 | RPO/RTO não documentados | ALTO |
| PR04 | Cobertura de testes baixa (~5 specs para 469 arquivos) | ALTO |
| PR05 | Restore procedure não documentado end-to-end | ALTO |
