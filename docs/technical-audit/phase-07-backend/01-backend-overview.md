# 01 — Backend Overview

## Escopo auditado
- `supabase/functions/` — **74 Edge Functions** + `_shared/` (runtime, drivers, pipeline, migração, hardening).
- `supabase/migrations/` — **355 migrations**, **221 funções `public.*`** (RPCs + triggers).
- Runtime tenant-aware em `_shared/runtime/db.ts` + chokepoint SDK em `_shared/runtime/createClient.ts`.

## Camadas identificadas
```
Cliente (React/Vite)
   │  supabase-js (client.ts) — anon + JWT
   ▼
Edge Function (Deno)
   │  edgeBoot.ts (CORS/JWT/tenant/correlation_id)  ← opt-in
   │  runtime/createClient.ts (SDK pinada 2.45.0)   ← chokepoint único
   ▼
Runtime Server (_shared/runtime/db.ts)
   │  getPlatformClient  (service-role)
   │  getUserClient      (anon + JWT)
   │  getTenantClient    (shared OU dedicated cache)
   │  getUserTenantClient(JWT + roteamento dedicated)
   ▼
Postgres (Supabase)
   │  221 RPCs (SECURITY DEFINER + search_path=public)
   │  RLS: current_tenant_id() / is_super_admin() / has_permission()
   │  Triggers de auditoria (audit_*)
   ▼
Resposta JSON (com correlation_id)
```

## Pilares
1. **Multi-tenant shared-db** (default) com opção **isolated_db** por tenant (`tenant_registry.runtime_mode`).
2. **Roteamento server-side** — o cliente nunca informa `tenant_id`; resolvido via `profiles.tenant_id` + JWT.
3. **Engine de integrações** com Circuit Breaker + DLQ + retry exponencial + health metrics.
4. **Super Admin plane** isolado (edge functions `super-admin-*` + RPCs `super_admin_*`) exigindo revalidação de role.
5. **Auditoria estruturada** via `integration_logs` (correlation_id) e triggers `audit_*` no banco.

## Contagens
| Item | Total |
|---|---|
| Edge Functions | 74 |
| Módulos `_shared` | 17 arquivos + subpastas |
| Drivers de integração | 2 (Hermes-Pardini, DB Diagnósticos) + transports |
| RPCs `public.*` | 221 |
| RPCs transacionais (`*_tx`) | 7 |
| RPCs de segurança (`is_/has_/current_tenant`) | 6 |
| RPCs super-admin | 5 |
| RPCs de auditoria (`audit_*`) | 8 |
| Migrations | 355 |
| Edge functions usando `_shared/runtime/createClient` | 54 |
| Edge functions usando `runtime/db` ou `edgeBoot` | 14 |
| Edge functions importando SDK diretamente | 0 (governança OK) |
