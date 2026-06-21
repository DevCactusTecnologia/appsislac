-- ============================================================
-- Financeiro 2.0 — Fase 7
-- SSOT definitivo do "A Receber"
-- ============================================================

-- 1) RPC oficial de TOTAIS do A Receber.
--    Espelha 1:1 a lógica da `financeiro_a_receber_v2`, mas
--    retorna apenas agregados (sem paginação, sem detalhe).
--    É consumida por Dashboard, Recepção, Painel Financeiro
--    e por qualquer relatório que precise de UM número total.
CREATE OR REPLACE FUNCTION public.financeiro_a_receber_totais()
RETURNS TABLE(
  total_pacientes  numeric,
  qtd_pacientes    bigint,
  total_convenios  numeric,
  qtd_convenios    bigint,
  total_geral      numeric
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  WITH base AS (
    SELECT
      a.id,
      COALESCE(SUM(CASE WHEN e.cobranca_destino = 'paciente' THEN e.valor ELSE 0 END), 0) AS valor_total
    FROM public.atendimentos a
    LEFT JOIN public.atendimento_exames e ON e.atendimento_id = a.id
    WHERE a.tenant_id = current_tenant_id()
      AND a.status_atendimento <> 'Cancelado'
    GROUP BY a.id
  ),
  pagos AS (
    SELECT atendimento_id, COALESCE(SUM(valor), 0) AS valor_pago
    FROM public.atendimento_pagamentos
    WHERE tenant_id = current_tenant_id()
    GROUP BY atendimento_id
  ),
  pacientes AS (
    SELECT
      ROUND((b.valor_total - COALESCE(p.valor_pago, 0))::numeric, 2) AS saldo
    FROM base b
    LEFT JOIN pagos p ON p.atendimento_id = b.id
    WHERE ROUND((b.valor_total - COALESCE(p.valor_pago, 0))::numeric, 2) > 0.009
  ),
  conv_exames AS (
    SELECT
      e.convenio_cobranca_id AS convenio_id,
      e.valor
    FROM public.atendimento_exames e
    JOIN public.atendimentos a ON a.id = e.atendimento_id
    WHERE e.tenant_id = current_tenant_id()
      AND e.cobranca_destino = 'convenio'
      AND e.status <> 'cancelado'
      AND e.convenio_cobranca_id IS NOT NULL
      AND a.status_atendimento <> 'Cancelado'
      AND NOT EXISTS (
        SELECT 1 FROM public.convenio_fatura_itens fi
        WHERE fi.atendimento_exame_id = e.id
      )
  ),
  conv_agg AS (
    SELECT
      ce.convenio_id,
      ROUND(COALESCE(SUM(ce.valor), 0)::numeric, 2) AS saldo
    FROM conv_exames ce
    JOIN public.convenios c
      ON c.id = ce.convenio_id
     AND c.tenant_id = current_tenant_id()
     AND c.id <> 0
    GROUP BY ce.convenio_id
    HAVING ROUND(COALESCE(SUM(ce.valor), 0)::numeric, 2) > 0.009
  ),
  pac_tot AS (
    SELECT
      COALESCE(SUM(saldo), 0) AS total,
      COUNT(*)::bigint        AS qtd
    FROM pacientes
  ),
  conv_tot AS (
    SELECT
      COALESCE(SUM(saldo), 0) AS total,
      COUNT(*)::bigint        AS qtd
    FROM conv_agg
  )
  SELECT
    ROUND(pac_tot.total, 2)                    AS total_pacientes,
    pac_tot.qtd                                AS qtd_pacientes,
    ROUND(conv_tot.total, 2)                   AS total_convenios,
    conv_tot.qtd                               AS qtd_convenios,
    ROUND((pac_tot.total + conv_tot.total), 2) AS total_geral
  FROM pac_tot, conv_tot;
$$;

GRANT EXECUTE ON FUNCTION public.financeiro_a_receber_totais() TO authenticated;
GRANT EXECUTE ON FUNCTION public.financeiro_a_receber_totais() TO service_role;

-- 2) Conserta `dashboard_kpis` para usar tabelas oficiais e a regra SSOT
--    de A Receber (pacientes + convênios não faturados).
CREATE OR REPLACE FUNCTION public.dashboard_kpis()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_tenant uuid := public.current_tenant_id();
  v_today_start timestamptz := date_trunc('day', now());
  v_today_end   timestamptz := v_today_start + interval '1 day';
  v_month_start timestamptz := date_trunc('month', now());
  v_month_end   timestamptz := v_month_start + interval '1 month';
  v_30d_start   timestamptz := now() - interval '30 days';

  v_atend_hoje      bigint  := 0;
  v_liberados_hoje  bigint  := 0;
  v_coletas_pend    bigint  := 0;
  v_em_analise      bigint  := 0;
  v_a_liberar       bigint  := 0;
  v_cancelados      bigint  := 0;

  v_receita_hoje    numeric := 0;
  v_receita_mes     numeric := 0;
  v_a_receber       numeric := 0;
  v_saidas_mes      numeric := 0;
  v_ticket_medio    numeric := 0;
  v_total_valor     numeric := 0;
  v_count_valor     bigint  := 0;

  v_pac_total       bigint  := 0;
  v_pac_ativos      bigint  := 0;
  v_pac_atend30     bigint  := 0;
  v_pac_novos30     bigint  := 0;

  v_exames_30d      bigint  := 0;
  v_cancel_30d      bigint  := 0;
  v_taxa_cancel     numeric := 0;

  v_top_exames      jsonb   := '[]'::jsonb;
  v_top_convenio    text    := NULL;
  v_top_solicit     text    := NULL;
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

  SELECT COUNT(DISTINCT e.atendimento_id)
  INTO v_liberados_hoje
  FROM public.atendimento_exames e
  JOIN public.atendimentos a ON a.id = e.atendimento_id
  WHERE a.tenant_id = v_tenant
    AND e.data_liberacao IS NOT NULL
    AND e.data_liberacao >= v_today_start
    AND e.data_liberacao <  v_today_end;

  -- Receita hoje/mês a partir de atendimento_pagamentos (tabela oficial).
  SELECT
    COALESCE(SUM(p.valor) FILTER (WHERE p.created_at >= v_today_start AND p.created_at < v_today_end), 0),
    COALESCE(SUM(p.valor) FILTER (WHERE p.created_at >= v_month_start AND p.created_at < v_month_end), 0)
  INTO v_receita_hoje, v_receita_mes
  FROM public.atendimento_pagamentos p
  WHERE p.tenant_id = v_tenant;

  -- A Receber via SSOT (mesma regra de financeiro_a_receber_v2).
  SELECT total_geral
  INTO v_a_receber
  FROM public.financeiro_a_receber_totais();

  -- Saídas pagas no mês a partir de financeiro_saidas (tabela oficial).
  SELECT COALESCE(SUM(s.valor), 0)
  INTO v_saidas_mes
  FROM public.financeiro_saidas s
  WHERE s.tenant_id = v_tenant
    AND s.foi_pago = true
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
      'liberadosHoje',     v_liberados_hoje,
      'coletasPendentes',  v_coletas_pend,
      'analisesAndamento', v_em_analise,
      'resultadosLiberar', v_a_liberar,
      'cancelados',        v_cancelados
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

GRANT EXECUTE ON FUNCTION public.dashboard_kpis() TO authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_kpis() TO service_role;

-- 3) Remove RPC legada sem consumidores no frontend.
DROP FUNCTION IF EXISTS public.a_receber_pacientes_page(
  text, text, timestamp with time zone, timestamp with time zone,
  text, timestamp with time zone, bigint, integer
);
