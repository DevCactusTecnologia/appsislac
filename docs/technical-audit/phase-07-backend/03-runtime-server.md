# 03 — Runtime Server

## Nascimento
- `supabase/functions/_shared/runtime/createClient.ts` — **único ponto** que reexporta `createClient` do `@supabase/supabase-js@2.45.0` (versão pinada). Governança: nenhuma edge importa a SDK direto (0 ocorrências).
- `supabase/functions/_shared/runtime/db.ts` — fachada tenant-aware com 4 helpers canônicos.
- `supabase/functions/_shared/edgeBoot.ts` — bootstrap opt-in (CORS, JWT, tenant, `correlation_id`, `log`).

## Helpers
| Helper | Papel | Chave usada |
|---|---|---|
| `getPlatformClient()` | Control-plane / admin, service-role | `SUPABASE_SERVICE_ROLE_KEY` |
| `getUserClient(authHeader)` | Anon + JWT do usuário (RLS aplicada) | `SUPABASE_ANON_KEY` |
| `getTenantClient(tenant_id)` | Resolve shared (service-role) OU dedicated (secret `SB_SERVICE_ROLE_<ref>`) | env dinâmica |
| `getUserTenantClient(auth,tenant)` | User-scoped em banco dedicated | `db_anon_key_ref` |

## Resolução
- **Tenant** → `resolveUserTenantId(userId)` lê `profiles.tenant_id` via platform client.
- **Conexão** → `resolveTenant(tenant_id)` lê `tenant_registry`: `runtime_mode`, `runtime_status`, `db_project_url`, `db_secret_ref`, `db_anon_key_ref`.
- **Contexto** → `edgeBoot` produz `EdgeBootContext { admin, correlationId, userId, tenantId, json, log }`.

## Guardas
- `MigrationBlockedError` com códigos: `DEDICATED_URL_MISSING`, `DEDICATED_SERVICE_KEY_MISSING`, `DEDICATED_CLIENT_FAILED`, `TENANT_SUSPENDED`. **Nunca cai silenciosamente para shared**.
- Cache dedicado: `Map<tenant_id, {client, last_used_at}>` com TTL 5 min (`pruneCache`).

## Consumidores
- 54 edge functions importam `_shared/runtime/createClient`.
- 14 edge functions consomem `runtime/db.ts` (fluxos tenant-aware) ou `edgeBoot.ts`.
- Restantes usam `createClient` do shared apenas com service-role (admin plane).

## Dependências transitivas
`edgeBoot → integrationLog → runtime/createClient`; `pipeline → runtime/db (indireto) + integrationLog + circuit + dlq + health`.
