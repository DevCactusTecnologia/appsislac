update public.tenant_registry
set migration_state = 'dedicated'
where runtime_mode = 'isolated_db' and migration_state <> 'dedicated';