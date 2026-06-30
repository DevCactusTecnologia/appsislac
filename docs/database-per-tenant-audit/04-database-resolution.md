# 04 — Database Resolution

## O que existe (control-plane)
Tabela `public.tenant_registry` (`supabase/migrations/20260525130936…sql`):
- `database_strategy` ∈ {`shared`,`dedicated`}
- `db_host`, `db_port`, `db_name`, `db_user`, `db_secret_ref`
- Adicionados depois (`20260525134033…sql`): `db_provider` ∈ {`shared_supabase`,`neon`,`supabase_project`,`external_postgres`}, `runtime_mode`.
- UI: `src/components/superadmin/TenantDatabaseConfig.tsx` (preenche esses campos + dropdown de região).
- Validação: `super-admin-test-tenant-db` abre conexão real e roda `SELECT 1`.

## O que NÃO existe
- Resolver dinâmico de `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SERVICE_ROLE` por tenant — todos os edge functions leem do env global do projeto compartilhado.
- Pool de clientes Supabase por tenant. `resolveTenantConnection` retorna `getPlatformClient()` para `shared` e **lança Error** para `dedicated` (linha 74).
- Nenhum mapeamento `tenant → Supabase project_id`. O campo `db_provider='supabase_project'` é só metadado — não há código que crie/inicialize um SupabaseClient apontando para esse projeto.
- Nenhum resolver de bucket de Storage, JWT secret ou edge function endpoint por tenant.

## Status
**Parcial — apenas metadados.** Existe schema para registrar `host/port/user/secret`, e existe teste de conexão Postgres direta, mas não há runtime que use esses dados para servir requisições do app.
