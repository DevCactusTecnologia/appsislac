# 02 — Inventory

Tudo relacionado ao Dedicated Runtime que existe hoje.

## Runtime cliente (`src/runtime/`) — 555 linhas
| Arquivo | Linhas | Papel |
|---|---:|---|
| `db/index.ts` | 73 | Fachada `db` (Proxy) + roteamento `from()` por tabela |
| `db/factory.ts` | 117 | Cache de clientes por contexto; `refreshContext`, `resetRuntime` |
| `db/resolver.ts` | 56 | Converte `TenantContext` legado → `TenantRuntimeContext` |
| `db/tenantContext.ts` | 148 | Descobre tenant do usuário; chama edge `tenant-runtime-config` |
| `db/telemetry.ts` | 25 | `emit()` de eventos (`runtime.*`) — apenas `console.debug` |
| `db/types.ts` | 72 | `RuntimeClient`, `TenantRuntimeContext`, `RuntimeError`, `MigrationBlockedError` |
| `db/strategies/shared.ts` | 22 | Reusa `supabase` singleton |
| `db/strategies/dedicated.ts` | 53 | `createClient(url, anon)` cacheado |
| `identity/index.ts` | 61 | Contrato `IdentityIssuer` + registry |
| `identity/supabaseIssuer.ts` | 55 | Implementação default via `sharedClient.auth` |
| `db/__tests__/runtime.smoke.test.ts` | ~ | Smoke da fachada |

## Runtime servidor (`supabase/functions/_shared/`) — 530 linhas
| Arquivo | Linhas | Papel |
|---|---:|---|
| `runtime/createClient.ts` | 14 | Reexporta `createClient` do supabase-js (para reduzir imports) |
| `runtime/db.ts` | 227 | `getPlatformClient`, `getUserClient`, `getTenantClient`, `getUserTenantClient`, cache dedicated, `dedicatedHealth`, `invalidateDedicatedCache`, `MigrationBlockedError` |
| `runtime/identity.ts` | 56 | `ServerIdentityValidator` (decode-only JWT) |
| `runtime/tenantContext.ts` | 78 | `TenantContextProvider` + `SupabaseRegistryProvider` |
| `migration/connect.ts` | 155 | `loadRegistry`, `connectDedicated` (postgres.js), `requireSuperAdmin`, `beginRun/finishRun`, `assertSchemaProvisioned` |

## Edge Functions — dedicated-specific (20)
Control-plane / provisionamento:
- `super-admin-create-tenant`
- `super-admin-update-tenant-db-config`
- `super-admin-provision-tenant-schema`
- `super-admin-provision-tenant-schema-full`
- `super-admin-check-tenant-schema`
- `super-admin-test-tenant-db`
- `super-admin-test-tenant-anon-key`
- `super-admin-import-tenant-admin`

Migração:
- `super-admin-migrate-tenant-auth`
- `super-admin-migrate-tenant-data`
- `super-admin-migrate-tenant-storage`
- `super-admin-migration-flip`
- `super-admin-migration-rollback`
- `super-admin-migration-smoke-test`
- `super-admin-purge-tenant-from-shared`
- `super-admin-tenant-snapshot`
- `super-admin-tenant-backup`

Runtime dedicado (data-plane):
- `tenant-runtime-config` (usada pelo cliente)
- `tenant-healthcheck`
- `tenant-dedicated-login-gate`
- `tenant-resolve`

## Edge Functions migradas para a fachada (12)
`create-atendimento`, `update-atendimento`, `sign-resultado`, `upload-pdf`, `upload-image`, `upload-assinatura`, `image-url`, `assinatura-url`, `comprovante-resolve`, `comprovante-shortlink`, `integration-pdf-url`, `integration-pdf-resolve`, `lab-apoio-upload-pdf`.

## Migrations de control-plane
- `20260525130936_*` — cria `tenant_registry` (id, slug, `database_strategy`, `runtime_mode`, `runtime_status`, `db_provider`, `db_secret_ref`, `db_host`, `db_port`, `db_name`, `db_user`, updated_at) + RLS super_admin + `tenant_migration_runs`.
- `20260525134033_*` — RPCs `super_admin_dump_auth_users`, `super_admin_list_migration_tables`, `super_admin_dump_table_page`.
- `20260701010019_*` — adiciona `db_project_url`, `db_anon_key_secret_ref`, `schema_provisioned_at`.
- `20260701012659_*` — adiciona `runtime_dedicated_enabled` (feature flag por tenant).
- `20260701032431_*` — adiciona `migration_state`, `frozen_at`.

## UI (Super Admin)
- `src/pages/superadmin/SuperAdminMigration.tsx` (293 linhas) — orquestra o wizard.
- `src/components/superadmin/TenantDatabaseConfig.tsx` (827 linhas) — formulário de config + testes.

## Scripts / CI
- `scripts/check-data-plane-routing.sh` — guardrail que impede regressão para import direto do supabase-js em edge functions listadas.

## Docs (43 arquivos)
- `docs/database-per-tenant-audit/*` (15)
- `docs/database-runtime/*.md` (6)
- `docs/database-runtime/dedicated-runtime/*` (10)
- `docs/database-runtime/shared-to-dedicated/*` (16)
- `docs/database-runtime/slices/*` (8 + README)

## Secrets/env esperados
- `SB_SERVICE_ROLE_<project_ref>` (por tenant dedicado) — nunca cadastrado hoje.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` (plataforma).
