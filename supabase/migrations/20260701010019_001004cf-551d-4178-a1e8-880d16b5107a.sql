ALTER TABLE public.tenant_registry
  ADD COLUMN IF NOT EXISTS db_project_url text,
  ADD COLUMN IF NOT EXISTS db_anon_key_secret_ref text,
  ADD COLUMN IF NOT EXISTS schema_provisioned_at timestamptz;

COMMENT ON COLUMN public.tenant_registry.db_project_url IS
  'URL pública do projeto Supabase dedicado (ex: https://xyz.supabase.co). Consumida pela DedicatedStrategy no frontend.';
COMMENT ON COLUMN public.tenant_registry.db_anon_key_secret_ref IS
  'Nome do segredo no Vault contendo a anon key do projeto dedicado. Convenção: TENANT_<codigo>_ANON_KEY.';
COMMENT ON COLUMN public.tenant_registry.schema_provisioned_at IS
  'Timestamp do provisionamento do schema SISLAC no banco dedicado. NULL = ainda no shared (fail-safe: DedicatedStrategy só ativa após provisionamento).';