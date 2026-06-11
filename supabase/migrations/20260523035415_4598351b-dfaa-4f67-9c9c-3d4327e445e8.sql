
-- F9 P2: revogar EXECUTE de anon nas funções SD que são triggers/helpers internos
-- (lookup_paciente_publico permanece acessível por anon — uso intencional no site público)

REVOKE EXECUTE ON FUNCTION public.atendimento_exames_snapshot_regulatorio() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ensure_default_user_role() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_auth_user_deleted() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.next_friendly_id(uuid, text, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.profiles_require_auth_user() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.propagate_integration_result_to_exame() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_especialista_friendly_id() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_paciente_friendly_id() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_profile_friendly_id() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tenant_users_integrity() FROM anon, PUBLIC;

-- is_super_admin precisa continuar acessível a authenticated (RLS depende dele)
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
