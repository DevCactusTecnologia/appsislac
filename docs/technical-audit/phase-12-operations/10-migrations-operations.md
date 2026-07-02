# 10 — Migrations Operations

| Item | Evidência | Status |
|---|---|---|
| Migrations versionadas | 355 arquivos em `supabase/migrations/` | ✓ COMPROVADA |
| Aplicação automática | Lovable Cloud aplica ao salvar | ✓ COMPROVADA |
| Down-migrations | Nenhuma | ✗ NÃO ENCONTRADA |
| Rollback de schema | Manual | ✗ NÃO ENCONTRADA |
| Validação (linter) | `supabase--linter` disponível; não invocado no CI | △ PARCIALMENTE COMPROVADA |
| Teste SQL | `supabase/tests/update_atendimento_tx_preserves_state.sql` | ✓ COMPROVADA (1 caso) |
| Migração de tenant Shared→Dedicated | `super-admin-migrate-tenant-{auth,data,storage}`, `-flip`, `-rollback`, `-smoke-test` | ✓ COMPROVADA |
| Auditoria de runs | Tabela `tenant_migration_runs` | ✓ COMPROVADA |

## Achados
| # | Item | Severidade |
|---|---|---|
| MIG01 | Sem down-migrations | ALTO |
| MIG02 | Sem linter/validador no CI para migrations | MÉDIO |
| MIG03 | Cobertura de testes SQL mínima | ALTO |
