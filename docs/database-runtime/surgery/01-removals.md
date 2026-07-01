# 01 — Removals

Todos os itens abaixo foram removidos nesta cirurgia. Cada linha lista o motivo real (não especulativo) apoiado pela Forensic Review.

## Arquivos removidos (código)

### Client runtime (`src/runtime/`)
| Arquivo | Motivo |
|---|---|
| `src/runtime/db/index.ts` | Proxy fachada — só re-exportava o singleton |
| `src/runtime/db/factory.ts` | Cache de clientes por contexto sem consumidor real |
| `src/runtime/db/resolver.ts` | Tradutor de tipos usado apenas pela factory |
| `src/runtime/db/tenantContext.ts` | Fold para `src/runtime/db.ts` (única fonte) |
| `src/runtime/db/telemetry.ts` | `console.debug` sem uso operacional |
| `src/runtime/db/types.ts` | Tipos de strategy/factory que sumiram |
| `src/runtime/db/strategies/shared.ts` | Strategy sem consumidor pós-fachada |
| `src/runtime/db/strategies/dedicated.ts` | Idem |
| `src/runtime/db/__tests__/runtime.smoke.test.ts` | Testava a fachada removida |
| `src/runtime/identity/index.ts` | Identity registry nunca lido |
| `src/runtime/identity/supabaseIssuer.ts` | Issuer default nunca invocado |

### Server runtime (`supabase/functions/_shared/runtime/`)
| Arquivo | Motivo |
|---|---|
| `identity.ts` | `ServerIdentityValidator` sem call-site |
| `tenantContext.ts` | `TenantContextProvider` — abstração para provider inexistente |

### Edge functions
| Função | Motivo |
|---|---|
| `tenant-runtime-config` | Só era consumida pela fachada cliente removida |
| `tenant-healthcheck` | Sem consumidor no app ou pipeline |

### Documentação
| Diretório | Motivo |
|---|---|
| `docs/database-runtime/shared-to-dedicated/` | 16 arquivos de planejamento absorvidos por `dedicated-runtime` e `slices` |
| `docs/database-runtime/slices/` | Registros de fase, obsoletos após esta cirurgia |
| `docs/database-runtime/dedicated-runtime/` | Planos absorvidos aqui e em `forensic-review` |

## Símbolos apagados
- `RuntimeStrategyAdapter`, `sharedStrategy`, `dedicatedStrategy`
- `getClient`, `getDedicatedClient`, `getAllowedDedicatedTables`
- `emit` (telemetria cliente)
- `IdentityIssuer`, `registerIdentityIssuer`, `getIdentityIssuer`
- `ServerIdentityValidator`, `getIdentityValidator`, `setIdentityValidator`
- `TenantContextProvider`, `SupabaseRegistryProvider`, `getTenantContextProvider`, `setTenantContextProvider`
- `dedicatedHealth`, `invalidateDedicatedCache` (server)
- Rota client `db.from(table)` roteada por allowlist — fachada Proxy substituída pelo singleton
