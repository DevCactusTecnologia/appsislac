-- ============================================================
-- C1 — UI paginada de /atendimentos + Canary feature flags
-- ============================================================

-- 1) Coluna `feature_flags` em tenants (canary por tenant)
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS feature_flags jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2) RPC para o frontend ler as flags do tenant atual (sem expor outros campos)
CREATE OR REPLACE FUNCTION public.current_tenant_feature_flags()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(t.feature_flags, '{}'::jsonb)
    FROM public.tenants t
   WHERE t.id = public.current_tenant_id()
$$;

GRANT EXECUTE ON FUNCTION public.current_tenant_feature_flags() TO authenticated;

-- 3) Índice composto para cursor (data DESC, id DESC) por tenant
CREATE INDEX IF NOT EXISTS idx_atendimentos_tenant_data_id
  ON public.atendimentos (tenant_id, data DESC, id DESC);

-- 4) RPC: KPIs server-side com filtros opcionais
CREATE OR REPLACE FUNCTION public.atendimentos_kpis(
  _status text       DEFAULT NULL,
  _pagamento text    DEFAULT NULL,
  _unidade_id text   DEFAULT NULL,
  _q text            DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid := public.current_tenant_id();
  v_q text := NULLIF(lower(trim(COALESCE(_q,''))), '');
  v_total bigint := 0;
  v_aguard_coleta bigint := 0;
  v_em_analise bigint := 0;
  v_pendentes bigint := 0;
  v_finalizados bigint := 0;
BEGIN
  IF v_tenant IS NULL THEN
    RETURN jsonb_build_object(
      'total',0,'aguardando_coleta',0,'em_analise',0,'pendentes',0,'finalizados',0
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
    COUNT(*) FILTER (WHERE TRUE),
    COUNT(*) FILTER (WHERE lower(status_atendimento) LIKE '%aguard%colet%'),
    COUNT(*) FILTER (WHERE lower(status_atendimento) LIKE '%anális%' OR lower(status_atendimento) LIKE '%analis%'),
    COUNT(*) FILTER (WHERE lower(status_atendimento) NOT IN ('resultado liberado','cancelado','pedido cancelado')),
    COUNT(*) FILTER (WHERE lower(status_atendimento) = 'resultado liberado')
  INTO v_total, v_aguard_coleta, v_em_analise, v_pendentes, v_finalizados
  FROM base;

  RETURN jsonb_build_object(
    'total', v_total,
    'aguardando_coleta', v_aguard_coleta,
    'em_analise', v_em_analise,
    'pendentes', v_pendentes,
    'finalizados', v_finalizados
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.atendimentos_kpis(text,text,text,text) TO authenticated;

-- 5) RPC: página paginada por cursor (data, id) DESC
CREATE OR REPLACE FUNCTION public.atendimentos_page(
  _status text       DEFAULT NULL,
  _pagamento text    DEFAULT NULL,
  _unidade_id text   DEFAULT NULL,
  _q text            DEFAULT NULL,
  _cursor_data timestamptz DEFAULT NULL,
  _cursor_id   bigint      DEFAULT NULL,
  _page_size   int         DEFAULT 50
)
RETURNS TABLE (
  id bigint,
  protocolo text,
  data timestamptz,
  paciente_nome text,
  paciente_cpf text,
  paciente_nascimento date,
  solicitante text,
  convenio_id int,
  convenio_nome text,
  unidade_id text,
  status_atendimento text,
  status_pagamento text,
  motivo_cancelamento text,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid := public.current_tenant_id();
  v_q text := NULLIF(lower(trim(COALESCE(_q,''))), '');
  v_size int := LEAST(GREATEST(COALESCE(_page_size, 50), 10), 200);
BEGIN
  IF v_tenant IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT a.id, a.protocolo, a.data, a.paciente_nome, a.paciente_cpf,
         a.paciente_nascimento, a.solicitante, a.convenio_id, a.convenio_nome,
         a.unidade_id, a.status_atendimento, a.status_pagamento,
         a.motivo_cancelamento, a.updated_at
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
     AND (
       _cursor_data IS NULL
       OR (a.data, a.id) < (_cursor_data, COALESCE(_cursor_id, 9223372036854775807))
     )
   ORDER BY a.data DESC, a.id DESC
   LIMIT v_size;
END;
$$;

GRANT EXECUTE ON FUNCTION public.atendimentos_page(text,text,text,text,timestamptz,bigint,int) TO authenticated;
