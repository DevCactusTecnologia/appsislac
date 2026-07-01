# 12 — Superfície da Implementação

Números diretos, medidos no repositório.

## Arquivos criados
- Runtime cliente: **11 arquivos** (`src/runtime/db/*`, `src/runtime/identity/*`, testes).
- Runtime servidor: **5 arquivos** (`_shared/runtime/*`, `_shared/migration/connect.ts`).
- Edge functions dedicated-specific: **20**.
- Migrations de control-plane: **4**.
- UI Super Admin (novos): **2** (`SuperAdminMigration.tsx`, `TenantDatabaseConfig.tsx`).
- Scripts CI: **1** (`scripts/check-data-plane-routing.sh`).
- Docs: **43** arquivos em 4 pastas (`database-per-tenant-audit`, `database-runtime`, `dedicated-runtime`, `shared-to-dedicated`, `slices`).

**Total (código + config): ~44 arquivos novos. Docs: 43 arquivos.**

## Linhas adicionadas
| Bloco | Linhas |
|---|---:|
| Runtime cliente | ~610 |
| Runtime servidor | ~530 |
| Edge functions dedicated-specific | ~5.500 (estimado, ~275 linhas/média × 20) |
| UI Super Admin (2 arquivos) | 1.120 |
| Migrations control-plane | ~250 |
| Scripts | ~80 |
| **Total código** | **~8.100 linhas** |
| Docs | ~15.000 linhas |

## Diretórios novos
- `src/runtime/`
- `src/runtime/db/`
- `src/runtime/db/strategies/`
- `src/runtime/db/__tests__/`
- `src/runtime/identity/`
- `supabase/functions/_shared/runtime/`
- `supabase/functions/_shared/migration/`
- `docs/database-per-tenant-audit/`
- `docs/database-runtime/`
- `docs/database-runtime/dedicated-runtime/`
- `docs/database-runtime/shared-to-dedicated/`
- `docs/database-runtime/slices/`

**Total: 12 novos diretórios.**

## Componentes / abstrações novos
- Fachada `db` (Proxy).
- `TenantRuntimeContext` + `RuntimeStrategyAdapter`.
- `RuntimeError`, `MigrationBlockedError` (× 2, cliente e servidor).
- `IdentityIssuer`, `ServerIdentityValidator`, `IdentityClaims`, `IdentitySession`.
- `TenantContextProvider` + `SupabaseRegistryProvider`.
- `TenantRegistryRow` (server).
- `sharedStrategy`, `dedicatedStrategy`.
- Cache LRU dedicado (server e client).
- Telemetria `runtime.*` (client only).

**Total: ~14 abstrações públicas novas.**

## Consumo real (produção)
- Fachada `db`: 1 consumidor real.
- Identity Layer: 0.
- Strategies dedicated: 0.
- Edge helpers (`getPlatformClient` etc.): ~30 call-sites.
- Pipeline `migrate-*`: 0 execuções em produção conhecidas.
