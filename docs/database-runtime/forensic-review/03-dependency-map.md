# 03 — Dependency Map

## Runtime cliente
- `db/index.ts` importa: `factory`, `telemetry`, `types`, reexporta `tenantContext`.
- `db/factory.ts` importa: `strategies/shared`, `strategies/dedicated`, `resolver`, `telemetry`, `types`.
- `db/resolver.ts` importa: `@/integrations/supabase/client` (via `__getSharedTransport`), `tenantContext`, `telemetry`, `types`.
- `db/tenantContext.ts` importa: `@/integrations/supabase/client`; chama edge `tenant-runtime-config`.
- `strategies/dedicated.ts` importa: `@supabase/supabase-js`, `types`.
- `strategies/shared.ts` importa: `resolver` (para reusar transport).
- `identity/index.ts` — sem dependências além de tipos.
- `identity/supabaseIssuer.ts` importa: `@/integrations/supabase/client`, `identity/index`.

Consumidores:
- `src/main.tsx` → `registerIdentityIssuer(supabaseSharedIssuer)`.
- `src/contexts/AuthContext.tsx` → `refreshContext`, `resetRuntime` (login/logout).
- `src/runtime/db/__tests__/runtime.smoke.test.ts` (interno).
- **Nenhum store/página consome `db.from(...)` diretamente hoje.** Todos os stores em `src/data/*` continuam usando `import { supabase } from "@/integrations/supabase/client"`.

## Runtime servidor
- `_shared/runtime/db.ts` importa: `createClient.ts`, `tenantContext.ts`.
- `_shared/runtime/tenantContext.ts` importa: `createClient.ts`.
- `_shared/migration/connect.ts` importa: `../runtime/createClient.ts`, `deno.land/x/postgres`.

Consumidores (via `getPlatformClient` / `getUserClient` / `getTenantClient` / `getUserTenantClient`):
- 12 edge functions listadas em `02-inventory.md` (Slices 1..3).
- `tenant-runtime-config` (`getPlatformClient`).
- Todas as `super-admin-migrate-*` usam `connect.ts` (não a fachada `db.ts`).

## Dependências circulares
- Nenhuma detectada. `strategies/shared.ts` importa `resolver` para pegar o singleton; `resolver` importa `tenantContext`; sem ciclo.

## Acoplamentos observados
- `db/tenantContext.ts` conhece o formato da resposta de `tenant-runtime-config` (contrato implícito).
- `_shared/runtime/db.ts` conhece a estrutura de `tenant_registry` diretamente (colunas `db_project_url`, `db_anon_key_ref`, `db_secret_ref`) — mesma informação também consumida por `_shared/migration/connect.ts` e por `tenant-runtime-config`. **Três leitores independentes do registry.**
- Duas convenções de nome de secret coexistem: `db_secret_ref` (`_shared/runtime/db.ts`) vs `SB_SERVICE_ROLE_<project_ref>` (documentado em comentários) vs `db_anon_key_secret_ref` (migration `20260701010019`).

## Nunca utiliza
- `RuntimeError` (client) — exportado, apenas `MigrationBlockedError` é usado.
- `IdentityIssuer.parseClaims` — implementado mas sem call-site.
- `dedicatedHealth` (server) — sem call-site em edge functions.
- `invalidateDedicatedCache` (server) — sem call-site (flip/rollback não invalida).
- `setTenantContextProvider` / `setIdentityValidator` (server) — hooks de teste, sem uso.
- `installTenantAuthInvalidation` — exportado por `db/index.ts` mas não chamado no bootstrap real (`AuthContext` chama `resetRuntime` manualmente).
