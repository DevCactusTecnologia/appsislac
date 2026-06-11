-- 1) Atualiza CHECK constraint para aceitar novos estados
ALTER TABLE public.atendimento_exames DROP CONSTRAINT IF EXISTS atendimento_exames_status_check;
ALTER TABLE public.atendimento_exames ADD CONSTRAINT atendimento_exames_status_check
  CHECK (status = ANY (ARRAY['pendente'::text, 'coletado'::text, 'em_bancada'::text, 'analisado'::text, 'em_analise'::text, 'finalizado'::text, 'cancelado'::text]));

-- 2) Backfill: exames atualmente em em_analise SEM valores digitados (resultados IS NULL ou vazio)
--    devem ser reclassificados como em_bancada (analista iniciou bancada mas não digitou).
UPDATE public.atendimento_exames
SET status = 'em_bancada'
WHERE status = 'em_analise'
  AND (resultados IS NULL OR resultados::text IN ('{}', '[]', 'null'));

-- 3) Atualiza a função recompute_atendimento_status com a nova hierarquia de estados
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
  total_em_analise INT;       -- valores digitados/salvos
  total_analisado INT;        -- bancada concluída
  total_em_bancada INT;       -- bancada em andamento
  total_coletados INT;
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
    count(*) FILTER (WHERE status = 'coletado')
  INTO total_exames, total_cancelados, total_finalizados, total_em_analise,
       total_analisado, total_em_bancada, total_coletados
  FROM public.atendimento_exames
  WHERE atendimento_id = _atendimento_id;

  ativos := total_exames - total_cancelados;

  IF total_exames = 0 THEN
    novo_status_at := 'Pedido Realizado';
  ELSIF total_cancelados = total_exames THEN
    novo_status_at := 'Cancelado';
  ELSIF total_finalizados = ativos THEN
    -- Todos os exames ativos liberados/assinados
    novo_status_at := 'Resultado Liberado';
  ELSIF (total_finalizados + total_em_analise) = ativos AND total_em_analise > 0 THEN
    -- Há valores digitados e salvos pendentes de liberação
    novo_status_at := 'Resultado Salvo';
  ELSIF (total_finalizados + total_em_analise + total_analisado) = ativos AND total_analisado > 0 THEN
    -- Bancada concluída, aguardando digitação
    novo_status_at := 'Amostra Analisada';
  ELSIF total_em_bancada > 0 THEN
    -- Algum exame ainda na bancada
    novo_status_at := 'Em Análise';
  ELSIF total_coletados > 0 THEN
    novo_status_at := 'Amostra Coletada';
  ELSE
    novo_status_at := 'Pedido Realizado';
  END IF;

  -- Apenas exames cobrados do PACIENTE entram no status de pagamento
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

-- 4) Recalcula status de todos os atendimentos que foram afetados pelo backfill
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT atendimento_id FROM public.atendimento_exames WHERE status IN ('em_bancada', 'analisado', 'em_analise')
  LOOP
    PERFORM public.recompute_atendimento_status(r.atendimento_id);
  END LOOP;
END $$;