CREATE OR REPLACE FUNCTION public.update_atendimento_exame_tx(
  _exame_id bigint,
  _patch jsonb,
  _justificativa text DEFAULT ''
)
RETURNS public.atendimento_exames
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.atendimento_exames;
BEGIN
  IF _exame_id IS NULL THEN
    RAISE EXCEPTION 'exame_id obrigatório' USING ERRCODE = '22023';
  END IF;

  IF _patch IS NULL OR jsonb_typeof(_patch) <> 'object' THEN
    RAISE EXCEPTION 'patch inválido' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('app.audit_justificativa', COALESCE(_justificativa, ''), true);

  UPDATE public.atendimento_exames
  SET
    status = CASE WHEN _patch ? 'status' THEN _patch->>'status' ELSE status END,
    resultados = CASE WHEN _patch ? 'resultados' THEN COALESCE(_patch->'resultados', '{}'::jsonb) ELSE resultados END,
    motivo_cancelamento = CASE WHEN _patch ? 'motivo_cancelamento' THEN _patch->>'motivo_cancelamento' ELSE motivo_cancelamento END,
    data_coleta = CASE WHEN _patch ? 'data_coleta' THEN NULLIF(_patch->>'data_coleta', '')::timestamptz ELSE data_coleta END,
    data_analise = CASE WHEN _patch ? 'data_analise' THEN NULLIF(_patch->>'data_analise', '')::timestamptz ELSE data_analise END,
    data_liberacao = CASE WHEN _patch ? 'data_liberacao' THEN NULLIF(_patch->>'data_liberacao', '')::timestamptz ELSE data_liberacao END,
    analista = CASE WHEN _patch ? 'analista' THEN COALESCE(_patch->>'analista', '') ELSE analista END
  WHERE id = _exame_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'exame não encontrado' USING ERRCODE = '42704';
  END IF;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_atendimento_exame_tx(bigint, jsonb, text) TO authenticated;