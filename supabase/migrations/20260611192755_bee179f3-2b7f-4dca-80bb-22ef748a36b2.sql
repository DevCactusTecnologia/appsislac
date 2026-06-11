
-- Revoga EXECUTE público das trigger functions criadas na fase 1.
REVOKE EXECUTE ON FUNCTION public.fwd_atendimento_audit_to_operational()    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fwd_app_settings_audit_to_platform()      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fwd_storage_audit_to_operational()        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fwd_pdf_override_audit_to_operational()   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fwd_protocolo_auditoria_to_operational()  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fwd_criticos_comunicacoes_to_operational()FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fwd_audit_logs_split()                    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fwd_to_platform_audit_generic()           FROM PUBLIC, anon, authenticated;

-- Policies "service_role USING (true)" são redundantes (service_role já bypassa RLS).
DROP POLICY IF EXISTS operational_audit_service_write ON public.operational_audit;
DROP POLICY IF EXISTS platform_audit_service_write    ON public.platform_audit;
