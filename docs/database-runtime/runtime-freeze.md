# Runtime Freeze — Infraestrutura Encerrada

**Status:** 🔒 Congelado a partir da Fase D  
**Escopo:** camada de infraestrutura de acesso a dados (Runtime 2.0) —
`src/runtime/db/` e `supabase/functions/_shared/runtime/`.

> A camada de infraestrutura está **encerrada**. Novas features de
> negócio **consomem** o runtime; não o **expandem**.

Este documento é a regra final que impede reintroduzir duplicações
arquiteturais eliminadas nas Fases A–D. Qualquer PR que viole o freeze
deve ser rejeitado em code review — independentemente da justificativa
técnica aparente.

---

## Proibido

Não crie, sob nenhuma hipótese:

- ❌ Novo **Provider** de client Supabase / transporte de dados.
- ❌ Nova **Factory** de clients.
- ❌ Novo **Resolver** de tenant.
- ❌ Novo **Context** de tenant (frontend ou server).
- ❌ Novo **Adapter** paralelo ao runtime (`src/lib/db/*`,
  `_shared/tenantConnection.ts`, façades CRUD, wrappers "helpers", etc.).

Também é proibido:

- ❌ Importar `@/integrations/supabase/client` fora do núcleo do runtime.
- ❌ Importar `createClient` de `@supabase/supabase-js` fora do
  chokepoint (`src/runtime/db/strategies/*` no frontend,
  `supabase/functions/_shared/runtime/createClient.ts` no server).
- ❌ Reintroduzir `@/lib/db` ou qualquer diretório equivalente.
- ❌ Criar "atalhos" que reimplementem descoberta de tenant, cache de
  contexto ou invalidação de sessão fora de `tenantContext.ts`.

A regra ESLint `no-restricted-imports` (`eslint.config.js`) já bloqueia
esses padrões em build-time. **Não adicione exceções** sem revisão
arquitetural explícita.

---

## Permitido

Evolução legítima da infraestrutura acontece **apenas** nestes eixos:

- ✅ Implementar / evoluir `SharedStrategy`
  (`src/runtime/db/strategies/shared.ts`).
- ✅ Implementar / evoluir `DedicatedStrategy`
  (`src/runtime/db/strategies/dedicated.ts`) — inclusive ativar o
  runtime dedicated real quando `ctx.strategy === "dedicated"`.
- ✅ Implementar novos **Providers de TenantContext** conformando à
  interface existente (`TenantContextProvider` em
  `supabase/functions/_shared/runtime/tenantContext.ts`) e injetá-los
  via `setTenantContextProvider(...)`.
  Exemplos válidos: cache Redis/KV, config estática de CI/CD, service
  discovery externo.
- ✅ Corrigir bugs nos módulos existentes do runtime.

Nada mais.

---

## Superfície oficial (invariante)

**Frontend** — importe **somente** de `@/runtime/db`:

```ts
import {
  db,
  getTenantContext,
  getCurrentTenantId,
  getCurrentTenantNome,
  getCachedTenantNome,
  clearTenantContextCache,
  installTenantAuthInvalidation,
  refreshContext,
  resetRuntime,
  getCurrentContext,
} from "@/runtime/db";
```

**Server (Edge Functions)** — importe **somente** de
`_shared/runtime/*`:

```ts
import { createClient } from "../_shared/runtime/createClient.ts";
import {
  getPlatformClient,
  getUserClient,
  getTenantClient,
} from "../_shared/runtime/db.ts";
import {
  getTenantContextProvider,
  setTenantContextProvider,
} from "../_shared/runtime/tenantContext.ts";
```

---

## Por que este freeze existe

Antes da Fase D coexistiam duas pilhas paralelas de infraestrutura
(`src/lib/db/` legada e `src/runtime/db/` oficial), além de duplicação
server-side (`_shared/tenantConnection.ts` vs `_shared/runtime/db.ts`).
A consolidação eliminou ~40 pontos de acoplamento e reduziu a
superfície de decisão a um único caminho.

Sem este freeze explícito, o padrão histórico se repete: em 6 meses
alguém introduz "só mais um helper" para resolver um caso pontual, e a
segunda infraestrutura paralela nasce de novo. Toda dívida arquitetural
começa como uma exceção razoável.

---

## Como evoluir sem violar o freeze

| Necessidade | Onde implementar |
|---|---|
| Suportar tenant em projeto Supabase dedicado | `strategies/dedicated.ts` |
| Ler metadados de tenant de Redis / KV / CI | Novo `TenantContextProvider` + `setTenantContextProvider(...)` |
| Novo helper de negócio que precisa de client | Consuma `db` / `getTenantClient()` — não crie fábrica |
| Cache de contexto mais agressivo | Ajuste em `tenantContext.ts` (frontend) ou no Provider server |
| Telemetria adicional | `src/runtime/db/telemetry.ts` |

Se o seu caso de uso **não cabe** em nenhuma dessas caixas, o problema
provavelmente não é infraestrutura — é modelagem de negócio. Reabra a
discussão antes de tocar no runtime.

---

## Referências

- Fase A — [Runtime overview](./01-runtime-overview.md)
- Fase A — [Gate review](./02-gate-review-fase-a.md)
- Fase B — [Codemod audit](./03-fase-b-codemod-audit.md)
- Fase C — [Server runtime review](./04-server-runtime-review.md)
- Fase C — [Edge functions audit](./05-fase-c-edge-functions-audit.md)
- Fase D — [Consolidação final](./06-fase-d-consolidation.md)
