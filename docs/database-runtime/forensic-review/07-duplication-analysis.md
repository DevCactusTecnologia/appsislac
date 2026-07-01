# 07 — Duplicações

## Cliente Supabase — 3 caminhos coexistentes
1. `src/integrations/supabase/client.ts` (singleton oficial, gerado).
2. `src/runtime/db/index.ts` — fachada `db` (Proxy).
3. `src/runtime/db/strategies/shared.ts` — reusa o singleton via `__getSharedTransport`.

O app hoje usa (1) diretamente em ~150 arquivos; (2)/(3) só existem para a rota dedicated que nunca ativa.

## Resolução de tenant — duplicada
- Cliente: `src/runtime/db/tenantContext.ts.resolveContext()`.
- Servidor: `supabase/functions/_shared/runtime/tenantContext.ts.SupabaseRegistryProvider.resolve()`.
- Edge `tenant-runtime-config` (que serve o cliente) refaz a mesma leitura.

Três leituras independentes do mesmo `tenant_registry`, com formatos de resposta diferentes.

## `MigrationBlockedError` — duas definições
- `src/runtime/db/types.ts` (client) — códigos incluem `IDENTITY_MISMATCH`.
- `supabase/functions/_shared/runtime/db.ts` (server) — códigos diferentes (`DEDICATED_SERVICE_KEY_MISSING`).

Nomes iguais, contratos divergentes.

## Identity Layer — cliente vs servidor
- `src/runtime/identity/index.ts` define `IdentityIssuer` (login/session).
- `supabase/functions/_shared/runtime/identity.ts` define `ServerIdentityValidator` (parse claims).
- Ambos com `IdentityClaims` duplicado.

## Detecção "é dedicated?" — 4 pontos
- `_shared/migration/connect.ts.isDedicatedRegistry`: `runtime_mode==='isolated_db' || database_strategy==='dedicated'`.
- `_shared/runtime/tenantContext.ts`: mesma expressão.
- `tenant-runtime-config` (edge): lógica própria.
- `src/runtime/db/resolver.ts`: `database_strategy==='dedicated' && database_url && anon_key`.

## Colunas de identidade do banco dedicado — 3 famílias
- Postgres direto: `db_host/port/name/user/db_secret_ref`.
- Supabase ref: `db_project_url/db_anon_key_secret_ref/db_anon_key_ref`.
- Feature flag: `runtime_dedicated_enabled`.

Coexistem sem regra clara de qual é a fonte da verdade.

## Docs
- `docs/database-runtime/dedicated-runtime/*` cobre o mesmo escopo de `docs/database-runtime/shared-to-dedicated/*` (planejamento vs execução), com ~70% de sobreposição temática.
