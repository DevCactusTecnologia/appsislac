-- Onda 1 + 2 — DB hardening conservador

-- A. cnpj_digits: fixar search_path
ALTER FUNCTION public.cnpj_digits(text) SET search_path = public;

-- D. Revogar EXECUTE de anon em funções que não devem ser chamadas sem auth
REVOKE EXECUTE ON FUNCTION public.atendimento_exames_snapshot_regulatorio() FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_tenant_feature_flags() FROM anon;
REVOKE EXECUTE ON FUNCTION public.ensure_default_user_role() FROM anon;