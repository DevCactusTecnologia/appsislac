# 05 — Final Architecture

```
src/runtime/
└── db.ts                                       (1 arquivo, ~165 linhas)

supabase/functions/_shared/
├── runtime/
│   ├── createClient.ts                         (reexport supabase-js)
│   └── db.ts                                   (fachada tenant-aware)
└── migration/
    └── connect.ts                              (loadRegistry + postgres.js)

supabase/functions/
├── super-admin-provision-tenant-schema*/
├── super-admin-migrate-tenant-{auth,data,storage}/
├── super-admin-migration-{smoke-test,flip,rollback}/
├── super-admin-{tenant-snapshot,tenant-backup,purge-tenant-from-shared}/
├── super-admin-{create-tenant,update-tenant-db-config,test-tenant-db,test-tenant-anon-key,check-tenant-schema,import-tenant-admin}/
├── tenant-resolve/
└── tenant-dedicated-login-gate/

src/pages/superadmin/
└── SuperAdminMigration.tsx                     (wizard)

src/components/superadmin/
└── TenantDatabaseConfig.tsx                    (form config + testes)
```

Nada mais. Sem factory, sem strategies, sem identity registry, sem tenant-context provider, sem allowlist de tabelas, sem telemetry helper.
