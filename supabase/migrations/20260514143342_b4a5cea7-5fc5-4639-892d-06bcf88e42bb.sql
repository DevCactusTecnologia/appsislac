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

  SELECT
    COUNT(*) FILTER (WHERE a.data >= v_today_start AND a.data < v_today_end),
    COUNT(*) FILTER (WHERE lower(a.status_atendimento) LIKE '%aguard%' AND lower(a.status_atendimento) LIKE '%colet%'),
    COUNT(*) FILTER (WHERE lower(a.status_atendimento) = 'amostra coletada'
                     OR lower(a.status_atendimento) LIKE '%em análise%'
                     OR lower(a.status_atendimento) LIKE '%em analise%'),
    COUNT(*) FILTER (WHERE lower(a.status_atendimento) LIKE '%aguard%' AND lower(a.status_atendimento) LIKE '%liber%'),
    COUNT(*) FILTER (WHERE lower(a.status_atendimento) LIKE '%cancel%' AND a.data >= v_month_start AND a.data < v_month_end)
  INTO v_atend_hoje, v_coletas_pend, v_em_analise, v_a_liberar, v_cancelados
  FROM public.atendimentos a
  WHERE a.tenant_id = v_tenant;

  -- Liberados hoje: contar atendimentos cujos exames foram liberados hoje
  SELECT COUNT(DISTINCT e.atendimento_id)
  INTO v_liberados_hoje
  FROM public.atendimento_exames e
  JOIN public.atendimentos a ON a.id = e.atendimento_id
  WHERE a.tenant_id = v_tenant
    AND e.data_liberacao IS NOT NULL
    AND e.data_liberacao >= v_today_start
    AND e.data_liberacao <  v_today_end;

  SELECT
    COALESCE(SUM(p.valor) FILTER (WHERE p.created_at >= v_today_start AND p.created_at < v_today_end), 0),
    COALESCE(SUM(p.valor) FILTER (WHERE p.created_at >= v_month_start AND p.created_at < v_month_end), 0)
  INTO v_receita_hoje, v_receita_mes
  FROM public.pagamentos p
  WHERE p.tenant_id = v_tenant;

  SELECT COALESCE(SUM(GREATEST(a.valor_total - COALESCE(a.valor_pago,0), 0)), 0)
  INTO v_a_receber
  FROM (
    SELECT
      at.id,
      COALESCE((SELECT SUM(ex.valor) FROM public.atendimento_exames ex WHERE ex.atendimento_id = at.id AND lower(ex.status) <> 'cancelado'), 0) AS valor_total,
      COALESCE((SELECT SUM(pg.valor) FROM public.pagamentos pg WHERE pg.atendimento_id = at.id), 0) AS valor_pago
    FROM public.atendimentos at
    WHERE at.tenant_id = v_tenant
      AND lower(at.status_atendimento) NOT LIKE '%cancel%'
  ) a;

  SELECT COALESCE(SUM(s.valor), 0)
  INTO v_saidas_mes
  FROM public.saidas s
  WHERE s.tenant_id = v_tenant
    AND s.data >= v_month_start AND s.data < v_month_end;

  SELECT COUNT(*), COALESCE(SUM(ex.valor),0)
  INTO v_count_valor, v_total_valor
  FROM public.atendimento_exames ex
  JOIN public.atendimentos at ON at.id = ex.atendimento_id
  WHERE at.tenant_id = v_tenant
    AND at.data >= v_30d_start
    AND lower(ex.status) <> 'cancelado';

  IF v_count_valor > 0 THEN
    v_ticket_medio := v_total_valor / v_count_valor;
  END IF;

  SELECT COUNT(*) INTO v_pac_total
  FROM public.pacientes pa WHERE pa.tenant_id = v_tenant;

  SELECT COUNT(DISTINCT a.paciente_cpf) INTO v_pac_ativos
  FROM public.atendimentos a
  WHERE a.tenant_id = v_tenant AND a.data >= v_30d_start AND a.paciente_cpf IS NOT NULL;

  WITH atd30 AS (
    SELECT DISTINCT a.paciente_cpf AS cpf
    FROM public.atendimentos a
    WHERE a.tenant_id = v_tenant AND a.data >= v_30d_start AND a.paciente_cpf IS NOT NULL
  ),
  antes AS (
    SELECT DISTINCT a.paciente_cpf AS cpf
    FROM public.atendimentos a
    WHERE a.tenant_id = v_tenant AND a.data < v_30d_start AND a.paciente_cpf IS NOT NULL
  )
  SELECT
    (SELECT COUNT(*) FROM atd30),
    (SELECT COUNT(*) FROM atd30 WHERE cpf NOT IN (SELECT cpf FROM antes))
  INTO v_pac_atend30, v_pac_novos30;

  SELECT COUNT(*) INTO v_exames_30d
  FROM public.atendimento_exames ex
  JOIN public.atendimentos at ON at.id = ex.atendimento_id
  WHERE at.tenant_id = v_tenant AND at.data >= v_30d_start;

  SELECT COUNT(*) INTO v_cancel_30d
  FROM public.atendimentos a
  WHERE a.tenant_id = v_tenant AND a.data >= v_30d_start
    AND lower(a.status_atendimento) LIKE '%cancel%';

  IF v_exames_30d > 0 THEN
    v_taxa_cancel := (v_cancel_30d::numeric / v_exames_30d::numeric) * 100;
  END IF;

  SELECT jsonb_agg(t) INTO v_top_exames
  FROM (
    SELECT ex.nome_exame AS nome, COUNT(*) AS total
    FROM public.atendimento_exames ex
    JOIN public.atendimentos at ON at.id = ex.atendimento_id
    WHERE at.tenant_id = v_tenant AND at.data >= v_30d_start
    GROUP BY ex.nome_exame
    ORDER BY total DESC
    LIMIT 5
  ) t;

  SELECT a.convenio_nome INTO v_top_convenio
  FROM public.atendimentos a
  WHERE a.tenant_id = v_tenant AND a.data >= v_30d_start
  GROUP BY a.convenio_nome
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  SELECT a.solicitante INTO v_top_solicit
  FROM public.atendimentos a
  WHERE a.tenant_id = v_tenant AND a.data >= v_30d_start AND COALESCE(a.solicitante,'') <> ''
  GROUP BY a.solicitante
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'operacional', jsonb_build_object(
      'atendimentosHoje',  v_atend_hoje,
      'liberadosHoje',    v_liberados_hoje,
      'coletasPendentes', v_coletas_pend,
      'analisesAndamento',v_em_analise,
      'resultadosLiberar',v_a_liberar,
      'cancelados',       v_cancelados
    ),
    'financeiro', jsonb_build_object(
      'receitaHoje', v_receita_hoje,
      'receitaMes',  v_receita_mes,
      'aReceber',    v_a_receber,
      'saidasMes',   v_saidas_mes,
      'saldoMes',    v_receita_mes - v_saidas_mes,
      'ticketMedio', v_ticket_medio
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
    'topExames', COALESCE(v_top_exames, '[]'::jsonb)
  );
END;
$function$;