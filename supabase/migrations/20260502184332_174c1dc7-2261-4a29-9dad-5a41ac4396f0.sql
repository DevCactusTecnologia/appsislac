-- P0 Hardening: revogar EXECUTE de anon em funções sensíveis (assinaturas reais)
REVOKE ALL ON FUNCTION public.ocorrencias_page(timestamptz, bigint, text, integer, timestamptz, timestamptz, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ensure_recoleta_motivo_nome() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.seed_default_listas_globais_on_tenant_create() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.seed_default_motivos_cancelamento_for_tenant(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.validate_protocolo_atendimento(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.validate_protocolo_fatura(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.validate_protocolo_orcamento(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.validate_protocolo_saida(text) FROM PUBLIC, anon;

-- Grant apenas para authenticated nas funções chamadas direto pelo client
GRANT EXECUTE ON FUNCTION public.ocorrencias_page(timestamptz, bigint, text, integer, timestamptz, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_protocolo_atendimento(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_protocolo_fatura(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_protocolo_orcamento(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_protocolo_saida(text) TO authenticated;

-- signup_rate_limit: garantir RLS + política service_role-only
ALTER TABLE public.signup_rate_limit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_service_role_only" ON public.signup_rate_limit;
CREATE POLICY "allow_service_role_only"
ON public.signup_rate_limit
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);