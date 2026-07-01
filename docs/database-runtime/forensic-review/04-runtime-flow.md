# 04 — Fluxo Real da Migração

Do clique em "Migrar" até "tenant operando em Dedicated". Somente o que está implementado.

```
SuperAdminMigration.tsx (UI)
   │
   ├─ 1. super-admin-update-tenant-db-config
   │      grava db_project_url, db_secret_ref, db_anon_key_ref em tenant_registry
   │
   ├─ 2. super-admin-provision-tenant-schema-full
   │      conecta no Dedicated via connect.ts → cria schema public + auth grants
   │      seta schema_provisioned_at
   │
   ├─ 3. super-admin-migration-smoke-test  (opcional — nunca invocado por default)
   │
   ├─ 4. super-admin-migrate-tenant-auth
   │      RPC super_admin_dump_auth_users (shared) → INSERT auth.users (dedicated)
   │      + user_roles ON CONFLICT DO NOTHING
   │
   ├─ 5. super-admin-migrate-tenant-data
   │      RPC super_admin_list_migration_tables (ordena por FK level)
   │      loop: super_admin_dump_table_page (500 linhas) → INSERT com
   │      session_replication_role=replica no dedicated
   │      atualiza migration_state = 'data_ready' | 'data_failed'
   │
   ├─ 6. super-admin-migrate-tenant-storage
   │      copia objetos de storage do shared para bucket dedicated
   │
   ├─ 7. super-admin-migration-flip
   │      ATUALIZA tenant_registry.database_strategy = 'dedicated'
   │                          runtime_mode = 'isolated_db'
   │                          runtime_dedicated_enabled = true
   │                          frozen_at = now()
   │      (não invalida cache — invalidateDedicatedCache existe mas não é chamada)
   │
   └─ 8. super-admin-purge-tenant-from-shared  (opcional)
          apaga dados do tenant no shared após validação
```

## Fluxo do app após flip (runtime)
```
Usuário loga
   │
AuthContext.signIn → refreshContext()
   │
db/tenantContext.ts.resolveContext()
   ├─ profiles.tenant_id (shared)
   └─ invoke('tenant-runtime-config')
        └─ tenant-runtime-config edge:
             lê tenant_registry, se runtime_dedicated_enabled
             retorna { mode:'dedicated', dedicated:{url,anon_key}, allowed_tables }
   │
factory.buildEntry(ctx)
   ├─ primary = sharedStrategy (para auth/storage/tabelas fora do allowlist)
   └─ dedicated = createClient(url, anon)  (cacheado)
   │
db.from(table):
   se ctx.strategy=='dedicated' && table ∈ allowed_tables → dedicated
   caso contrário                                        → shared
```

## Fluxo do lado das Edge Functions
```
Edge function (ex.: create-atendimento)
   │
getUserTenantClient(authHeader, tenant_id)
   │
_shared/runtime/tenantContext.ts.SupabaseRegistryProvider.resolve()
   │
   ├─ shared: retorna getUserClient (anon + Authorization)
   └─ dedicated: lookup tenant_registry (db_project_url + db_anon_key_ref)
                 → cria client apontando para o projeto dedicado
                 → JWT do usuário é reencaminhado
                 (Postgres do dedicado precisa validar JWT via JWKS do shared —
                  configuração manual no dashboard do projeto dedicado)
```

## Lacunas observadas no fluxo
1. Passo 7 (`flip`) não chama `invalidateDedicatedCache` — clientes ativos podem continuar apontando para shared até logout.
2. `tenant-runtime-config` é chamada TODA vez que `getTenantContext()` cache expira, sem cache local (apenas cache em memória do módulo).
3. Não há passo de "freeze shared em modo read-only" além de `frozen_at` (coluna informativa).
4. Não há passo de rollback automático quando `migrate-data` falha — a UI expõe `super-admin-migration-rollback` mas o operador precisa acionar manualmente.
