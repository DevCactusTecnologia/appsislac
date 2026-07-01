# Fase C — Codemod das Edge Functions (auditoria)

**Status:** ✅ Concluída · **Data:** 2026-07-01 · **Estratégia:** alias mecânico (idêntica à Fase B)

## Objetivo

Estabelecer um chokepoint único server-side para criação de clientes Supabase
dentro de `supabase/functions/**`, sem alterar comportamento ou call sites,
preparando o terreno para roteamento tenant-aware (shared → dedicated) em ondas
futuras. Incorpora também o `TenantContextProvider` recomendado na Gate Review
da Fase B, desacoplando o Runtime da origem dos metadados de tenant.

## O que foi criado

| Arquivo | Papel |
|---|---|
| `supabase/functions/_shared/runtime/createClient.ts` | **Chokepoint único**. Reexporta `createClient` de `@supabase/supabase-js@2.45.0`. Único módulo autorizado a importar da esm.sh. |
| `supabase/functions/_shared/runtime/db.ts` | Fachada de alto nível: `getPlatformClient()`, `getUserClient(authHeader)`, `getTenantClient(tenant_id)`. Fail-closed em `dedicated`. |
| `supabase/functions/_shared/runtime/tenantContext.ts` | Contrato `TenantContextProvider` + implementação default `SupabaseRegistryProvider`. Injetável para testes/futuras origens (Redis, KV, service discovery). |

## Codemod aplicado

- **Escopo estrito:** substituição apenas do *source* do `import { createClient }`.
- **Zero mudança de call sites:** nenhuma alteração em `createClient(...)`, argumentos, opções, headers ou lógica.
- **Zero mudança em RLS, Auth, queries ou regras de negócio.**

Comando (versão simplificada):

```python
pat = re.compile(r'from\s+"https://esm\.sh/@supabase/supabase-js@[^"]+"')
# + variante com aspas simples para tenant-healthcheck
# → substitui por caminho relativo até _shared/runtime/createClient.ts
```

### Arquivos alterados (66)

- 3 arquivos do runtime server (novos, criados nesta fase).
- 63 arquivos de edge functions e helpers em `_shared/` (import trocado).

Nenhum arquivo fora deste escopo foi tocado.

## Auditoria automática

| Critério | Resultado |
|---|---|
| Imports de `esm.sh/@supabase/supabase-js` fora do chokepoint | **0** (só `_shared/runtime/createClient.ts`) |
| Imports de `createClient` fora do runtime | **0** (todos passam por `_shared/runtime/createClient.ts` ou `./createClient.ts`) |
| `tsc --noEmit -p tsconfig.app.json` | ✅ exit 0 |
| Smoke `src/runtime/db/__tests__/runtime.smoke.test.ts` | ✅ 4/4 |
| Consolidação de versão da SDK | 2.45.0 / 2.45.4 / 2.103.3 → **2.45.0 única** (governança) |
| Alteração de lógica / RLS / queries | **Nenhuma** |

Comandos de auditoria reproduzíveis:

```bash
# A — nenhum import direto da esm.sh fora do chokepoint
rg -n "esm\.sh/@supabase/supabase-js" supabase/functions \
  --glob '!_shared/runtime/createClient.ts'

# B — todos os imports de createClient apontam ao runtime
rg -n 'import[^;]*createClient[^;]*from' supabase/functions \
  | rg -v 'runtime/createClient'
```

## Compatibilidade com o legado

- `_shared/tenantConnection.ts` continua funcional — passou pelo mesmo codemod
  e agora obtém `createClient` via chokepoint. Nenhuma edge function existente
  precisou ser reescrita para se beneficiar da nova governança.
- `getPlatformClient()` (novo) e o helper homônimo em `tenantConnection.ts`
  coexistem; futuras funções devem preferir o do `runtime/db.ts`.

## TenantContextProvider (evolução recomendada na Gate Review)

Contrato mínimo, focado em uma única responsabilidade — **resolver**
`tenant_id → { strategy, runtime_status, db_provider, db_secret_ref }`.
A criação real do client permanece na fábrica (`runtime/db.ts`), preservando
a separação estrutura ↔ política.

Implementações futuras plugáveis sem tocar edge functions:

- `RedisTenantContextProvider` — cache sub-ms com invalidação por pub/sub.
- `StaticTenantContextProvider` — config injetada por CI/CD (multi-região).
- `HybridTenantContextProvider` — cache local com fallback ao registry.

Troca via `setTenantContextProvider(p)` — usado em testes e em bootstraps
alternativos.

## O que continua igual

- Ciclo de vida de conexões (stateless por request, sem pool persistente).
- Uso de `SERVICE_ROLE_KEY` (isolado no runtime, nunca vaza em resposta).
- Autenticação de usuário (mesmo padrão anon + `Authorization` header).
- Roteamento `dedicated` permanece **fail-closed** até Onda 2.5/3.

## Próximo passo sugerido (Fase D)

Storage & Auth server-side — o alvo já mapeado inclui:

- `src/lib/validarCredenciaisAnalista.ts` (única exceção controlada
  ao chokepoint frontend documentada na Fase A).
- Consolidação dos helpers de Storage (`_shared/s3.ts`) sob a mesma
  fachada `runtime/storage.ts`.

Aguardando aprovação para prosseguir.
