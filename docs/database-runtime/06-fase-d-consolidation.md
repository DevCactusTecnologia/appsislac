# Runtime 2.0 — Fase D: Consolidação Final da Infraestrutura

**Status:** ✅ Concluída  
**Escopo:** eliminar as últimas duplicações arquiteturais e consolidar
uma única forma oficial de resolver tenant, criar clients, autenticar
usuários e acessar Storage.

## Princípio

> "A partir da Fase D, qualquer evolução relacionada a Database-per-Tenant
> deve acontecer implementando novas **estratégias** dentro do runtime,
> não criando novas abstrações ou novos pontos de acesso."

Código enxuto, baixo acoplamento, evolução previsível.

---

## O que existia antes da Fase D

Duas pilhas paralelas de infraestrutura de dados coexistiam:

| Camada legada (`src/lib/db/`) | Camada oficial (`src/runtime/db/`) |
|---|---|
| `tenantResolver.ts` — descobria tenant do usuário e estratégia. | `resolver.ts` — mesma coisa, mas delegava ao legado. |
| `clientFactory.ts` + `adapters/` — fábrica CRUD nunca adotada. | `factory.ts` + `strategies/` — fábrica oficial. |
| `index.ts` — façade `db.select/insert/...` sem consumidores. | `index.ts` — proxy oficial `db.*`. |

No server, `supabase/functions/_shared/tenantConnection.ts` duplicava o
que `_shared/runtime/db.ts` (criado na Fase C) já expunha via
`getPlatformClient()` / `getTenantClient()`.

## O que foi feito

### 1. Consolidação do Tenant Context (frontend)
- Movido `src/lib/db/tenantResolver.ts` → `src/runtime/db/tenantContext.ts`.
- `src/runtime/db/index.ts` passa a re-exportar oficialmente:
  - `getTenantContext`, `getCurrentTenantId`, `getCurrentTenantNome`,
    `getCachedTenantNome`, `clearTenantContextCache`,
    `installTenantAuthInvalidation`.
- Codemod mecânico em **37 arquivos** substituindo
  `@/lib/db/tenantResolver` por `@/runtime/db`.

### 2. Eliminação da façade CRUD legada
- Removido `src/lib/db/` inteiro (adapters, clientFactory, index, types).
- Zero consumidores em produção (`db.select/insert/...` nunca foi adotado).

### 3. Consolidação server-side
- `supabase/functions/super-admin-metrics` migrado de
  `resolveTenantConnection` → `getTenantClient` (ambos com mesma semântica:
  fail-closed em `dedicated`/`suspended`).
- Removido `supabase/functions/_shared/tenantConnection.ts`.
- **Único ponto server-side de criação de client**:
  `supabase/functions/_shared/runtime/{createClient,db,tenantContext}.ts`.

### 4. Governança reforçada (ESLint)
Regra `no-restricted-imports` em `eslint.config.js` agora bloqueia:
- `@/integrations/supabase/client` (exceto núcleo do runtime).
- `@supabase/supabase-js` **named import `createClient`** (imports de
  `type` continuam permitidos).
- Qualquer import de `@/lib/db` ou `@/lib/db/*` (padrão bloqueado
  explicitamente para prevenir reintrodução acidental).

Exceção auditada e documentada:
- `src/lib/validarCredenciaisAnalista.ts` — client transitório em
  memstorage para validar credenciais sem substituir a sessão do
  operador logado. Adicionado ao `ignores` da regra.

### 5. Storage e Auth
Nenhuma nova abstração necessária — `db.storage.*` e `db.auth.*` já são
resolvidos pelo Proxy oficial do runtime (Fase B). Todo consumidor
usa a mesma porta.

---

## Superfície oficial (invariável a partir daqui)

**Frontend**
```ts
import {
  db,                          // client tenant-aware (proxy)
  getTenantContext,            // metadados completos do tenant
  getCurrentTenantId,          // atalho para tenant_id
  getCurrentTenantNome,        // nome legível
  clearTenantContextCache,     // invalidação manual
  installTenantAuthInvalidation, // hook automático em logout
  refreshContext, resetRuntime, getCurrentContext,
} from "@/runtime/db";
```

**Server (Edge Functions)**
```ts
import { createClient } from "../_shared/runtime/createClient.ts";
import { getPlatformClient, getUserClient, getTenantClient } from "../_shared/runtime/db.ts";
import { getTenantContextProvider, setTenantContextProvider } from "../_shared/runtime/tenantContext.ts";
```

---

## Validação

| Check | Resultado |
|---|---|
| `tsgo --noEmit` | ✅ 0 erros |
| Smoke tests (`runtime.smoke.test.ts`, 4/4) | ✅ verde |
| ESLint `no-restricted-imports` | ✅ 0 violações |
| Referências a `@/lib/db` | ✅ 0 |
| Referências a `_shared/tenantConnection` | ✅ 0 |

---

## Próximos passos (não são novas fases de infraestrutura)

Toda evolução de DB-per-tenant passa a ser **implementação de
estratégia**, não nova abstração:

- Ativar `DedicatedStrategy` real (Onda 3): conexão HTTPS a projeto
  Supabase dedicado por tenant, sem tocar em call sites.
- Runtime server dedicated: implementar em `_shared/runtime/db.ts::getTenantClient`
  quando `ctx.strategy === "dedicated"`, sem novos módulos.
- Provider alternativo de metadados de tenant (Redis/KV/CI):
  `setTenantContextProvider(new MyProvider())`, contrato já pronto
  desde a Fase C.

A camada de infraestrutura está **encerrada**. Novas features de negócio
consomem o runtime; não o expandem.
