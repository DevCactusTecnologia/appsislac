-- RPC: resumo de impressão geral por unidade/data
-- Retorna 1 linha por unidade do tenant atual com totais para a data informada.
CREATE OR REPLACE FUNCTION public.impressao_geral_resumo(
  _date date,
  _unidade_id text DEFAULT NULL
)
RETURNS TABLE (
  unidade_id text,
  total_pacientes bigint,
  total_exames bigint,
  cancelados bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.unidade_id,
    COUNT(*)::bigint AS total_pacientes,
    COALESCE(SUM(ex.cnt), 0)::bigint AS total_exames,
    COUNT(*) FILTER (WHERE a.status_atendimento = 'Cancelado')::bigint AS cancelados
  FROM public.atendimentos a
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::bigint AS cnt
    FROM public.atendimento_exames e
    WHERE e.atendimento_id = a.id
      AND e.tenant_id = a.tenant_id
  ) ex ON TRUE
  WHERE a.tenant_id = public.current_tenant_id()
    AND (a.data AT TIME ZONE 'UTC')::date = _date
    AND (_unidade_id IS NULL OR a.unidade_id = _unidade_id)
  GROUP BY a.unidade_id;
$$;

REVOKE ALL ON FUNCTION public.impressao_geral_resumo(date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.impressao_geral_resumo(date, text) TO authenticated;