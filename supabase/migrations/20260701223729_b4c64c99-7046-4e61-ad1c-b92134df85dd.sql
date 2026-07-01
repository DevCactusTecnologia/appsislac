UPDATE public.tenant_registry
SET runtime_mode = 'shared_db',
    database_strategy = 'shared',
    migration_state = 'migrating',
    updated_at = now()
WHERE tenant_id = '3e6bfaa6-d5bd-4079-8192-e056bdc382ff';

UPDATE public.tenants
SET database_strategy = 'shared'
WHERE id = '3e6bfaa6-d5bd-4079-8192-e056bdc382ff';