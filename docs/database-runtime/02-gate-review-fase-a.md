# 02 — Gate Review da Fase A (Runtime 2.0)

> Pré-condição obrigatória para iniciar a Fase B (codemod dos 121 arquivos).
> Status: **APROVADA** (sujeita à confirmação humana).

Metodologia: **Olhou → Entendeu → Validou → Consolidou → Testou → Congelou**.

---

## Critérios e evidências

### 1. Único ponto de criação de `createClient()`
**Status:** ✅ no runtime de domínio · 🟡 exceção controlada fora dele.

| Local | Papel | Permitido? |
|---|---|---|
| `src/integrations/supabase/client.ts` | Singleton auto-gerado (transport) | Sim — único transport físico |
| `src/runtime/db/strategies/shared.ts` | Reusa o singleton via `__getSharedTransport()` | Sim — único consumidor autorizado |
| `src/runtime/db/strategies/dedicated.ts` | Stub, lança `RuntimeError` | Sim — não cria client |
| `src/runtime/db/factory.ts` | Chama `adapter.createClient(ctx)` | Sim — única factory |
| `src/lib/validarCredenciaisAnalista.ts` | Cria client transiente **in-memory** apenas para validar senha do analista (sem `persistSession`) | 🟡 Exceção documentada — não toca dados, é stateless, será migrado na Fase D (Auth strategy). |

Nenhum outro `createClient(` aparece em `src/` (`rg "createClient\\("` confirma).

### 2. `ConnectionFactory` e `RuntimeResolver` completos
**Status:** ✅

- `factory.ts` → `getClient()`, `refreshContext()`, `resetRuntime()`, `getCurrentContext()`, cache `Map`, dispose por estratégia.
- `resolver.ts` → `resolveCurrentTenant()`, `getBootstrapContext()`, `__getSharedTransport()`.
- Telemetria centralizada (`telemetry.ts`) — 6 eventos cobrindo resolve, criação, cache-hit, dispose, falha.

### 3. Shared e Dedicated são apenas estratégias de conexão
**Status:** ✅

Ambas implementam o mesmo contrato `RuntimeStrategyAdapter` (`types.ts`): `kind`, `createClient(ctx)`, `dispose(ctx)`. Nenhuma estratégia conhece negócio. Trocar de estratégia = trocar a linha em `tenant_registry.database_strategy`.

### 4. Cache isolado por tenant
**Status:** ✅

`factory.ts` `cacheKey = ${strategy}::${project_ref}::${tenant_id}`. Smoke test cobre. Reset limpa o `Map` e chama `dispose` em cada entrada.

### 5. Sem acoplamento Runtime ↔ Supabase fora da infraestrutura
**Status:** ✅

- Único import de `@/integrations/supabase/client` em `src/runtime/db/**` está em `resolver.ts` (re-exporta como `__getSharedTransport`, prefixo duplo-underscore sinaliza uso interno).
- `shared.ts` consome via `__getSharedTransport()` — não importa o singleton diretamente.
- ESLint guard (`eslint.config.js` → `no-restricted-imports`) bloqueia qualquer outro arquivo de `src/` de importar `@/integrations/supabase/client`. Exceções explicitamente listadas: `runtime/db/strategies/shared.ts`, `runtime/db/resolver.ts`, `integrations/supabase/**`.

### 6. Nenhuma regra de negócio alterada
**Status:** ✅

Diff da Fase A toca apenas: `src/runtime/db/**` (novo), `eslint.config.js` (regra), `docs/database-runtime/**` (docs). Zero alterações em `src/data/`, `src/pages/`, `src/components/`, `src/hooks/`, `supabase/functions/`.

### 7. Domínio intacto
**Status:** ✅

Os 121 arquivos consumidores continuam importando `@/integrations/supabase/client` como antes — comportamento idêntico. O ESLint guard está **avisando**, não quebrando ainda (regra ativa, mas os arquivos legados são afetados apenas quando editados — a Fase B é exatamente o codemod que os migra).

> Observação operacional: `eslint --max-warnings 0` falharia hoje nos 121 arquivos. CI continua passando porque o pipeline não usa `--max-warnings 0`. Após Fase B isso deixa de ser questão.

### 8. Rollback seguro para Shared
**Status:** ✅

Três níveis de rollback, do menor ao maior:

1. **Runtime** — `resetRuntime()` devolve ao `getBootstrapContext()` (sempre `shared`). Sem reload de página.
2. **Tenant** — `UPDATE tenant_registry SET database_strategy='shared' WHERE tenant_id=?` e a próxima chamada de `refreshContext()` reconverte.
3. **Código** — remover `src/runtime/db/**` + reverter `eslint.config.js`. Nenhum arquivo de domínio depende do runtime hoje; o singleton continua funcionando como sempre funcionou.

### 9. Complexidade do projeto não aumentou
**Status:** ✅

| Métrica | Antes | Depois Fase A | Δ |
|---|---|---|---|
| Arquivos em `src/runtime/db` | 0 | 7 | +7 (núcleo isolado) |
| Arquivos de domínio modificados | — | **0** | 0 |
| Caminhos de criação de client em domínio | 1 (singleton) | 1 (`db` proxy) | 0 |
| Dependências npm novas | — | **0** | 0 |
| Regras ESLint novas | 0 | 1 (`no-restricted-imports`) | +1 |

Acréscimo é **estrutural e contido** (uma porta única + estratégias). Para o consumidor final na Fase B, a troca é 1-para-1: `supabase.` → `db.`.

---

## Smoke tests
`src/runtime/db/__tests__/runtime.smoke.test.ts` valida:
- Porta única `db` proxia o client corrente.
- Shared devolve singleton estável.
- Dedicated falha com `RuntimeError` (fail-closed).
- Cache isolado por contexto; `resetRuntime()` volta ao bootstrap shared.

Rodar: `bunx vitest run src/runtime/db/__tests__/runtime.smoke.test.ts`.

---

## Pendências assumidas (escopo das próximas fases)
- **Fase B** — codemod 121 arquivos `supabase` → `db` (zero mudança de comportamento esperada).
- **Fase C** — runtime equivalente em edge functions.
- **Fase D** — `validarCredenciaisAnalista.ts` migra para AuthStrategy; buckets de Storage namespaced.

## Veredito
Runtime estável, isolado, com rollback trivial e zero impacto no domínio. **Liberado para Gate Review humano antes da Fase B.**
