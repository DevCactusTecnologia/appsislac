# 16 — Template de Migração de Domínio

**Versão:** 1.0 (congelada a partir dos Slices 2 e 3)
**Aplicabilidade:** todo domínio migrado do Shared para roteamento tenant-aware daqui em diante DEVE seguir este template — sem variações, sem "otimizações locais".

## Princípio

Migrar um domínio significa **rotear seus dados** via `getTenantClient` / `getUserTenantClient` **sem alterar comportamento observável**. Não é hora de refatorar lógica de negócio, otimizar queries ou reescrever validações.

## Pré-requisitos (bloqueiam a migração)

1. Domínio inventariado em `docs/database-runtime/dedicated-runtime/03-edge-functions.md`.
2. Tabelas do domínio classificadas: **tenant-scoped** (roteiam) vs **control-plane** (permanecem no shared).
3. Slice anterior concluído (métricas publicadas, guardrail verde).

## Etapas obrigatórias

### 1. Substituir imports do chokepoint

```ts
// ANTES
import { createClient } from "../_shared/runtime/createClient.ts";

// DEPOIS — escolha os primitivos usados:
import {
  getPlatformClient,      // control-plane (service-role, shared)
  getTenantClient,        // data-plane tenant service-role (jobs/webhooks)
  getUserTenantClient,    // data-plane autenticado (RPC com current_tenant_id())
  getUserClient,          // validar JWT do usuário
  MigrationBlockedError,  // erro tipado de dedicated indisponível
  resolveUserTenantId,    // profile lookup
} from "../_shared/runtime/db.ts";
```

`createClient` direto está **proibido** para funções no allowlist.

### 2. Substituir criação manual de clientes

| Padrão antigo | Substituto |
|---|---|
| `createClient(URL, ANON, { global: { headers: { Authorization }}})` | `getUserClient(authHeader)` |
| `createClient(URL, SERVICE_KEY)` (lookups em `profiles`/`tenants`/RPC/`storage_audit`) | `getPlatformClient()` |
| `createClient(URL, SERVICE_KEY)` (writes em tabelas tenant-scoped) | `await getTenantClient(tenantId)` |
| RPC autenticada com `current_tenant_id()` | `await getUserTenantClient(authHeader, tenantId)` |

### 3. Envolver a resolução do tenant client em try/catch

Todo `getTenantClient` / `getUserTenantClient` deve tratar `MigrationBlockedError` explicitamente:

```ts
let tenantDb;
try {
  tenantDb = await getTenantClient(tenantId);
} catch (e) {
  if (e instanceof MigrationBlockedError) {
    return errorResponse(503, `Runtime dedicado indisponível (${e.code})`, requestId, log);
  }
  throw e;
}
```

HTTP 503 é obrigatório. **Nunca** cair para shared silenciosamente.

### 4. Classificar cada operação

Ao ler o código legado, classifique cada `admin.from(...)` / `admin.rpc(...)`:

| Operação | Roteamento |
|---|---|
| `profiles`, `tenants`, `user_roles`, `saas_settings`, `tenant_registry` | control-plane (`platform`) |
| `is_super_admin`, `has_role`, `has_permission` | control-plane |
| `checkRateLimit`, `recordStorageAudit`, `loadS3Config` | control-plane (helpers) |
| Storage (`.storage.from(...)`) | control-plane neste slice (Storage não migra) |
| Tabelas do domínio migrado | tenant-scoped (`tenantDb`) |
| RPC que usa `current_tenant_id()` | `getUserTenantClient` (JWT preservado) |

### 5. Atualizar o guardrail

Adicionar a função ao array em `scripts/check-data-plane-routing.sh`, agrupada por slice:

```bash
# Slice N — <Nome do domínio>
"supabase/functions/<function>/index.ts"
```

### 6. Publicar relatórios do slice

Dois arquivos obrigatórios em `docs/database-runtime/`:

- `NN-sliceN-<dominio>.md` — escopo, funções migradas, quaisquer decisões locais.
- `NN-sliceN-metrics.md` — **métricas de arquitetura** (obrigatórias, vide §7).

### 7. Métricas de arquitetura (obrigatórias ao final de cada slice)

Publicar em `NN-sliceN-metrics.md` a seguinte tabela — sem exceções:

| Métrica | Baseline (fim do slice anterior) | Delta neste slice | Total após slice |
|---|---|---|---|
| Arquivos runtime (`src/runtime/**` + `supabase/functions/_shared/runtime/**`) | | | |
| Linhas runtime totais | | | |
| Novas abstrações no runtime | — | | — |
| Novas dependências (package.json / import_map) | — | | — |
| Funções migradas (cumulativo) | | | |
| Guardrails CI ativos | | | |
| Runtime abaixo de 20 arquivos? | ✔ / ✘ | — | ✔ / ✘ |

Complementar com: **quantos arquivos** foram adicionados/modificados fora do runtime, **quantas linhas** de código de domínio mudaram, e **checklist** de "nenhum runtime novo foi introduzido".

Se o Runtime crescer, justificar linha a linha por que a abstração é indispensável (não pode ser absorvida por `getTenantClient`, `getUserClient`, `getPlatformClient` ou `getUserTenantClient`).

## Anti-padrões proibidos

- ❌ Criar `StorageRuntime`, `RpcRouter`, `RealtimeRuntime`, `HealthMonitor` sem justificativa técnica documentada.
- ❌ Silenciar `MigrationBlockedError` com fallback para shared.
- ❌ Passar `tenant_id` vindo do body do request para o roteamento.
- ❌ Combinar migração com refactor de lógica de negócio no mesmo slice.
- ❌ Adicionar dependências novas (npm/deno) sem confirmação do owner do runtime.

## Validação (Definition of Done)

Um slice **só** é considerado concluído quando:

- [ ] Todas as funções do escopo importam apenas `_shared/runtime/db.ts`.
- [ ] `bash scripts/check-data-plane-routing.sh` sai com código 0.
- [ ] Relatório de métricas publicado com todas as colunas preenchidas.
- [ ] Runtime continua ≤ 20 arquivos.
- [ ] Zero novas abstrações OU justificativa formal documentada.

Este template não sofre revisão parcial. Alterações requerem novo Gate Review.
