# 07 — Dead Code Analysis

Evidências herdadas de `docs/database-runtime/forensic-review/06-dead-code.md` e observações desta fase.

## Funções exportadas sem consumidor (client runtime)
- `RuntimeError` (`src/runtime/db/types.ts`)
- `IdentityIssuer.parseClaims` (`identity/supabaseIssuer.ts`)
- `getIdentityIssuer` (`identity/index.ts`)
- `installTenantAuthInvalidation`, `getCachedTenantContext` (`db/tenantContext.ts`)
- `getAllowedDedicatedTables` (`db/factory.ts`) — allowlist sempre vazia

## Funções exportadas sem consumidor (server runtime)
- `dedicatedHealth`, `invalidateDedicatedCache` (`_shared/runtime/db.ts`)
- `setTenantContextProvider`, `setIdentityValidator`, `assertDedicatedRegistry`, `isDedicatedRegistry`

## Colunas nunca populadas
- `tenant_registry.runtime_status`, `frozen_at`, `db_provider`, `runtime_dedicated_enabled`.

## Edges sem consumidor evidente
- `tenant-dedicated-login-gate`, `tenant-resolve` (fase forensic-review/15).

## Páginas potencialmente duplicadas
- `src/pages/Landing.tsx` + `src/pages/LandingPageResponsive.tsx` — ambas presentes; investigação de rotas necessária para confirmar dead code.
- `src/pages/admin/CKEditorTest.tsx` — rota de teste em produção (`/admin/ckeditor-test`).

## Docs órfãs / obsoletas
- `docs/database-runtime/shared-to-dedicated/*` (16 arquivos) — planejamento superado.
- `docs/database-per-tenant-audit/*` (15 arquivos) — auditoria pré-implementação.
- `docs/database-runtime/runtime-freeze.md` — congelamento não aplicável ao estado atual.

## Migrations obsoletas (não removidas — regra do projeto)
- 355 migrations acumuladas; algumas revertem/renomeiam objetos criados por migrations anteriores da mesma safra. Sem métrica automatizada; registro apenas.

## TODO/FIXME persistentes
- 66 ocorrências em `src/` + `supabase/functions/` — top: `SolicitacoesSite.tsx` (9), `tenantValidation.test.ts` (6), `UnidadesTab.tsx` (6), `ConvenioExamesPanel.tsx` (4).
