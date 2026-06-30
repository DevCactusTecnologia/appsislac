
# SISLAC Database Runtime 2.0 — Plano de Execução

## Contexto

A auditoria anterior (`docs/database-per-tenant-audit/`) comprovou que **121 arquivos do front + ~70 edge functions** importam `@/integrations/supabase/client` diretamente. O objetivo do Runtime 2.0 é **desacoplar 100% desse import**, sem alterar UI, fluxos ou regras de negócio.

**Princípio Zero (não-negociável):** o restante do SISLAC deixa de saber qual banco está sendo usado. Toda conexão passa pela `ConnectionFactory`.

## Escopo

| Inclui | NÃO inclui |
|---|---|
| Refator de imports em 121 arquivos do front | Mudanças de UI, fluxos, regras de negócio |
| Refator de ~70 edge functions para Runtime Resolver server-side | Implementação real do driver Postgres (Dedicated) |
| Auth/Storage roteados via Factory | Migration Runner (só contrato + interface) |
| Cache de clientes por (tenant, project, runtime) | Quebra de compatibilidade do client API |
| 10 relatórios em `docs/database-runtime/` | Reescrita de RLS sem ganho real |

## Arquitetura alvo

```text
        ┌─────────────────────────────────────────┐
        │   UI / Hooks / Stores / Services        │
        │   import { db } from "@/runtime/db"     │  ← única entrada
        └────────────────────┬────────────────────┘
                             ▼
        ┌─────────────────────────────────────────┐
        │   ConnectionFactory (singleton)         │
        │   getClient(tenantCtx) → SupabaseClient │
        └────────────────────┬────────────────────┘
                             ▼
        ┌─────────────────────────────────────────┐
        │   RuntimeResolver                       │
        │   tenant_id → {strategy, project, key}  │
        └────────────────────┬────────────────────┘
              ┌──────────────┴──────────────┐
              ▼                             ▼
      SharedStrategy                 DedicatedStrategy
      (client compartilhado)         (client por tenant)
```

Cache: `Map<cacheKey, SupabaseClient>` indexado por `(tenant_id, project_ref, runtime_mode)`. Invalidação em logout / troca de tenant via `auth.onAuthStateChange`.

## Fases

### Fase A — Núcleo Runtime (Front)
1. Criar `src/runtime/db/` com:
   - `types.ts` (interfaces: `TenantRuntimeContext`, `Strategy`, `RuntimeClient`)
   - `resolver.ts` (encapsula `tenantResolver.ts` atual)
   - `strategies/shared.ts` e `strategies/dedicated.ts` (stub)
   - `factory.ts` (cache + escolha de strategy)
   - `index.ts` (export `db()` → retorna client pronto; `auth()`, `storage()`, `functions()`, `realtime()` proxies)
2. **Não apagar** `src/integrations/supabase/client.ts` (gerado). A `SharedStrategy` continua usando-o como transport — mas só ela.
3. Adicionar **ESLint rule** `no-restricted-imports` proibindo `@/integrations/supabase/client` fora de `src/runtime/db/strategies/shared.ts`.

### Fase B — Codemod no Front (121 arquivos)
- Script `scripts/runtime-codemod.ts` (ts-morph) reescreve:
  - `import { supabase } from "@/integrations/supabase/client"` → `import { db } from "@/runtime/db"`
  - Usos `supabase.from(...)` → `db().from(...)`, `supabase.auth` → `db().auth`, etc.
- Rodar em lotes (stores → hooks → pages → components), commits intermediários, build/typecheck após cada lote.

### Fase C — Edge Functions Runtime
- Criar `supabase/functions/_shared/runtime/factory.ts` (versão server). Reusa `tenantConnection.ts` como `SharedStrategy`.
- Codemod equivalente para ~70 funções. SERVICE_ROLE permanece só nas funções `super-admin-*` (justificativa documentada).

### Fase D — Storage & Auth Roteados
- `db().storage.from(bucket)` → `BucketResolver` (futuro per-tenant); hoje devolve bucket atual. Remove strings hardcoded de `tenant-assets` / `integration-assets` para constantes em `src/runtime/storage/buckets.ts`.
- `db().auth` continua Shared; estrutura preparada para Auth dedicado (interface `AuthStrategy`).

### Fase E — Observabilidade & Métricas
- `src/runtime/db/telemetry.ts` emite eventos: `runtime.resolve.start/end`, `runtime.client.created`, `runtime.client.cache_hit`, `runtime.failure`. Plug em console em dev, no-op em prod (até decidir sink).

### Fase F — Smoke Test
- `e2e/runtime-smoke.spec.ts`: simula 4 tenants (2 shared / 2 dedicated-stub) e valida factory devolve clientes distintos, sem cross-cache, e que dedicated lança erro controlado (`NotImplementedYet`) — não silencioso.

### Fase G — Relatórios
Criar `docs/database-runtime/01..10-*.md` conforme spec, incluindo métricas antes/depois (n° de `createClient`, n° de imports diretos, etc.).

## Critérios de aprovação (auto-check final)

- `rg "@/integrations/supabase/client" src | wc -l` = **1** (apenas `strategies/shared.ts`).
- `rg "createClient\(" src | wc -l` = **1**.
- ESLint passa com a nova regra ativa.
- Build + typecheck verdes.
- `docs/database-runtime/10-executive-report.md` com tabela antes/depois.

## Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Codemod quebra usos exóticos (destructuring, re-exports) | Lotes pequenos + typecheck por lote + revisão manual de falhas |
| `db()` async vs `supabase` síncrono | `db()` retorna client síncrono já cacheado; bootstrap inicial em `main.tsx` aguarda primeiro resolve |
| Realtime channels já abertos no client antigo | Migrados via mesma estratégia; canais reaplicados após troca |
| Edge functions com 70 arquivos | Codemod server separado, deploy em ondas |

## Tamanho estimado

- ~125 arquivos do front editados (codemod).
- ~70 edge functions editadas (codemod).
- ~8 arquivos novos em `src/runtime/db/` + `_shared/runtime/`.
- 10 documentos em `docs/database-runtime/`.

## Confirmação necessária

Esta é uma refatoração estrutural de larga escala que **toca praticamente todos os arquivos do projeto**. Conforme regra de memória (`confirmacao-mudancas-estruturais`), preciso confirmação explícita antes de iniciar.

**Você aprova executar as Fases A–G em sequência, com commits intermediários por lote?** Se sim, começo pela Fase A (núcleo Runtime + ESLint rule) e paro para validação antes do codemod massivo.
