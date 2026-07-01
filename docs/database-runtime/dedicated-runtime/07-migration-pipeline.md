# 07 — Migration Pipeline

## Status: PLANEJADO — execução no Slice 5

## State machine idempotente

Refatorar `SuperAdminMigration.tsx` como state machine em `tenant_migration_runs.phase`:

```text
provision-schema
    ↓ idempotente via _sislac_schema_health
configure-jwt-federation  ← NOVO
    ↓ documenta chave pública + probe select auth.uid()
migrate-data              ← NOVO
    ↓ pg_dump lógico shared → restore dedicated (tenant-scoped)
migrate-auth
    ↓ dump auth.users tenant + user_roles/profiles
migrate-storage
    ↓ + checksum SHA-256
smoke-test                ← NOVO
    ↓ probe cada domínio (atendimento/resultado/financeiro/whatsapp)
flip                      ← NOVO
    ↓ atomic UPDATE tenant_registry SET database_strategy='dedicated'
    ↓ + invalidateDedicatedCache + broadcast
monitor                   ← NOVO
    ↓ janela 24h dupla-leitura (opcional canary)
```

Cada etapa:
- Lê estado da anterior via `tenant_migration_runs`.
- Salva progresso em `tenant_migration_runs.stats`.
- Idempotente: chamar 2x = mesmo resultado.

## Rollback

Ponto único: `super-admin-migration-rollback` (já existe). Amplia para:
- Reverter `database_strategy` para `shared`.
- Invalidar cache dedicated em todos os edge workers.
- Deixar dedicated intacto (dados preservados para próxima tentativa).

## Status

| Etapa | Estado |
|---|---|
| provision-schema | ✓ idempotente |
| configure-jwt-federation | ✗ pendente |
| migrate-data | ✗ pendente |
| migrate-auth | ✓ existe (revisar após federation) |
| migrate-storage | ✓ existe (falta checksum) |
| smoke-test | ✗ pendente |
| flip | ✗ pendente |
| monitor | ✗ pendente |
| rollback | ✓ existe |
