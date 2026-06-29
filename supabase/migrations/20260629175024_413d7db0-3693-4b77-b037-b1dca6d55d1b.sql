CREATE OR REPLACE FUNCTION public.update_exame_terceirizado_tx(
  _exame_id bigint,
  _patch jsonb DEFAULT '{}'::jsonb,
  _justificativa text DEFAULT 'Fluxo terceirizado: atualização operacional'
)
RETURNS public.atendimento_exames
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_row public.atendimento_exames;
  v_tenant uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  v_tenant := public.current_tenant_id();
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Usuário sem tenant associado' USING ERRCODE = '42501';
  END IF;

  PERFORM public.set_audit_justificativa(
    COALESCE(NULLIF(trim(_justificativa), ''), 'Fluxo terceirizado: atualização operacional')
  );

  UPDATE public.atendimento_exames ae
     SET status_externo = CASE WHEN _patch ? 'status_externo' THEN _patch->>'status_externo' ELSE ae.status_externo END,
         protocolo_externo = CASE WHEN _patch ? 'protocolo_externo' THEN _patch->>'protocolo_externo' ELSE ae.protocolo_externo END,
         data_envio = CASE WHEN _patch ? 'data_envio' THEN NULLIF(_patch->>'data_envio', '')::timestamptz ELSE ae.data_envio END,
         data_retorno = CASE WHEN _patch ? 'data_retorno' THEN NULLIF(_patch->>'data_retorno', '')::timestamptz ELSE ae.data_retorno END,
         data_liberacao = CASE WHEN _patch ? 'data_liberacao' THEN NULLIF(_patch->>'data_liberacao', '')::timestamptz ELSE ae.data_liberacao END,
         resultado_importado = CASE WHEN _patch ? 'resultado_importado' THEN COALESCE((_patch->>'resultado_importado')::boolean, false) ELSE ae.resultado_importado END,
         arquivo_resultado_path = CASE WHEN _patch ? 'arquivo_resultado_path' THEN _patch->>'arquivo_resultado_path' ELSE ae.arquivo_resultado_path END,
         status = CASE WHEN _patch ? 'status' THEN _patch->>'status' ELSE ae.status END,
         updated_at = now()
   WHERE ae.id = _exame_id
     AND ae.tenant_id = v_tenant
     AND ae.tipo_processo = 'TERCEIRIZADO'
  RETURNING ae.* INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exame terceirizado % não encontrado ou sem permissão', _exame_id USING ERRCODE = '42501';
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.update_exame_terceirizado_tx(bigint, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_exame_terceirizado_tx(bigint, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_exame_terceirizado_tx(bigint, jsonb, text) TO service_role;