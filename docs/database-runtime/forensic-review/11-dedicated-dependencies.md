# 11 — Dependências do Dedicated

O que hoje depende **exclusivamente** do banco Dedicated.

## Depende exclusivamente
- `_shared/migration/connect.ts` — conexão `postgres` bruta.
- `super-admin-provision-tenant-schema` / `-full` — cria schema no Dedicated.
- `super-admin-migrate-tenant-auth` — INSERT direto em `auth.users` do Dedicated.
- `super-admin-migrate-tenant-data` — INSERTs paginados no Dedicated.
- `super-admin-migrate-tenant-storage` — copia objetos para storage do Dedicated.
- `super-admin-test-tenant-db` / `-anon-key` — validam credenciais do Dedicated.
- `super-admin-check-tenant-schema` — introspecta schema do Dedicated.
- `super-admin-purge-tenant-from-shared` — só faz sentido após tenant estar no Dedicated.
- `dedicatedStrategy` (client) — cria client contra URL/anon do Dedicated.
- `getTenantClient` / `getUserTenantClient` (server) — ramificação dedicated.

## Depende parcialmente
- `tenant-runtime-config` — devolve credenciais do Dedicated para o cliente.
- `SuperAdminMigration.tsx` — só faz sentido operar sobre Dedicated.

## Requisitos externos não versionados
- Secret `SB_SERVICE_ROLE_<project_ref>` por tenant dedicado — não existe no ambiente.
- Configuração JWKS no projeto Dedicado apontando para o Shared — não há evidência de automação.
- Buckets de storage criados no Dedicado — não há migration.

## Runtime dependency count
Nenhum código de produção do usuário final (páginas, stores, hooks) tem dependência do Dedicated — apenas os 7 caminhos de pipeline + 2 helpers de client.
