
ALTER VIEW public.provider_health_current SET (security_invoker = true);

REVOKE EXECUTE ON FUNCTION public.circuit_should_allow(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.circuit_record_success(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.circuit_record_failure(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.health_record_sample(uuid, text, int, text, boolean) FROM PUBLIC, anon;
