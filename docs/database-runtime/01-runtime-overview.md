# 01 — Runtime Overview (Fase A)

## Princípio Zero
O restante do SISLAC não conhece o provedor de banco. Toda conexão passa pela porta única `@/runtime/db`.

## Camadas

```text
UI / Hooks / Stores / Services / Pages
                │
                ▼
       import { db } from "@/runtime/db"
                │
                ▼
        ConnectionFactory (cache por tenant/project/strategy)
                │
                ▼
           RuntimeResolver
        (tenant_registry → TenantRuntimeContext)
                │
        ┌───────┴────────┐
        ▼                ▼
 SharedStrategy    DedicatedStrategy (stub)
```

## Arquivos criados (Fase A)

| Arquivo | Responsabilidade |
|---|---|
| `src/runtime/db/types.ts` | `TenantRuntimeContext`, `RuntimeStrategyAdapter`, `RuntimeError` |
| `src/runtime/db/telemetry.ts` | Eventos: `resolve.start/end`, `client.created/cache_hit/disposed`, `failure` |
| `src/runtime/db/resolver.ts` | Encapsula `tenantResolver` legado; expõe `resolveCurrentTenant()` |
| `src/runtime/db/factory.ts` | Cache `(strategy, project_ref, tenant_id) → client`; `getClient`, `refreshContext`, `resetRuntime` |
| `src/runtime/db/strategies/shared.ts` | Único arquivo autorizado a importar o singleton `@/integrations/supabase/client` |
| `src/runtime/db/strategies/dedicated.ts` | Lança `RuntimeError("RUNTIME_DEDICATED_NOT_IMPLEMENTED")` |
| `src/runtime/db/index.ts` | Exporta `db` (Proxy sobre `getClient()`) — porta única |

## ESLint Guard
`eslint.config.js` adiciona `no-restricted-imports` proibindo `@/integrations/supabase/client` em qualquer arquivo fora de `src/runtime/db/strategies/shared.ts` e `resolver.ts`.

## Status
- Núcleo Runtime criado e isolado. **Zero arquivos de domínio alterados nesta fase.**
- O singleton `src/integrations/supabase/client.ts` continua existindo (gerado automaticamente) e é usado apenas pela `SharedStrategy`.
- Após validação, Fase B executa codemod nos 121 arquivos do front substituindo o import.

## Próximos passos (não executados ainda)
- Fase B: codemod front (`scripts/runtime-codemod.ts`).
- Fase C: codemod edge functions (`supabase/functions/_shared/runtime/`).
- Fase D: bucket constants + AuthStrategy.
- Fases E–G: telemetria estendida, smoke test, relatórios 02–10.
