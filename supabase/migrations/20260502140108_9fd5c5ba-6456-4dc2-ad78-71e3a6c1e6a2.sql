-- ────────────────────────────────────────────────────────────────
-- C2: Agregação server-side para o dashboard/produção.
-- Substitui os fetches massivos de atendimentos+exames no cliente
-- (que usavam .limit(50000) / .limit(200000)) por agregados SQL.
-- ────────────────────────────────────────────────────────────────

-- 1) Agregados completos (analista / convenio / material / exame / total / serie diaria)
CREATE OR REPLACE FUNCTION public.dashboard_metrics(
  _inicio timestamptz,
  _fim    timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid := public.current_tenant_id();
  v_is_sa  boolean := public.is_super_admin(auth.uid());
  v_result jsonb;
BEGIN
  IF v_tenant IS NULL AND NOT v_is_sa THEN
    RETURN jsonb_build_object(
      'porAnalista', '[]'::jsonb,
      'porConvenio', '[]'::jsonb,
      'porMaterial', '[]'::jsonb,
      'porExame',    '[]'::jsonb,
      'totalExames', 0,
      'serieDiaria', '[]'::jsonb,
      'intervalo',   jsonb_build_object('inicio', _inicio, 'fim', _fim)
    );
  END IF;

  WITH base AS (
    SELECT
      e.nome_exame,
      e.material,
      e.analista,
      e.coletor,
      a.convenio_nome,
      a.data
    FROM public.atendimento_exames e
    JOIN public.atendimentos a ON a.id = e.atendimento_id
    WHERE a.data BETWEEN _inicio AND _fim
      AND e.status <> 'cancelado'
      AND (v_is_sa OR a.tenant_id = v_tenant)
  ),
  por_analista AS (
    SELECT
      COALESCE(NULLIF(btrim(analista), ''), NULLIF(btrim(coletor), ''), 'Sem responsável') AS nome,
      COUNT(*)::bigint AS total
    FROM base
    GROUP BY 1
    ORDER BY total DESC
    LIMIT 200
  ),
  por_convenio AS (
    SELECT COALESCE(NULLIF(btrim(convenio_nome), ''), '—') AS nome,
           COUNT(*)::bigint AS total
    FROM base
    GROUP BY 1
    ORDER BY total DESC
    LIMIT 200
  ),
  por_material AS (
    SELECT COALESCE(NULLIF(btrim(material), ''), 'Sem material') AS nome,
           COUNT(*)::bigint AS total
    FROM base
    GROUP BY 1
    ORDER BY total DESC
    LIMIT 200
  ),
  por_exame AS (
    SELECT nome_exame AS nome, COUNT(*)::bigint AS total
    FROM base
    GROUP BY 1
    ORDER BY total DESC
    LIMIT 500
  ),
  serie AS (
    SELECT to_char(data AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS dia,
           COUNT(*)::bigint AS total
    FROM base
    GROUP BY 1
    ORDER BY 1
  )
  SELECT jsonb_build_object(
    'porAnalista', COALESCE((SELECT jsonb_agg(jsonb_build_object('nome', nome, 'total', total)) FROM por_analista), '[]'::jsonb),
    'porConvenio', COALESCE((SELECT jsonb_agg(jsonb_build_object('nome', nome, 'total', total)) FROM por_convenio), '[]'::jsonb),
    'porMaterial', COALESCE((SELECT jsonb_agg(jsonb_build_object('nome', nome, 'total', total)) FROM por_material), '[]'::jsonb),
    'porExame',    COALESCE((SELECT jsonb_agg(jsonb_build_object('nome', nome, 'total', total)) FROM por_exame),    '[]'::jsonb),
    'totalExames', COALESCE((SELECT SUM(total) FROM por_exame), 0),
    'serieDiaria', COALESCE((SELECT jsonb_agg(jsonb_build_object('dia', dia, 'total', total)) FROM serie), '[]'::jsonb),
    'intervalo',   jsonb_build_object('inicio', _inicio, 'fim', _fim)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.dashboard_metrics(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_metrics(timestamptz, timestamptz) TO authenticated;

-- 2) Série diária com filtros opcionais (usada pelo gráfico de Produção)
CREATE OR REPLACE FUNCTION public.dashboard_daily_series(
  _inicio       timestamptz,
  _fim          timestamptz,
  _nome_exame   text DEFAULT NULL,
  _convenio     text DEFAULT NULL,
  _analista     text DEFAULT NULL,
  _material     text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid := public.current_tenant_id();
  v_is_sa  boolean := public.is_super_admin(auth.uid());
  v_result jsonb;
BEGIN
  IF v_tenant IS NULL AND NOT v_is_sa THEN
    RETURN '[]'::jsonb;
  END IF;

  WITH base AS (
    SELECT
      to_char(a.data AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS dia,
      COALESCE(NULLIF(btrim(e.analista), ''), NULLIF(btrim(e.coletor), ''), '') AS resp
    FROM public.atendimento_exames e
    JOIN public.atendimentos a ON a.id = e.atendimento_id
    WHERE a.data BETWEEN _inicio AND _fim
      AND e.status <> 'cancelado'
      AND (v_is_sa OR a.tenant_id = v_tenant)
      AND (_nome_exame IS NULL OR e.nome_exame = _nome_exame)
      AND (_material   IS NULL OR e.material   = _material)
      AND (_convenio   IS NULL OR a.convenio_nome = _convenio)
  ),
  filtrada AS (
    SELECT dia FROM base
    WHERE _analista IS NULL OR resp = _analista
  ),
  agg AS (
    SELECT dia, COUNT(*)::bigint AS total
    FROM filtrada
    GROUP BY dia
    ORDER BY dia
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object('dia', dia, 'total', total)), '[]'::jsonb)
  INTO v_result
  FROM agg;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.dashboard_daily_series(timestamptz, timestamptz, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_daily_series(timestamptz, timestamptz, text, text, text, text) TO authenticated;