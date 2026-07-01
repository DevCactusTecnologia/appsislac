# 05 — Análise Funcional

Para cada bloco: por que existe / problema resolvido / ainda relevante / uso atual.

## Fachada `db` (client)
- **Por que existe:** proibir import direto de `@/integrations/supabase/client` fora do runtime; permitir rotear por tabela.
- **Problema resolvido:** acoplamento distribuído ao SDK Supabase.
- **Ainda relevante:** parcialmente — nenhum store consome hoje. A fachada existe mas o app continua importando `supabase` direto.
- **Uso atual:** apenas `AuthContext` (`refreshContext`, `resetRuntime`) e teste smoke.

## `TenantContextProvider` (client + server)
- **Por que existe:** desacoplar origem dos metadados (poder trocar por Redis, CI-injected).
- **Problema resolvido:** teórico. Hoje só há `SupabaseRegistryProvider`.
- **Ainda relevante:** apenas se a abstração vier a ser usada. Sem 2ª implementação.
- **Uso atual:** edge functions data-plane migradas (12).

## `IdentityIssuer` / `ServerIdentityValidator`
- **Por que existe:** permitir troca futura de provedor (Keycloak/Auth0) sem tocar em RLS.
- **Problema resolvido:** teórico. Fase D1 rejeitou "auth-per-tenant" e "signed context header".
- **Ainda relevante:** só se dedicated de fato validar JWT via JWKS do shared (config externa não versionada).
- **Uso atual:** `main.tsx` registra `supabaseSharedIssuer`. Nenhum call-site chama `getIdentityIssuer()`. `AuthContext` continua usando `supabase.auth.signInWithPassword` diretamente.

## Strategies (shared/dedicated)
- **Por que existe:** encapsular criação de client por estratégia.
- **Problema resolvido:** poder criar dois transports simultâneos (para roteamento por tabela).
- **Ainda relevante:** apenas se roteamento por tabela for de fato usado (allowlist vazia hoje).
- **Uso atual:** `sharedStrategy` sempre executa; `dedicatedStrategy` só quando `resolveCurrentTenant()` devolver `dedicated` — nunca ocorre em produção.

## Runtime servidor (`getPlatformClient/User/Tenant/UserTenant`)
- **Por que existe:** padronizar criação de clients em edge functions.
- **Problema resolvido:** duplicação de `createClient(SUPABASE_URL, ...)`.
- **Ainda relevante:** sim — 12 edge functions consomem.
- **Uso atual:** ativo, é a interface obrigatória do guardrail CI.

## `_shared/migration/connect.ts`
- **Por que existe:** conectar via `postgres` bruto no dedicated para operações que exigem `session_replication_role=replica` (bypass de triggers).
- **Problema resolvido:** copiar dados sem disparar triggers/audit.
- **Ainda relevante:** sim, é o coração das funções `migrate-*`.
- **Uso atual:** `migrate-auth`, `migrate-data`, `migrate-storage`, `provision-schema*`.

## Edge functions dedicated-specific (20)
- **Por que existem:** implementar o pipeline manual (provisionar → validar → migrar → flip → purge).
- **Problema resolvido:** ausência de tooling nativo para "clonar um tenant para outro projeto Supabase".
- **Ainda relevante:** só se existir plano concreto para primeiro tenant dedicado.
- **Uso atual:** invocáveis via `SuperAdminMigration.tsx`. Nenhum registro de execução real em produção observado.

## Colunas `tenant_registry`
- **db_provider / db_host / db_port / db_name / db_user / db_secret_ref** — modelo inicial (conexão Postgres direta).
- **db_project_url / db_anon_key_secret_ref / db_anon_key_ref** — modelo posterior (Supabase project ref).
- **runtime_mode ('isolated_db') / database_strategy ('dedicated')** — duas colunas com semântica equivalente, lidas por OR.
- **runtime_status ('active'|'suspended'|'provisioning')** — nunca setado por código pesquisado.
- **runtime_dedicated_enabled** — flag booleana redundante com `database_strategy`.
- **migration_state / frozen_at / schema_provisioned_at** — estados do pipeline.

Observação: **três modelos de identificação de banco convivem no mesmo registry** (Postgres direto, Supabase ref, feature flag).
