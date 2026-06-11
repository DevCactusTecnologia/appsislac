
-- F9 P0 hotfix: corrigir policy permissiva e revogar SECURITY DEFINER de anon em RPCs sensíveis

-- 1) signup_rate_limit: policy ALL com USING(true) permitia anon manipular janela de rate-limit
DROP POLICY IF EXISTS allow_service_role_only ON public.signup_rate_limit;
CREATE POLICY allow_service_role_only
  ON public.signup_rate_limit
  AS PERMISSIVE
  FOR ALL
  TO public
  USING ((auth.jwt() ->> 'role') = 'service_role')
  WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

-- 2) Revogar EXECUTE de anon (e PUBLIC) em RPCs operacionais SECURITY DEFINER
REVOKE EXECUTE ON FUNCTION public.atendimentos_page(text, text, text, text, timestamptz, bigint, integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.atendimento_exames_rbac_check() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_own_tenant_site_config(text, text) FROM anon, PUBLIC;

-- Garante que authenticated mantém acesso (idempotente)
GRANT EXECUTE ON FUNCTION public.atendimentos_page(text, text, text, text, timestamptz, bigint, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atendimento_exames_rbac_check() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_own_tenant_site_config(text, text) TO authenticated;
