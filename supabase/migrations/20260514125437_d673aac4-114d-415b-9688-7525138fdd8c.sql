CREATE OR REPLACE FUNCTION public.dashboard_kpis()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant uuid := public.current_tenant_id();
  v_today_start timestamptz := date_trunc('day', now());
  v_today_end   timestamptz := v_today_start + interval '1 day';
  v_month_start timestamptz := date_trunc('month', now());
  v_month_end   timestamptz := v_month_start + interval '1 month';
  v_30d_start   timestamptz := now() - interval '30 days';

  v_atend_hoje   bigint := 0;
  v_liberados_hoje bigint := 0;
  v_coletas_pend bigint := 0;
  v_em_analise   bigint := 0;
  v_a_liberar    bigint := 0;
  v_cancelados   bigint := 0;

  v_receita_hoje numeric := 0;
  v_receita_mes  numeric := 0;
  v_a_receber    numeric := 0;
  v_saidas_mes   numeric := 0;
  v_ticket_medio numeric := 0;
  v_total_valor  numeric := 0;
  v_count_valor  bigint := 0;

  v_pac_total    bigint := 0;
  v_pac_ativos   bigint := 0;
  v_pac_atend30  bigint := 0;
  v_pac_novos30  bigint := 0;

  v_exames_30d   bigint := 0;
  v_cancel_30d   bigint := 0;
  v_taxa_cancel  numeric := 0;

  v_top_exames   jsonb := '[]'::jsonb;
  v_top_convenio text := NULL;
  v_top_solicit  text := NULL;
BEGIN
  IF v_tenant IS NULL THEN
    RETURN jsonb_build_object(
      'operacional', jsonb_build_object(
        'atendimentosHoje',0,'liberadosHoje',0,'coletasPendentes',0,
        'analisesAndamento',0,'resultadosLiberar',0,'cancelados',0
      ),
      'financeiro', jsonb_build_object(
        'receitaHoje',0,'receitaMes',0,'aReceber',0,'saidasMes',0,
        'saldoMes',0,'ticketMedio',0
      ),
      'pacientes', jsonb_build_object(
        'total',0,'ativos',0,'atendidos30d',0,'novos30d',0,'topConvenio',NULL
      ),
      'produtividade', jsonb_build_object(
        'exames30d',0,'taxaCancelamento',0,'topSolicitante',NULL
      ),
      'topExames', '[]'::jsonb
    );
  END IF;

  -- Pipeline real:
  --   Aguardando Coleta → Amostra Coletada → Em Análise → Amostra Analisada → Resultado Salvo → Resultado Liberado
  --   coletasPendentes = "Aguardando Coleta"
  --   analisesAndamento = "Amostra Coletada" + "Em Análise"
  --   resultadosLiberar = "Amostra Analisada" + "Resultado Salvo" (+ "Aguardando Liberação", legado)
  --   liberadosHoje = atendimentos do dia com "Resultado Liberado" / "Entregue"
  SELECT
    COUNT(*) FILTER (WHERE a.data >= v_today_start AND a.data < v_today_end),
    COUNT(*) FILTER (WHERE a.data >= v_today_start AND a.data < v_today_end
                     AND (lower(a.status_atendimento) LIKE '%liberado%' OR lower(a.status_atendimento) LIKE '%entreg%')),
    COUNT(*) FILTER (WHERE lower(a.status_atendimento) LIKE '%aguard%' AND lower(a.status_atendimento) LIKE '%colet%'),
    COUNT(*) FILTER (WHERE lower(a.status_atendimento) = 'amostra coletada'
                     OR lower(a.status_atendimento) LIKE '%em análise%'
                     OR lower(a.status_atendimento) LIKE '%em analise%'),
    COUNT(*) FILTER (WHERE lower(a.status_atendimento) = 'amostra analisada'
                     OR lower(a.status_atendimento) LIKE '%resultado salvo%'
                     OR (lower(a.status_atendimento) LIKE '%aguard%' AND lower(a.status_atendimento) LIKE '%liber%')),
    COUNT(*) FILTER (WHERE lower(a.status_atendimento) LIKE '%cancel%')
  INTO v_atend_hoje, v_liberados_hoje, v_coletas_pend, v_em_analise, v_a_liberar, v_cancelados
  FROM public.atendimentos a
  WHERE a.tenant_id = v_tenant;

  SELECT
    COALESCE(SUM(p.valor) FILTER (WHERE p.data >= v_today_start AND p.data < v_today_end), 0),
    COALESCE(SUM(p.valor) FILTER (WHERE p.data >= v_month_start AND p.data < v_month_end), 0)
  INTO v_receita_hoje, v_receita_mes
  FROM public.atendimento_pagamentos p
  WHERE p.tenant_id = v_tenant;

  WITH totais AS (
    SELECT
      a.id,
      lower(COALESCE(a.status_pagamento,'')) AS sp,
      COALESCE((SELECT SUM(e.valor) FROM public.atendimento_exames e
                 WHERE e.atendimento_id = a.id AND lower(COALESCE(e.status,'')) <> 'cancelado'), 0) AS total_atd,
      COALESCE((SELECT SUM(p.valor) FROM public.atendimento_pagamentos p
                 WHERE p.atendimento_id = a.id), 0) AS pago
    FROM public.atendimentos a
    WHERE a.tenant_id = v_tenant
  )
  SELECT
    COALESCE(SUM(GREATEST(total_atd - pago, 0)) FILTER (WHERE sp NOT LIKE '%cancel%'), 0),
    COALESCE(SUM(total_atd) FILTER (WHERE total_atd > 0), 0),
    COUNT(*) FILTER (WHERE total_atd > 0)
  INTO v_a_receber, v_total_valor, v_count_valor
  FROM totais;

  v_ticket_medio := CASE WHEN v_count_valor > 0 THEN v_total_valor / v_count_valor ELSE 0 END;

  BEGIN
    SELECT COALESCE(SUM(s.valor_total), 0)
    INTO v_saidas_mes
    FROM public.financeiro_saidas s
    WHERE s.tenant_id = v_tenant
      AND COALESCE(s.data_pagamento, s.data_vencimento) >= v_month_start
      AND COALESCE(s.data_pagamento, s.data_vencimento) <  v_month_end;
  EXCEPTION WHEN OTHERS THEN
    v_saidas_mes := 0;
  END;

  BEGIN
    SELECT COUNT(*), COUNT(*) FILTER (WHERE COALESCE(p.status,'Ativo') = 'Ativo')
    INTO v_pac_total, v_pac_ativos
    FROM public.pacientes p
    WHERE p.tenant_id = v_tenant;
  EXCEPTION WHEN OTHERS THEN
    v_pac_total := 0; v_pac_ativos := 0;
  END;

  WITH atd30 AS (
    SELECT DISTINCT a.cpf
    FROM public.atendimentos a
    WHERE a.tenant_id = v_tenant AND a.data >= v_30d_start AND a.cpf IS NOT NULL
  ),
  antes AS (
    SELECT DISTINCT a.cpf
    FROM public.atendimentos a
    WHERE a.tenant_id = v_tenant AND a.data < v_30d_start AND a.cpf IS NOT NULL
  )
  SELECT
    (SELECT COUNT(*) FROM atd30),
    (SELECT COUNT(*) FROM atd30 WHERE cpf NOT IN (SELECT cpf FROM antes))
  INTO v_pac_atend30, v_pac_novos30;

  SELECT
    COALESCE(SUM(jsonb_array_length(COALESCE(a.exames,'[]'::jsonb))), 0),
    COALESCE(SUM(jsonb_array_length(COALESCE(a.exames,'[]'::jsonb))) FILTER (WHERE lower(a.status_atendimento) LIKE '%cancel%'), 0)
  INTO v_exames_30d, v_cancel_30d
  FROM public.atendimentos a
  WHERE a.tenant_id = v_tenant AND a.data >= v_30d_start;

  v_taxa_cancel := CASE WHEN v_exames_30d > 0 THEN (v_cancel_30d::numeric / v_exames_30d::numeric) * 100 ELSE 0 END;

  WITH ex AS (
    SELECT lower(trim(value::text, '"')) AS nome
    FROM public.atendimentos a, jsonb_array_elements(COALESCE(a.exames,'[]'::jsonb)) AS value
    WHERE a.tenant_id = v_tenant AND a.data >= v_30d_start
  ), ag AS (
    SELECT nome, COUNT(*) AS qtd FROM ex WHERE nome IS NOT NULL AND nome <> '' GROUP BY nome ORDER BY qtd DESC LIMIT 5
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_array(nome, qtd)), '[]'::jsonb) INTO v_top_exames FROM ag;

  SELECT a.convenio INTO v_top_convenio
  FROM public.atendimentos a
  WHERE a.tenant_id = v_tenant AND a.data >= v_30d_start AND a.convenio IS NOT NULL AND a.convenio <> ''
  GROUP BY a.convenio ORDER BY COUNT(*) DESC LIMIT 1;

  SELECT a.solicitante INTO v_top_solicit
  FROM public.atendimentos a
  WHERE a.tenant_id = v_tenant AND a.data >= v_30d_start AND a.solicitante IS NOT NULL AND a.solicitante <> ''
  GROUP BY a.solicitante ORDER BY COUNT(*) DESC LIMIT 1;

  RETURN jsonb_build_object(
    'operacional', jsonb_build_object(
      'atendimentosHoje', v_atend_hoje,
      'liberadosHoje',    v_liberados_hoje,
      'coletasPendentes', v_coletas_pend,
      'analisesAndamento',v_em_analise,
      'resultadosLiberar',v_a_liberar,
      'cancelados',       v_cancelados
    ),
    'financeiro', jsonb_build_object(
      'receitaHoje',  v_receita_hoje,
      'receitaMes',   v_receita_mes,
      'aReceber',     v_a_receber,
      'saidasMes',    v_saidas_mes,
      'saldoMes',     v_receita_mes - v_saidas_mes,
      'ticketMedio',  v_ticket_medio
    ),
    'pacientes', jsonb_build_object(
      'total',        v_pac_total,
      'ativos',       v_pac_ativos,
      'atendidos30d', v_pac_atend30,
      'novos30d',     v_pac_novos30,
      'topConvenio',  v_top_convenio
    ),
    'produtividade', jsonb_build_object(
      'exames30d',        v_exames_30d,
      'taxaCancelamento', v_taxa_cancel,
      'topSolicitante',   v_top_solicit
    ),
    'topExames', v_top_exames
  );
END;
$function$;