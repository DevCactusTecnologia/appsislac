
-- Revoke from specific roles to be safe
REVOKE ALL ON FUNCTION public.tenant_registry_autoinsert() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.cron_health_record(text, timestamptz, integer, text, integer, text, jsonb) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.log_tenant_provisioning_transition() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.sync_tenant_registry_runtime_status() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.generate_next_lab_code() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.tenant_registry_lab_code_guard() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.ensure_tenant_billing() FROM anon, authenticated, public;

-- Grant back only to service_role and postgres (owner)
GRANT EXECUTE ON FUNCTION public.tenant_registry_autoinsert() TO service_role;
GRANT EXECUTE ON FUNCTION public.cron_health_record(text, timestamptz, integer, text, integer, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.log_tenant_provisioning_transition() TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_tenant_registry_runtime_status() TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_next_lab_code() TO service_role;
GRANT EXECUTE ON FUNCTION public.tenant_registry_lab_code_guard() TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_tenant_billing() TO service_role;

-- Also check other SECURITY DEFINER functions that should be internal
REVOKE ALL ON FUNCTION public.atendimento_exames_snapshot_regulatorio() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.atendimento_exames_snapshot_regulatorio() TO service_role;

REVOKE ALL ON FUNCTION public.handle_auth_user_deleted() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.handle_auth_user_deleted() TO service_role;
