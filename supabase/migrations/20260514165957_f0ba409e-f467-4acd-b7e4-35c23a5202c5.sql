
-- 1) Colunas para rastrear retificação por exame
ALTER TABLE public.atendimento_exames
  ADD COLUMN IF NOT EXISTS retificado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS retificado_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_atendimento_exames_retificado
  ON public.atendimento_exames (atendimento_id) WHERE retificado = true;

-- 2) update_atendimento_exame_tx: validar justificativa em retificação + persistir flag
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
  v_old public.atendimento_exames;
  v_new_status text;
  v_is_retify boolean := false;
  v_just text := COALESCE(_justificativa, '');
BEGIN
  IF _exame_id IS NULL THEN
    RAISE EXCEPTION 'exame_id obrigatório' USING ERRCODE = '22023';
  END IF;

  IF _patch IS NULL OR jsonb_typeof(_patch) <> 'object' THEN
    RAISE EXCEPTION 'patch inválido' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_old FROM public.atendimento_exames WHERE id = _exame_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'exame não encontrado' USING ERRCODE = '42704';
  END IF;

  v_new_status := CASE WHEN _patch ? 'status' THEN _patch->>'status' ELSE v_old.status END;

  -- Detecta retificação: laudo já liberado voltando para edição.
  IF v_old.status = 'finalizado'
     AND v_new_status IN ('em_analise', 'em_bancada', 'analisado', 'pendente') THEN
    v_is_retify := true;
  END IF;

  -- Justificativa obrigatória em retificação (mín. 5 chars úteis).
  IF v_is_retify AND length(btrim(v_just)) < 5 THEN
    RAISE EXCEPTION 'Justificativa obrigatória (mín. 5 caracteres) para retificar exame liberado'
      USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('app.audit_justificativa', v_just, true);

  UPDATE public.atendimento_exames
  SET
    status = v_new_status,
    resultados = CASE WHEN _patch ? 'resultados' THEN COALESCE(_patch->'resultados', '{}'::jsonb) ELSE resultados END,
    motivo_cancelamento = CASE WHEN _patch ? 'motivo_cancelamento' THEN _patch->>'motivo_cancelamento' ELSE motivo_cancelamento END,
    data_coleta = CASE WHEN _patch ? 'data_coleta' THEN NULLIF(_patch->>'data_coleta', '')::timestamptz ELSE data_coleta END,
    data_analise = CASE WHEN _patch ? 'data_analise' THEN NULLIF(_patch->>'data_analise', '')::timestamptz ELSE data_analise END,
    data_liberacao = CASE WHEN _patch ? 'data_liberacao' THEN NULLIF(_patch->>'data_liberacao', '')::timestamptz ELSE data_liberacao END,
    analista = CASE WHEN _patch ? 'analista' THEN COALESCE(_patch->>'analista', '') ELSE analista END,
    -- Marca a flag automaticamente quando for o gatilho de retificação,
    -- ou aceita override explícito vindo do patch.
    retificado = CASE
      WHEN v_is_retify THEN true
      WHEN _patch ? 'retificado' THEN (_patch->>'retificado')::boolean
      ELSE retificado
    END,
    retificado_at = CASE
      WHEN v_is_retify THEN now()
      WHEN _patch ? 'retificado' AND (_patch->>'retificado')::boolean THEN COALESCE(retificado_at, now())
      ELSE retificado_at
    END
  WHERE id = _exame_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.update_atendimento_exame_tx(bigint, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_atendimento_exame_tx(bigint, jsonb, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_atendimento_exame_tx(bigint, jsonb, text) TO authenticated;

-- 3) recompute_atendimento_status com novos estados de retificação
CREATE OR REPLACE FUNCTION public.recompute_atendimento_status(_atendimento_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  total_exames INT;
  total_cancelados INT;
  total_finalizados INT;
  total_em_analise INT;
  total_analisado INT;
  total_em_bancada INT;
  total_coletados INT;
  total_retificados_ativos INT;
  total_retificados_em_curso INT;
  ativos INT;
  novo_status_at TEXT;
  total_valor_paciente NUMERIC(12,2);
  total_pago NUMERIC(12,2);
  novo_status_pg TEXT;
BEGIN
  SELECT
    count(*),
    count(*) FILTER (WHERE status = 'cancelado'),
    count(*) FILTER (WHERE status = 'finalizado'),
    count(*) FILTER (WHERE status = 'em_analise'),
    count(*) FILTER (WHERE status = 'analisado'),
    count(*) FILTER (WHERE status = 'em_bancada'),
    count(*) FILTER (WHERE status = 'coletado'),
    count(*) FILTER (WHERE retificado = true AND status <> 'cancelado'),
    count(*) FILTER (WHERE retificado = true AND status IN ('em_analise','em_bancada','analisado','pendente'))
  INTO total_exames, total_cancelados, total_finalizados, total_em_analise,
       total_analisado, total_em_bancada, total_coletados,
       total_retificados_ativos, total_retificados_em_curso
  FROM public.atendimento_exames
  WHERE atendimento_id = _atendimento_id;

  ativos := total_exames - total_cancelados;

  IF total_exames = 0 THEN
    novo_status_at := 'Pedido Realizado';
  ELSIF total_cancelados = total_exames THEN
    novo_status_at := 'Cancelado';
  ELSIF total_retificados_em_curso > 0 THEN
    novo_status_at := 'Em Retificação';
  ELSIF total_finalizados = ativos AND total_retificados_ativos > 0 THEN
    novo_status_at := 'Retificado';
  ELSIF total_finalizados = ativos THEN
    novo_status_at := 'Resultado Liberado';
  ELSIF (total_finalizados + total_em_analise) = ativos AND total_em_analise > 0 THEN
    novo_status_at := 'Resultado Salvo';
  ELSIF (total_finalizados + total_em_analise + total_analisado) = ativos AND total_analisado > 0 THEN
    novo_status_at := 'Amostra Analisada';
  ELSIF total_em_bancada > 0 THEN
    novo_status_at := 'Em Análise';
  ELSIF total_coletados > 0 THEN
    novo_status_at := 'Amostra Coletada';
  ELSE
    novo_status_at := 'Pedido Realizado';
  END IF;

  SELECT COALESCE(SUM(valor), 0) INTO total_valor_paciente
  FROM public.atendimento_exames
  WHERE atendimento_id = _atendimento_id
    AND status <> 'cancelado'
    AND cobranca_destino = 'paciente';

  SELECT COALESCE(SUM(valor), 0) INTO total_pago
  FROM public.atendimento_pagamentos
  WHERE atendimento_id = _atendimento_id;

  IF total_cancelados = total_exames AND total_exames > 0 THEN
    novo_status_pg := 'Pagamento cancelado';
  ELSIF ativos = 0 THEN
    novo_status_pg := 'Pagamento efetuado';
  ELSIF total_valor_paciente = 0 THEN
    novo_status_pg := 'Pagamento efetuado';
  ELSIF total_pago > 0 AND total_pago >= total_valor_paciente THEN
    novo_status_pg := 'Pagamento efetuado';
  ELSIF total_pago > 0 AND total_pago < total_valor_paciente THEN
    novo_status_pg := 'Pagamento parcial';
  ELSE
    novo_status_pg := 'Pagamento pendente';
  END IF;

  UPDATE public.atendimentos
  SET status_atendimento = novo_status_at,
      status_pagamento = novo_status_pg
  WHERE id = _atendimento_id;
END;
$function$;
