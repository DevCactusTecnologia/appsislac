CREATE OR REPLACE FUNCTION public.atendimentos_kpis(
  _status text DEFAULT NULL::text,
  _pagamento text DEFAULT NULL::text,
  _unidade_id text DEFAULT NULL::text,
  _q text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant uuid := public.current_tenant_id();
  v_q text := NULLIF(lower(trim(COALESCE(_q,''))), '');
  v_total bigint := 0;
  v_aguard_coleta bigint := 0;
  v_em_analise bigint := 0;
  v_pendentes bigint := 0;
  v_finalizados bigint := 0;
  v_receita numeric := 0;
BEGIN
  IF v_tenant IS NULL THEN
    RETURN jsonb_build_object(
      'total',0,'aguardando_coleta',0,'em_analise',0,
      'pendentes',0,'finalizados',0,'receita_total',0
    );
  END IF;

  WITH base AS (
    SELECT a.id, a.status_atendimento, a.status_pagamento
      FROM public.atendimentos a
     WHERE a.tenant_id = v_tenant
       AND (_status IS NULL OR _status = 'Todos' OR a.status_atendimento = _status)
       AND (_pagamento IS NULL OR _pagamento = 'Todos' OR a.status_pagamento = _pagamento)
       AND (_unidade_id IS NULL OR _unidade_id = 'Todos' OR a.unidade_id = _unidade_id)
       AND (
         v_q IS NULL
         OR lower(COALESCE(a.paciente_nome,'')) LIKE '%' || v_q || '%'
         OR lower(COALESCE(a.paciente_cpf,''))  LIKE '%' || v_q || '%'
         OR lower(COALESCE(a.protocolo,''))     LIKE '%' || v_q || '%'
         OR lower(COALESCE(a.solicitante,''))   LIKE '%' || v_q || '%'
         OR lower(COALESCE(a.convenio_nome,'')) LIKE '%' || v_q || '%'
       )
  )
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE lower(status_atendimento) LIKE '%aguard%colet%'),
    COUNT(*) FILTER (WHERE lower(status_atendimento) LIKE '%anális%' OR lower(status_atendimento) LIKE '%analis%'),
    COUNT(*) FILTER (WHERE lower(status_atendimento) NOT IN ('resultado liberado','cancelado','pedido cancelado')),
    COUNT(*) FILTER (WHERE lower(status_atendimento) = 'resultado liberado')
  INTO v_total, v_aguard_coleta, v_em_analise, v_pendentes, v_finalizados
  FROM base;

  -- Receita: soma de valores dos exames dos atendimentos do conjunto filtrado,
  -- excluindo atendimentos cancelados e exames cancelados.
  SELECT COALESCE(SUM(ax.valor), 0)
    INTO v_receita
    FROM public.atendimento_exames ax
    JOIN public.atendimentos a ON a.id = ax.atendimento_id
   WHERE ax.tenant_id = v_tenant
     AND a.tenant_id = v_tenant
     AND lower(a.status_atendimento) NOT IN ('cancelado','pedido cancelado')
     AND lower(COALESCE(ax.status,'')) NOT IN ('cancelado','cancelada')
     AND (_status IS NULL OR _status = 'Todos' OR a.status_atendimento = _status)
     AND (_pagamento IS NULL OR _pagamento = 'Todos' OR a.status_pagamento = _pagamento)
     AND (_unidade_id IS NULL OR _unidade_id = 'Todos' OR a.unidade_id = _unidade_id)
     AND (
       v_q IS NULL
       OR lower(COALESCE(a.paciente_nome,'')) LIKE '%' || v_q || '%'
       OR lower(COALESCE(a.paciente_cpf,''))  LIKE '%' || v_q || '%'
       OR lower(COALESCE(a.protocolo,''))     LIKE '%' || v_q || '%'
       OR lower(COALESCE(a.solicitante,''))   LIKE '%' || v_q || '%'
       OR lower(COALESCE(a.convenio_nome,'')) LIKE '%' || v_q || '%'
     );

  RETURN jsonb_build_object(
    'total', v_total,
    'aguardando_coleta', v_aguard_coleta,
    'em_analise', v_em_analise,
    'pendentes', v_pendentes,
    'finalizados', v_finalizados,
    'receita_total', v_receita
  );
END;
$function$;