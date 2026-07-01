# 01 — Timeline (Shared → Dedicated)

Reconstrução cronológica baseada em `docs/database-runtime/**` e `supabase/migrations/**`.
Cada fase lista apenas o que existe hoje no repositório.

## Fase A — Radiografia inicial
- Docs: `docs/database-per-tenant-audit/01..15-*.md` (15 arquivos).
- Objetivo declarado: mapear estado atual (single-DB compartilhado) antes de migrar.
- Resultado: readiness score, mapa de conexões, gaps de auth/storage/rls.
- Situação: fechada; nenhum código de runtime criado nesta fase.

## Fase B — Codemod / Runtime overview (Shared-only)
- Docs: `docs/database-runtime/01-runtime-overview.md`, `02-gate-review-fase-a.md`, `03-fase-b-codemod-audit.md`.
- Introduziu a ideia de `db()` como fachada única e proibiu import direto de `@/integrations/supabase/client` fora da fachada.
- Runtime criado: `src/runtime/db/{index,resolver,factory,tenantContext,telemetry,types}.ts` e `strategies/shared.ts`.
- Situação: ativo, base de tudo.

## Fase C — Server runtime + Edge functions audit
- Docs: `04-server-runtime-review.md`, `05-fase-c-edge-functions-audit.md`, `06-fase-d-consolidation.md`.
- Runtime servidor: `supabase/functions/_shared/runtime/{createClient,db,identity,tenantContext}.ts`.
- Introduziu `getPlatformClient` / `getUserClient` / `getTenantClient` / `getUserTenantClient`.
- Situação: ativo; base para toda edge function pós-refactor.

## Fase Shared→Dedicated (bloco planejamento)
- Docs: `docs/database-runtime/shared-to-dedicated/01..16-*.md` (16 arquivos).
- Não gerou código sozinha — é planejamento/gap analysis.
- Congelou runtime em `runtime-freeze.md`.

## Fase Dedicated Runtime v1.0 (execução)
- Docs: `docs/database-runtime/dedicated-runtime/01..10-*.md`.
- Migrations control-plane: `20260525130936_*` (tabela `tenant_registry` + colunas `database_strategy`, `runtime_mode`, `runtime_status`, `db_provider`, `db_secret_ref`).
- Ampliações: `20260701010019_*` (`db_project_url`, `db_anon_key_secret_ref`, `schema_provisioned_at`), `20260701012659_*` (`runtime_dedicated_enabled`), `20260701032431_*` (`migration_state`, `frozen_at`).
- Edge functions criadas nesta fase: `tenant-runtime-config`, `tenant-healthcheck`, `tenant-dedicated-login-gate`, `tenant-resolve`, `super-admin-provision-tenant-schema`, `super-admin-provision-tenant-schema-full`, `super-admin-migrate-tenant-{auth,data,storage}`, `super-admin-migration-{flip,rollback,smoke-test}`, `super-admin-purge-tenant-from-shared`, `super-admin-test-tenant-{db,anon-key}`, `super-admin-update-tenant-db-config`, `super-admin-check-tenant-schema`, `super-admin-tenant-{snapshot,backup}`, `super-admin-import-tenant-admin`.
- Runtime cliente: adicionadas `src/runtime/db/strategies/dedicated.ts`, allowlist em `tenantContext.ts`, roteamento por tabela em `index.ts`.
- Identity Layer criado: `src/runtime/identity/{index,supabaseIssuer}.ts` (cliente) e `supabase/functions/_shared/runtime/identity.ts` (servidor). Registrado no bootstrap em `src/main.tsx`.

## Slices 1..3 (revisão e execução por domínio)
- Docs: `docs/database-runtime/slices/11..18`.
- Slice 1 — Foundation (Identity + factory com cache LRU/health probes).
- Slice 2 — Migração dos domínios `create-atendimento` / `update-atendimento` + guardrail CI `scripts/check-data-plane-routing.sh`.
- Slice 3 — Migração de Resultado/PDF (10 edge functions) + `docs/database-runtime/slices/16-migration-template.md` como padrão obrigatório.

## Estado atual (evidência)
- 15 arquivos runtime (cliente + servidor + identity + connect helpers), 1212 linhas.
- 12 edge functions migradas para a fachada; ~18 edge functions dedicated-specific.
- 4 migrations de control-plane em `tenant_registry`.
- Nenhum tenant marcado como dedicated em produção (não há evidência de `runtime_mode='isolated_db'` populada).
