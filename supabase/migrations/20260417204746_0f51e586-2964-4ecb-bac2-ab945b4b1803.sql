-- Corrige regra de status_pagamento: "Pago" só quando 100% quitado.
-- Se total_valor = 0 e existem exames ativos sem pagamento, considerar Pendente
-- (cenário de preço zerado/não cadastrado — não deve ser tratado como quitado).

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
  total_coletados INT;
  ativos INT;
  novo_status_at TEXT;
  total_valor NUMERIC(10,2);
  total_pago NUMERIC(10,2);
  novo_status_pg TEXT;
BEGIN
  SELECT
    count(*),
    count(*) FILTER (WHERE status = 'cancelado'),
    count(*) FILTER (WHERE status = 'finalizado'),
    count(*) FILTER (WHERE status = 'em_analise'),
    count(*) FILTER (WHERE status = 'coletado')
  INTO total_exames, total_cancelados, total_finalizados, total_em_analise, total_coletados
  FROM public.atendimento_exames
  WHERE atendimento_id = _atendimento_id;

  ativos := total_exames - total_cancelados;

  IF total_exames = 0 THEN
    novo_status_at := 'Pedido Realizado';
  ELSIF total_cancelados = total_exames THEN
    novo_status_at := 'Cancelado';
  ELSIF total_finalizados = ativos THEN
    novo_status_at := 'Resultado Liberado';
  ELSIF (total_finalizados + total_em_analise) = ativos AND total_em_analise > 0 THEN
    novo_status_at := 'Amostra Analisada';
  ELSIF (total_finalizados + total_em_analise + total_coletados) > 0 THEN
    novo_status_at := 'Amostra Coletada';
  ELSE
    novo_status_at := 'Pedido Realizado';
  END IF;

  SELECT COALESCE(SUM(valor), 0) INTO total_valor
  FROM public.atendimento_exames
  WHERE atendimento_id = _atendimento_id AND status <> 'cancelado';

  SELECT COALESCE(SUM(valor), 0) INTO total_pago
  FROM public.atendimento_pagamentos
  WHERE atendimento_id = _atendimento_id;

  IF total_cancelados = total_exames AND total_exames > 0 THEN
    novo_status_pg := 'Pagamento cancelado';
  ELSIF ativos = 0 THEN
    -- Sem exames ativos (e não totalmente cancelados): nada a cobrar
    novo_status_pg := 'Pagamento efetuado';
  ELSIF total_pago > 0 AND total_pago >= total_valor AND total_valor > 0 THEN
    novo_status_pg := 'Pagamento efetuado';
  ELSIF total_pago > 0 AND total_pago < total_valor THEN
    novo_status_pg := 'Pagamento parcial';
  ELSE
    -- Inclui: total_valor = 0 sem pagamentos (preço não definido) e total_pago = 0
    novo_status_pg := 'Pagamento pendente';
  END IF;

  UPDATE public.atendimentos
  SET status_atendimento = novo_status_at,
      status_pagamento = novo_status_pg
  WHERE id = _atendimento_id;
END;
$function$;

-- Recalcula todos os atendimentos existentes para corrigir dados antigos
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.atendimentos LOOP
    PERFORM public.recompute_atendimento_status(r.id);
  END LOOP;
END $$;