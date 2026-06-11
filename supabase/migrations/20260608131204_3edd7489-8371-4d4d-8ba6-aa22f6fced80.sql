-- Fase 1: Security Hardening (P0 Fixes)
-- Proteção de funções SECURITY DEFINER contra sequestro de search_path

ALTER FUNCTION public.lookup_paciente_publico(uuid, text) SET search_path = public;
ALTER FUNCTION public.tenant_registry_autoinsert() SET search_path = public;
ALTER FUNCTION public.log_tenant_provisioning_transition() SET search_path = public;
ALTER FUNCTION public.sync_tenant_registry_runtime_status() SET search_path = public;
ALTER FUNCTION public.generate_next_lab_code() SET search_path = public;
ALTER FUNCTION public.tenant_registry_lab_code_guard() SET search_path = public;
ALTER FUNCTION public.ensure_tenant_billing() SET search_path = public;

-- Garantir RLS em tabelas de auditoria/logs (P0)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atendimento_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pdf_override_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protocolo_auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_provision_audit ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso para auditoria
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins veem logs do seu tenant' AND tablename = 'audit_logs') THEN
        CREATE POLICY "Admins veem logs do seu tenant" ON public.audit_logs 
        FOR SELECT TO authenticated 
        USING (
            tenant_id = (select tenant_id from public.profiles where user_id = auth.uid()) 
            OR 
            EXISTS (select 1 from public.user_roles where user_id = auth.uid() and role = 'super_admin')
        );
    END IF;
END $$;

GRANT SELECT ON public.audit_logs TO authenticated;
GRANT SELECT ON public.app_settings_audit TO authenticated;
GRANT SELECT ON public.atendimento_audit TO authenticated;
GRANT SELECT ON public.pdf_override_audit TO authenticated;
GRANT SELECT ON public.protocolo_auditoria TO authenticated;
GRANT SELECT ON public.storage_audit TO authenticated;
GRANT SELECT ON public.tenant_provision_audit TO authenticated;
