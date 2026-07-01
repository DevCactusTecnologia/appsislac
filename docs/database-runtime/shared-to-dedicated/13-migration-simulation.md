# 13 — Migration Simulation (Shared → Dedicated)

Fluxo real observado em `src/pages/superadmin/SuperAdminMigration.tsx` + edge functions `super-admin-*`.

## Passo a passo

| # | Etapa | Componente | Ação | Estado |
|---|---|---|---|---|
| 1 | Criar projeto Supabase dedicado externamente | Manual (fora do SISLAC) | Provisionar `db_project_url`, `db_host`, secret `<REF>` com anon+password | ✓ Manual |
| 2 | Registrar credenciais | `super-admin-update-tenant-db-config` | Preenche `db_project_url`, `db_anon_key_secret_ref`, `db_host/port/name/user`, `db_secret_ref` em `tenant_registry` | ✓ Funciona |
| 3 | Testar conexão | `super-admin-test-tenant-db` + `super-admin-test-tenant-anon-key` | `SELECT 1` + probe PostgREST | ✓ Funciona |
| 4 | Provisionar schema | `super-admin-provision-tenant-schema-full` | Aplica `SCHEMA_MINIMO_V1` (async, com `tenant_migration_runs`) | ✓ Funciona (após correções) |
| 5 | Health check | `super-admin-check-tenant-schema` | Chama `_sislac_schema_health` no dedicado | ✓ Funciona |
| 6 | Migrar auth | `super-admin-migrate-tenant-auth` | Dumpa usuários/roles/profiles do shared e insere no dedicated | △ Recém-corrigido (`user_roles.tenant_id`) |
| 7 | Migrar dados | `super-admin-migrate-tenant-data` | Copia pacientes/atendimentos/exames/pagamentos para dedicado | △ Existe (não validado nesta radiografia) |
| 8 | Migrar storage | `super-admin-migrate-tenant-storage` | Metadata only (ver 06-storage) | ✗ Não copia binários entre projetos |
| 9 | Smoke test | `super-admin-migration-smoke-test` | Valida integridade | △ Existe |
| 10 | Flip | `super-admin-migration-flip` | Ativa `runtime_dedicated_enabled=true`, atualiza `migration_state`, `frozen_at` | △ Existe |
| 11 | Runtime começa a rotear | `tenant-runtime-config` retorna `mode:dedicated` | Frontend passa a escrever nas 4 tabelas allowlist no dedicado | ✗ **Auth quebra**, **Realtime quebra**, **RPC quebra** |
| 12 | Rollback | `super-admin-migration-rollback` | Desliga flag, volta para shared | △ Existe |

## Componentes que participam

- Frontend: `SuperAdminMigration.tsx`, `TenantDatabaseConfig.tsx`, Proxy `db`, `tenantContext`.
- Backend: ~10 edge functions `super-admin-migrate-*` + `provision-*` + `check-*`.
- DB: `tenant_registry`, `tenant_migration_runs`, `tenant_migration_log`, `tenant_provision_audit`.
- Externo: Projeto Supabase dedicado (criado manualmente).

## O que muda vs. o que permanece

**Muda** para tenants no dedicated:
- Escrita/leitura de `pacientes`, `atendimentos`, `atendimento_exames`, `atendimento_pagamentos` (allowlist).
- `tenant_registry.migration_state`, `runtime_dedicated_enabled=true`.

**Permanece no shared** (crítico):
- Auth (JWT), profiles, user_roles, permissions.
- Storage (assets, PDFs, assinaturas, comprovantes).
- Realtime channels.
- RPCs (`update_atendimento_tx`, sequences, `current_tenant_id`).
- Todas as demais tabelas de domínio (~100 tabelas fora do allowlist).
- Todas as edge functions (data-plane escreve no shared).

## Tempo estimado (por tenant)

- Provisionamento schema: **~10–30 s**.
- Migração auth: **~1–5 s** (poucos usuários por tenant).
- Migração dados: **variável** — dominada pelo volume de atendimentos.
- Flip: **<1 s**.

## Riscos

1. **Dessincronização shared↔dedicated** — se edge fn continua escrevendo no shared enquanto frontend lê do dedicated, os dados divergem.
2. **RLS vazio no dedicado** — `auth.uid()` NULL faz queries retornarem 0 linhas silenciosamente.
3. **Realtime silencioso** — usuário não vê updates.
4. **Storage órfão** — binários ficam no shared.
5. **Rollback perde dados** — se houve escrita no dedicated durante janela, rollback pode desconsiderar.

## Rollback

Existe (`super-admin-migration-rollback`). Reverte flag e `migration_state`. **Não faz merge de dados escritos no dedicated durante a janela**.
