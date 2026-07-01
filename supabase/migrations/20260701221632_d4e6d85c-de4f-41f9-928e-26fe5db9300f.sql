UPDATE public.tenant_registry
SET runtime_mode = 'shared_db',
    database_strategy = 'shared',
    migration_state = 'idle',
    frozen_at = NULL
WHERE tenant_id = '3e6bfaa6-d5bd-4079-8192-e056bdc382ff';