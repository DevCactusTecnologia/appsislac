
-- Harden lookup_paciente_publico
ALTER FUNCTION public.lookup_paciente_publico(uuid, text) SET search_path = public;

-- Harden internal governance functions
ALTER FUNCTION public.tenant_registry_autoinsert() SET search_path = public;
ALTER FUNCTION public.cron_health_record(text, timestamptz, integer, text, integer, text, jsonb) SET search_path = public;
ALTER FUNCTION public.log_tenant_provisioning_transition() SET search_path = public;
ALTER FUNCTION public.sync_tenant_registry_runtime_status() SET search_path = public;
ALTER FUNCTION public.generate_next_lab_code() SET search_path = public;
ALTER FUNCTION public.tenant_registry_lab_code_guard() SET search_path = public;
ALTER FUNCTION public.ensure_tenant_billing() SET search_path = public;

-- Revoke public execution for sensitive internal functions
-- This prevents anonymous users from calling them via the API
REVOKE EXECUTE ON FUNCTION public.tenant_registry_autoinsert() FROM public;
REVOKE EXECUTE ON FUNCTION public.cron_health_record(text, timestamptz, integer, text, integer, text, jsonb) FROM public;
REVOKE EXECUTE ON FUNCTION public.log_tenant_provisioning_transition() FROM public;
REVOKE EXECUTE ON FUNCTION public.sync_tenant_registry_runtime_status() FROM public;
REVOKE EXECUTE ON FUNCTION public.generate_next_lab_code() FROM public;
REVOKE EXECUTE ON FUNCTION public.tenant_registry_lab_code_guard() FROM public;
REVOKE EXECUTE ON FUNCTION public.ensure_tenant_billing() FROM public;

-- Specifically allow service_role to execute them (Edge Functions/Internal)
GRANT EXECUTE ON FUNCTION public.tenant_registry_autoinsert() TO service_role;
GRANT EXECUTE ON FUNCTION public.cron_health_record(text, timestamptz, integer, text, integer, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.log_tenant_provisioning_transition() TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_tenant_registry_runtime_status() TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_next_lab_code() TO service_role;
GRANT EXECUTE ON FUNCTION public.tenant_registry_lab_code_guard() TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_tenant_billing() TO service_role;

-- lookup_paciente_publico is intended to be used by the public portal, 
-- but we should ensure it has proper internal logic (already hardened search_path).
-- It's a SECURITY DEFINER because it needs to query patients without user being logged in (public verification).
