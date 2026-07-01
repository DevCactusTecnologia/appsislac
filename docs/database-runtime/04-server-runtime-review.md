# 04 — Server Runtime Review (pré-Fase C)

Status: **Review de arquitetura. Nenhum código escrito.** Objetivo: validar se o Runtime do frontend (`src/runtime/db`) pode ser transposto para o ambiente Deno das Edge Functions sem introduzir acoplamentos, vazamento de credenciais ou drift de semântica antes de autorizar o codemod das ~70 funções.

---

## 1. Contrato do Runtime Server

Espelha a fronteira do frontend, mas ajustado à realidade multi-request/stateless do Deno.

```
supabase/functions/_shared/runtime/
  types.ts          → TenantRuntimeContext, RuntimeStrategyAdapter, RuntimeError, RequestIdentity
  resolver.ts       → resolveTenantFromRequest(req) → TenantRuntimeContext
  factory.ts        → getClientForRequest(ctx, role) → RuntimeClient
  strategies/
    shared.ts       → createClient(SUPABASE_URL, KEY, opts) — único autorizado
    dedicated.ts    → stub fail-closed (RuntimeError: NOT_IMPLEMENTED)
  telemetry.ts      → mesmo shape do front (resolve.start/end, client.created, failure)
  index.ts          → export { getDb, getPlatformDb, resolveTenantFromRequest, resetRuntime }
```

Diferenças materiais em relação ao front:

| Aspecto | Frontend | Server (Deno) |
|---|---|---|
| Instância | Singleton por aba | **1 client por request** (stateless) |
| Auth | Sessão persistida | JWT do header `Authorization` (nunca persistir) |
| Roles | Sempre anon+JWT | Dois modos: `tenant` (JWT do usuário) e `platform` (service-role) |
| Cache | Por `(strategy, project_ref, tenant_id)` | Por `(strategy, project_ref, role)` + TTL curto |
| Realtime | Sim | Não usar em edge (function é efêmera) |

Regra de ouro: **nenhuma edge function importa `createClient` diretamente**. Só `strategies/shared.ts` importa. ESLint/deno-lint guard equivalente ao do front (`no-restricted-imports` sobre `@supabase/supabase-js` em `supabase/functions/**` exceto `_shared/runtime/strategies/`).

---

## 2. Estratégia de resolução de tenant no servidor

Três caminhos oficiais, nesta ordem de precedência:

1. **JWT do usuário** (`Authorization: Bearer <jwt>`)
   - `platformDb.auth.getUser(token)` → `user.id`
   - `profiles.tenant_id` (via `platformDb` com service-role) → `tenant_id`
   - Uso: qualquer função invocada pelo app do tenant.
2. **Header explícito `x-tenant-id`** — **apenas** quando o chamador é service-role validado (cron, webhook interno com HMAC, edge-to-edge). Nunca aceitar do browser.
3. **Super-admin** — `is_super_admin(user_id)` = true ⇒ contexto `{ tenant_id: header ?? null, role: 'platform' }`. Sem tenant, opera no control-plane (`tenant_registry`, `tenants`, `audit_logs`).

Depois de identificar `tenant_id`, resolve estratégia em `tenant_registry` (mesma lógica de `tenantConnection.ts` atual):

- `runtime_status = 'suspended'` ⇒ `RuntimeError('TENANT_SUSPENDED')` (401/423).
- `runtime_mode = 'isolated_db'` OU `database_strategy = 'dedicated'` ⇒ `strategy = 'dedicated'` (stub por enquanto).
- Caso contrário ⇒ `strategy = 'shared'`.

**Nunca** confiar em `tenant_id` que venha do body. Fronteira única: `resolveTenantFromRequest(req)`.

---

## 3. Ciclo de vida das conexões

Edge functions são efêmeras (podem ou não reaproveitar isolate). Regras:

- **Criar 1 client por request**, no início do handler, via `getDb(ctx)`; descartar ao final (`using`/`finally`).
- **Sem singletons globais** para clients tenant-scoped — apenas o `platformDb` (service-role, sem `Authorization` de usuário) pode ser cacheado no escopo do módulo, porque não carrega identidade.
- **Nunca reaproveitar** um client criado com JWT do usuário A para atender request do usuário B. O cache de request tem chave `(strategy, project_ref, role, jwt_hash?)`; em `role = 'tenant'` o JWT entra na chave e o entry é dropado no final da request.
- **Realtime desabilitado** por padrão nas options do client server (`realtime: { params: { eventsPerSecond: 0 } }` ou simplesmente não usar `.channel()`).
- `resetRuntime()` limpa somente o cache de módulo (usado em testes Deno).

---

## 4. Uso correto de `SERVICE_ROLE_KEY`

Política estrita:

| Cliente | Key | Header `Authorization` | Uso |
|---|---|---|---|
| `platformDb` | `SERVICE_ROLE_KEY` | **não** propagar JWT do usuário | Control-plane: `tenant_registry`, `profiles`, `audit_logs`, provisionamento |
| `tenantDbAsUser` | `ANON_KEY` | Bearer JWT do usuário | Toda operação de domínio → RLS aplicada com `auth.uid()` |
| `tenantDbAsService` | `SERVICE_ROLE_KEY` | **não** propagar JWT | Somente rotinas administrativas server-side com auditoria explícita (ex.: `super-admin-*`, jobs) |

Obrigatório:

- `SERVICE_ROLE_KEY` **nunca** sai do módulo `strategies/shared.ts`. Nenhum handler lê `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")` diretamente após a Fase C.
- Qualquer uso de `tenantDbAsService` **deve** passar por `assertSuperAdmin(ctx)` OU por uma allowlist de funções administrativas registrada em `runtime/policy.ts`.
- Zero logs contendo o valor da key. Telemetria só registra `role`, `strategy`, `project_ref`.
- Requests que subam com JWT do usuário **não** podem ser reescritas com service-role sem elevação explícita — evita bypass silencioso de RLS.

---

## 5. Política de cache e invalidação

- **Contexto tenant** (`tenant_registry` lookup): cache em memória do isolate por `tenant_id`, TTL 30 s, `stale-while-revalidate` proibido (mudança de `runtime_status` precisa refletir rápido). Invalidação por eventos: `tenant.updated`, `tenant.suspended`, `tenant.strategy_changed` publicados no `platformDb` (fase futura). Enquanto não existir bus, TTL curto é a garantia.
- **Client shared/anon** (sem JWT): cache por vida do isolate.
- **Client shared+JWT** (tenant-as-user): **sem cache entre requests**. Escopo = request atual.
- **Client dedicated** (futuro): cache por `(project_ref)` com pool `pg` + `Deno.serve` shutdown hook para `end()`.
- Invalidação forçada: `resetRuntime()` (testes) e endpoint interno `POST /_runtime/invalidate` (admin) previsto para Fase E.

Chave canônica: `${strategy}::${project_ref}::${role}::${jwt_hash ?? '-'}`. Igual ao front, mas com dimensão `role`.

---

## 6. Componentes compartilhados com o Runtime do frontend

**Podem ser compartilhados** (via `packages/runtime-core/` ou duplicação controlada com contrato idêntico):

- `types.ts` — `TenantRuntimeContext`, `RuntimeStrategy`, `RuntimeError` (mesma forma).
- `telemetry.ts` — shape dos eventos (`runtime.resolve.*`, `runtime.client.*`, `runtime.failure`), com sinks diferentes.
- Constantes: nomes de estratégia (`"shared" | "dedicated"`), códigos de erro (`RUNTIME_DEDICATED_NOT_IMPLEMENTED`, `TENANT_SUSPENDED`, `TENANT_UNRESOLVED`).

**Não podem ser compartilhados** (semântica divergente):

- `resolver.ts` — front lê da sessão do browser; server lê do request/JWT/header.
- `factory.ts` — cache-por-request vs singleton-por-aba.
- `strategies/shared.ts` — front usa singleton gerado em `src/integrations/supabase/client.ts`; server usa `createClient` com env vars do Deno.
- Auth/Storage helpers — server nunca persiste sessão.

Estratégia recomendada (pragmática, sem inflar complexidade): **duplicação disciplinada com contrato congelado**. Criar `supabase/functions/_shared/runtime/` espelhando a estrutura de `src/runtime/db/`, com os mesmos nomes e assinaturas. Um doc `05-runtime-parity.md` (a produzir na Fase C) documenta o contrato que ambos honram. Extrair `packages/runtime-core` só quando houver terceiro consumidor.

---

## 7. Riscos identificados e mitigações

| Risco | Mitigação |
|---|---|
| JWT do usuário vazar para client service-role | Separação estrita `tenantDbAsUser` vs `tenantDbAsService`; `resolver` marca `role` explicitamente |
| Reuso indevido de client entre requests | Cache tenant-scoped com JWT no key + descarte no `finally` |
| `SERVICE_ROLE_KEY` lida fora do runtime | deno-lint `no-restricted-imports` + grep guard no CI |
| Contexto obsoleto após `suspended` | TTL de 30 s no cache do registry + invalidação por evento (Fase E) |
| Dedicated meia-implementada em produção | `dedicated.ts` lança `RuntimeError`; funções operacionais falham fechado |
| Drift entre runtime front e server | Doc de paridade + testes de contrato executados em ambos |

---

## 8. Critérios de saída (gate para Fase C)

Aprovação da Fase C requer:

1. Este documento revisado e aprovado pelo usuário.
2. Confirmação de que o contrato acima é aceito **antes** de qualquer codemod nas ~70 funções.
3. Definição de um plano de rollout por lotes (ex.: 5 funções piloto → auditoria → resto), a ser produzido no início da Fase C.

Nada foi alterado no código nesta review. Aguardando "ok" para iniciar Fase C com o contrato aqui definido.
