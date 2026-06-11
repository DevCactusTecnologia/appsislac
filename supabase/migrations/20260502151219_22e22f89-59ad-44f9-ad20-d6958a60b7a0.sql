-- ============================================================
-- C-3: Índices trigram para busca de atendimentos
-- (sem CONCURRENTLY pois migrations rodam em transação)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_atendimentos_nome_trgm
  ON public.atendimentos USING gin (lower(paciente_nome) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_atendimentos_protocolo_trgm
  ON public.atendimentos USING gin (lower(protocolo) gin_trgm_ops);

-- ============================================================
-- C-2 Dashboard: RPC unificada de KPIs
-- ============================================================
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
    COUNT(*) FILTER (WHERE a.data >= v_today_start AND a.data < v_today_end
                     AND (lower(a.status_atendimento) LIKE '%liber%' OR lower(a.status_atendimento) LIKE '%entreg%')),
    COUNT(*) FILTER (WHERE lower(a.status_atendimento) LIKE '%aguard%' AND lower(a.status_atendimento) LIKE '%colet%'),
    COUNT(*) FILTER (WHERE lower(a.status_atendimento) LIKE '%anális%' OR lower(a.status_atendimento) LIKE '%analise%' OR lower(a.status_atendimento) LIKE '%em an%'),
    COUNT(*) FILTER (WHERE lower(a.status_atendimento) LIKE '%aguard%' AND lower(a.status_atendimento) LIKE '%liber%'),
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
    SELECT
      COUNT(*),
      COUNT(*) FILTER (WHERE COALESCE(p.status,'Ativo') = 'Ativo')
    INTO v_pac_total, v_pac_ativos
    FROM public.pacientes p
    WHERE p.tenant_id = v_tenant;
  EXCEPTION WHEN OTHERS THEN
    v_pac_total := 0; v_pac_ativos := 0;
  END;

  WITH cpfs_30 AS (
    SELECT DISTINCT a.paciente_cpf AS cpf
      FROM public.atendimentos a
     WHERE a.tenant_id = v_tenant
       AND a.data >= v_30d_start
       AND a.paciente_cpf IS NOT NULL AND a.paciente_cpf <> ''
  ),
  cpfs_antes AS (
    SELECT DISTINCT a.paciente_cpf AS cpf
      FROM public.atendimentos a
     WHERE a.tenant_id = v_tenant
       AND a.data <  v_30d_start
       AND a.paciente_cpf IS NOT NULL AND a.paciente_cpf <> ''
  )
  SELECT
    (SELECT COUNT(*) FROM cpfs_30),
    (SELECT COUNT(*) FROM cpfs_30 c WHERE NOT EXISTS (SELECT 1 FROM cpfs_antes b WHERE b.cpf = c.cpf))
  INTO v_pac_atend30, v_pac_novos30;

  SELECT
    COALESCE(SUM(CASE WHEN a.data >= v_30d_start
                      THEN (SELECT COUNT(*) FROM public.atendimento_exames e WHERE e.atendimento_id = a.id) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN a.data >= v_30d_start AND lower(COALESCE(a.status_atendimento,'')) LIKE '%cancel%'
                      THEN (SELECT COUNT(*) FROM public.atendimento_exames e WHERE e.atendimento_id = a.id) ELSE 0 END), 0)
  INTO v_exames_30d, v_cancel_30d
  FROM public.atendimentos a
  WHERE a.tenant_id = v_tenant AND a.data >= v_30d_start;

  v_taxa_cancel := CASE WHEN v_exames_30d > 0 THEN (v_cancel_30d::numeric / v_exames_30d) * 100 ELSE 0 END;

  SELECT COALESCE(jsonb_agg(jsonb_build_array(nome, qtd) ORDER BY qtd DESC), '[]'::jsonb)
  INTO v_top_exames
  FROM (
    SELECT e.nome_exame AS nome, COUNT(*) AS qtd
      FROM public.atendimento_exames e
      JOIN public.atendimentos a ON a.id = e.atendimento_id
     WHERE a.tenant_id = v_tenant AND a.data >= v_30d_start
     GROUP BY e.nome_exame
     ORDER BY COUNT(*) DESC
     LIMIT 5
  ) t;

  SELECT a.convenio_nome
  INTO v_top_convenio
  FROM public.atendimentos a
  WHERE a.tenant_id = v_tenant AND a.data >= v_30d_start AND COALESCE(a.convenio_nome,'') <> ''
  GROUP BY a.convenio_nome
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  SELECT a.solicitante
  INTO v_top_solicit
  FROM public.atendimentos a
  WHERE a.tenant_id = v_tenant AND a.data >= v_30d_start AND COALESCE(a.solicitante,'') <> ''
  GROUP BY a.solicitante
  ORDER BY COUNT(*) DESC
  LIMIT 1;

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
      'exames30d',         v_exames_30d,
      'taxaCancelamento',  v_taxa_cancel,
      'topSolicitante',    v_top_solicit
    ),
    'topExames', v_top_exames
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.dashboard_kpis() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dashboard_kpis() FROM anon;
GRANT EXECUTE ON FUNCTION public.dashboard_kpis() TO authenticated;