
REVOKE ALL ON FUNCTION public.amostra_em_emprestimo_ativo(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.amostra_em_emprestimo_ativo(uuid) TO authenticated, service_role;
