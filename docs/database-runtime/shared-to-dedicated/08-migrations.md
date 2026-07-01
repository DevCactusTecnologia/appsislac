# 08 — Migrations

## Volume

- **351 arquivos** em `supabase/migrations/`.
- Todas versionadas pelo CLI Supabase; aplicadas linearmente no projeto shared.

## Aplicabilidade em dedicated

O provisionamento do banco dedicado é feito por `super-admin-provision-tenant-schema-full` — que **não executa `supabase/migrations/*`**. Em vez disso, aplica um `SCHEMA_MINIMO_V1` (subset embutido em código) via `pg` driver direto.

## Bloqueadores para rodar migrations em dedicated

1. Muitas migrations criam tabelas control-plane (`tenant_registry`, `tenants`, `subscription_plans`, `signup_attempts`, `platform_audit`, `saas_settings`, `tenant_provision_audit`, `tenant_migration_runs`, etc.) que **não devem existir no dedicated**.
2. Algumas migrations fazem `INSERT`/`UPDATE` em dados operacionais existentes — não são idempotentes para um banco novo.
3. Referências a funções/extensões que precisam ser instaladas na ordem exata (`pgcrypto`, `unaccent`, `uuid-ossp`).
4. Não há tag/prefixo separando "control-plane only" de "tenant-scoped".

## SQL fixo / referências absolutas

- Nenhum uso de `postgres_fdw` ou dblink identificado.
- Referências a project_ref ficam no runtime (`db_project_url`), não em SQL.
- Storage buckets são criados por SQL em algumas migrations — não replicados no dedicated.

## Respostas objetivas

- **Podem rodar em Shared?** ✓ Sim (rodam em produção).
- **Podem rodar em Dedicated?** ✗ Não em bloco — precisariam ser triadas em "tenant-scoped" vs "platform-scoped".
- **Dependência de projeto?** Sim — migrations criam control-plane que só faz sentido no shared.
- **SQL fixo/absoluto?** Não identificado.
