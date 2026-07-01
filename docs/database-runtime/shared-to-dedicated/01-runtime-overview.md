# 01 — Runtime Overview

## Arquitetura atual (frontend `src/runtime/db/`)

```
UI / Hooks / Stores
        │
        ▼
   import { db } from "@/runtime/db"           ← porta única (index.ts:Proxy)
        │
        ▼
   ConnectionFactory (factory.ts)
        │  cache Map<"strategy::project_ref::tenant_id", CacheEntry>
        │  currentContext (bootstrap → refreshContext)
        ▼
   ┌────────────────────┬─────────────────────┐
   ▼                    ▼                     ▼
 SharedStrategy   DedicatedStrategy   TenantContextProvider
 (transport =     (createClient        (tenantContext.ts →
  singleton do    apontando p/ URL     edge fn tenant-runtime-config)
  .env)           dedicada, auth off)
```

## Componentes verificados

| Componente | Arquivo | Papel |
|---|---|---|
| Porta única | `src/runtime/db/index.ts` | Proxy: `db.from(table)` roteia por allowlist; demais chamadas caem no shared |
| Factory + cache | `src/runtime/db/factory.ts` | Mantém `primary` (shared) + `dedicated` por contexto; `currentContext` mutável |
| Resolver | `src/runtime/db/resolver.ts` | Converte `TenantContext` legado → `TenantRuntimeContext` |
| SharedStrategy | `src/runtime/db/strategies/shared.ts` | Reusa o singleton `@/integrations/supabase/client` (único arquivo autorizado) |
| DedicatedStrategy | `src/runtime/db/strategies/dedicated.ts` | `createClient(url, anon, {auth off})` + cache local `(url::anon.slice(-12))` |
| TenantContext | `src/runtime/db/tenantContext.ts` | Fonte de tenant + credenciais via edge fn |
| Telemetria | `src/runtime/db/telemetry.ts` | Emite eventos apenas em dev (`console.debug`) |

## Backend (edge functions)

| Componente | Arquivo | Papel |
|---|---|---|
| Chokepoint SDK | `supabase/functions/_shared/runtime/createClient.ts` | Único módulo autorizado a importar `@supabase/supabase-js` (versão pinada 2.45.0) |
| Fachada | `supabase/functions/_shared/runtime/db.ts` | `getPlatformClient()`, `getUserClient()`, `getTenantClient()` — **para dedicated lança erro `runtime não disponível ainda`** |
| Provider | `supabase/functions/_shared/runtime/tenantContext.ts` | `SupabaseRegistryProvider` lê `tenant_registry` |
| Contract | `supabase/functions/tenant-runtime-config/index.ts` | Retorna `{mode, dedicated:{url,anon_key}, allowed_tables}` para o front |
| Gate login | `supabase/functions/tenant-dedicated-login-gate/index.ts` | Bloqueia login se dedicated ligado mas sem base migrada |

## Respostas objetivas

- **Existe apenas uma arquitetura?** Sim no frontend (Proxy `db` em `index.ts`), mas convive com o singleton legado `src/integrations/supabase/client.ts` (permitido apenas em `SharedStrategy` — enforçado por `eslint.config.js` `no-restricted-imports`).
- **Duplicação?** Sim: `resolver.ts` mantém `SHARED_PROJECT_REF` derivado de `VITE_SUPABASE_PROJECT_ID` e `tenantContext.ts` mantém seu próprio cache + inflight. Dois caches paralelos (Factory cache + `_cachedContext` em `tenantContext.ts`).
- **Bypass?** Sim, dois pontos identificados:
  1. `src/pages/superadmin/SuperAdminTenantDetalhe.tsx`, `RedirectShortlink.tsx`, `validarCredenciaisAnalista.ts`, `assistente/AssistenteSISLAC.tsx` — usam `VITE_SUPABASE_URL` diretamente (audit `12-hardcoded-values.md`).
  2. `src/integrations/supabase/client.ts` continua sendo re-exportado indiretamente via `resolver.ts:__getSharedTransport`.
- **Pontos fora do Runtime?** Sim — Auth (Supabase Auth do projeto shared) é chamada diretamente via `sharedClient.auth` no `AuthContext.tsx`. Não passa por `db.auth`.

## Conclusão

O Runtime frontend está funcionalmente presente (Factory + duas strategies + Proxy roteador), com allowlist de 4 tabelas (`ALLOWED_TABLES_V1`). O runtime **server-side** (edge functions) reconhece `dedicated` no `TenantContextProvider` mas **falha-closed** — `getTenantClient()` lança erro para tenants dedicated.
