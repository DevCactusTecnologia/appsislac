REVOKE ALL ON FUNCTION public.update_atendimento_exame_tx(bigint, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_atendimento_exame_tx(bigint, jsonb, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_atendimento_exame_tx(bigint, jsonb, text) TO authenticated;