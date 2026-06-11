
-- Harden _get_protocolo_hmac_key
ALTER FUNCTION public._get_protocolo_hmac_key(uuid) 
SET search_path = public;

-- Harden gerar_assinatura_protocolo
ALTER FUNCTION public.gerar_assinatura_protocolo(uuid, text, bigint, timestamptz) 
SET search_path = public;

-- Harden bootstrap_set_cron_secret
ALTER FUNCTION public.bootstrap_set_cron_secret(text) 
SET search_path = public;

-- Adicionando proteção extra para funções de auditoria
ALTER FUNCTION public.audit_trigger() SET search_path = public;
ALTER FUNCTION public.audit_app_settings() SET search_path = public;
ALTER FUNCTION public.audit_atendimento_exames() SET search_path = public;
ALTER FUNCTION public.audit_atendimento_pagamentos() SET search_path = public;

-- Revogar permissões excessivas de 'anon' em tabelas sensíveis
REVOKE ALL ON public.tenant_registry FROM anon;
REVOKE ALL ON public.app_settings FROM anon;
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.user_roles FROM anon;

-- Garantir que service_role tenha acesso total para operações de backend/edge functions
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;
