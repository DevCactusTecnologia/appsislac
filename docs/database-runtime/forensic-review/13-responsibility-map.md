# 13 — Diagrama de Responsabilidades

Uma linha por componente. Quando há mais de uma responsabilidade, apenas registro.

## Client
- `db/index.ts` — Fachada única de acesso a Supabase. **[+ 1 responsabilidade extra: rotear `from()` por tabela.]**
- `db/factory.ts` — Cache de clientes por contexto. **[+ criar dois transports simultâneos por contexto.]**
- `db/resolver.ts` — Converter `TenantContext` legado em `TenantRuntimeContext`.
- `db/tenantContext.ts` — Descobrir tenant do usuário logado. **[+ chamar edge `tenant-runtime-config`; + cachear nome do tenant; + instalar listener de auth.]**
- `db/telemetry.ts` — Emitir eventos `runtime.*`.
- `db/types.ts` — Definir tipos canônicos.
- `db/strategies/shared.ts` — Adaptar transport shared ao contrato.
- `db/strategies/dedicated.ts` — Criar client contra projeto dedicado.
- `identity/index.ts` — Definir contrato de identidade.
- `identity/supabaseIssuer.ts` — Implementar contrato via Supabase Shared.

## Server
- `_shared/runtime/createClient.ts` — Reexportar `createClient`.
- `_shared/runtime/db.ts` — Criar clients (platform/user/tenant/user-tenant). **[+ cache LRU dedicado; + health probe; + definir `MigrationBlockedError`.]**
- `_shared/runtime/identity.ts` — Extrair claims JWT do header.
- `_shared/runtime/tenantContext.ts` — Ler `tenant_registry` e decidir estratégia.
- `_shared/migration/connect.ts` — Conectar via postgres.js no dedicated. **[+ auditar runs (`beginRun`/`finishRun`); + validar super_admin; + criar userClient a partir de request.]**

## Edge functions (grupos)
- `super-admin-create-tenant` — Criar tenant.
- `super-admin-update-tenant-db-config` — Registrar credenciais dedicado.
- `super-admin-provision-tenant-schema[-full]` — Criar schema no dedicado.
- `super-admin-check-tenant-schema` — Comparar schema.
- `super-admin-test-tenant-{db,anon-key}` — Validar conectividade.
- `super-admin-migrate-tenant-{auth,data,storage}` — Copiar por camada.
- `super-admin-migration-{flip,rollback,smoke-test}` — Chavear estratégia.
- `super-admin-purge-tenant-from-shared` — Apagar no shared após flip.
- `super-admin-tenant-{snapshot,backup}` — Snapshots pontuais.
- `super-admin-import-tenant-admin` — Importar admin inicial no dedicado.
- `tenant-runtime-config` — Servir credenciais ao cliente.
- `tenant-healthcheck` — Reportar saúde do dedicado.
- `tenant-dedicated-login-gate` — Gate de login (não usado).
- `tenant-resolve` — Resolver tenant (duplica outras).

## Migrations
- `20260525130936_*` — Criar `tenant_registry` + `tenant_migration_runs`.
- `20260525134033_*` — Criar RPCs de dump.
- `20260701010019_*` — Adicionar `db_project_url`, `db_anon_key_secret_ref`, `schema_provisioned_at`.
- `20260701012659_*` — Adicionar `runtime_dedicated_enabled`.
- `20260701032431_*` — Adicionar `migration_state`, `frozen_at`.

## UI
- `SuperAdminMigration.tsx` — Orquestrar wizard de migração.
- `TenantDatabaseConfig.tsx` — Formulário de configuração + testes.

## Registro de componentes com responsabilidade múltipla
- `db/tenantContext.ts` (4 responsabilidades).
- `_shared/runtime/db.ts` (4 responsabilidades).
- `_shared/migration/connect.ts` (4 responsabilidades).
- `db/factory.ts` (2 responsabilidades).
- `db/index.ts` (2 responsabilidades).
