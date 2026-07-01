# 04 — Pipeline Final

Pipeline preservado integralmente (é o coração do projeto):

## Provisionamento
- `super-admin-create-tenant`
- `super-admin-update-tenant-db-config`
- `super-admin-provision-tenant-schema`
- `super-admin-provision-tenant-schema-full`
- `super-admin-check-tenant-schema`
- `super-admin-test-tenant-db`
- `super-admin-test-tenant-anon-key`
- `super-admin-import-tenant-admin`

## Migração
- `super-admin-migrate-tenant-auth`
- `super-admin-migrate-tenant-data`
- `super-admin-migrate-tenant-storage`
- `super-admin-migration-smoke-test`
- `super-admin-migration-flip`
- `super-admin-migration-rollback`
- `super-admin-purge-tenant-from-shared`
- `super-admin-tenant-snapshot`
- `super-admin-tenant-backup`

## Runtime dedicado
- `tenant-resolve` (login por lab_code)
- `tenant-dedicated-login-gate` (verifica prontidão antes de logar em tenant dedicado)

`tenant-runtime-config` e `tenant-healthcheck` foram removidas (sem consumidor).
