# 06 — Código Morto / Órfão

Somente evidências (sem call-site em `src/` ou `supabase/functions/`).

## Funções exportadas sem consumidor
| Símbolo | Arquivo | Observação |
|---|---|---|
| `RuntimeError` | `src/runtime/db/types.ts` | Substituído por `MigrationBlockedError` em todos os call-sites |
| `IdentityIssuer.parseClaims` (default impl) | `src/runtime/identity/supabaseIssuer.ts` | Nenhum chamador |
| `getIdentityIssuer` | `src/runtime/identity/index.ts` | Registrado em `main.tsx`, nunca lido |
| `installTenantAuthInvalidation` | `src/runtime/db/tenantContext.ts` | Reexportado por `db/index.ts`, sem chamador |
| `getCachedTenantContext` | `src/runtime/db/tenantContext.ts` | Sem chamador |
| `getAllowedDedicatedTables` | `src/runtime/db/factory.ts` | Chamado só por `db/index.ts.routedFrom` (sempre allowlist vazia) |
| `dedicatedHealth` | `_shared/runtime/db.ts` | Sem call-site em edge functions |
| `invalidateDedicatedCache` | `_shared/runtime/db.ts` | Deveria ser chamada por `migration-flip`, não é |
| `setTenantContextProvider` | `_shared/runtime/tenantContext.ts` | Hook de teste, sem uso |
| `setIdentityValidator` | `_shared/runtime/identity.ts` | Hook de teste, sem uso |
| `assertDedicatedRegistry` | `_shared/migration/connect.ts` | Sem call-site (só `assertSchemaProvisioned` é usado) |
| `isDedicatedRegistry` | `_shared/migration/connect.ts` | Sem call-site |

## Colunas de tabela nunca populadas por código
- `tenant_registry.runtime_status` — nenhum `UPDATE` em edge functions.
- `tenant_registry.frozen_at` — settado só por `migration-flip` (fluxo que nunca rodou).
- `tenant_registry.db_provider` — lido, nunca escrito.

## Flags mortas
- `runtime_dedicated_enabled` — nunca lido; `tenant-runtime-config` decide por `runtime_mode`/`database_strategy`.
- `allowed_tables` — sempre vazio (nunca definido em `tenant-runtime-config`).

## Docs órfãs / obsoletas
- `docs/database-runtime/shared-to-dedicated/*` (16 arquivos) — planejamento; largamente substituído por `dedicated-runtime/*` e `slices/*`.
- `docs/database-per-tenant-audit/*` (15 arquivos) — auditoria pré-implementação; referência histórica.
- `docs/database-runtime/runtime-freeze.md` — congelamento não é mais aplicável ao estado atual (fachada não foi rolada out).

## Comentários TODO / temporário
- `_shared/runtime/db.ts`: comentário “D2 — cadastrado manualmente por tenant no provisionamento” — nunca automatizado.
- `db/factory.ts`: “Fail-safe: se falhar em criar o dedicated, seguimos só com shared” — contradiz política Fase 8 (“nunca fallback silencioso”) do server runtime.

## Testes sem cobertura de fluxo real
- `src/runtime/db/__tests__/runtime.smoke.test.ts` — apenas smoke da fachada; não exercita rota dedicated.
- Não há teste E2E do pipeline `migrate-auth/data/storage/flip`.
