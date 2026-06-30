# 01 — Inventário de Conexões

## Cliente Supabase no frontend (SINGLETON GLOBAL)
- `src/integrations/supabase/client.ts:5-12` — único `createClient` do front, lê `import.meta.env.VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` (valores fixos em `.env`: projeto `xhaeozwdfjuvpxgguqqp`).
- Importado por **121 arquivos** (`rg -l "from .@/integrations/supabase/client."` = 121). Todos os stores, hooks, páginas e contextos chamam o MESMO client.

## Edge Functions com `createClient`
Ocorrências confirmadas (40+ funções):
`integration-dispatch`, `super-admin-create-tenant`, `super-admin-test-tenant-db`, `leads-manager`, `sign-resultado`, `whatsapp-webhook`, `lab-apoio-upload-pdf`, `image-url`, `whatsapp-template-sync`, `super-admin-change-tenant-plan`, `lab-apoio-cron-fetch`, `super-admin-billing`, `lab-apoio-adapter`, `soroteca-*`, `integration-*`, `provider-*`, `sitemap`, `upload-pdf`, `upload-image`, `lgpd-*`, `create-atendimento`, `dbsync-test-connection`, …
Todas instanciam o cliente com `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_ANON_KEY` do ambiente da função (1 único projeto).

## Helpers de plataforma
- `supabase/functions/_shared/tenantConnection.ts` — `getPlatformClient()` + `resolveTenantConnection(tenant_id)` (control-plane). Lê `tenant_registry`.
- `supabase/functions/_shared/neonProvider.ts` — wrapper Neon (DRY-RUN, sem rede).
- `supabase/functions/_shared/drivers/*` — drivers de integração (Hermes, DBSync) — não relacionados a DB-per-tenant.
- `supabase/functions/super-admin-test-tenant-db/index.ts:9` — único lugar que abre `pg.Client` real (apenas para `SELECT 1` de diagnóstico).

## Storage
Buckets referenciados como string literal:
- `tenant-assets` — `src/lib/tenantSite/uploadAsset.ts:48,59`
- `integration-assets` — `_shared/drivers/hermes-pardini/driver.ts:174`, `_shared/drivers/dbsync/driver.ts:166`
- `lab-apoio-upload-pdf/index.ts:145` — bucket vem de payload, mas storage é do projeto shared.

## Auth
- `supabase.auth.signInWithPassword` em `AuthContext.tsx:358`, `validarCredenciaisAnalista.ts:64` — todos contra o projeto único.

## Realtime
- `subscribeAtendimentos` (`src/data/atendimentoStore/realtime.ts`) — canal no client global.
