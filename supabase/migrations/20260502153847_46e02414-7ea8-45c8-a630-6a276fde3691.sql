-- BLOCO 1 — RPC paginada para tela Resultados (cursor-based, tenant-scoped)
CREATE OR REPLACE FUNCTION public.resultados_page(
  _cursor_data timestamptz DEFAULT NULL,
  _cursor_id bigint DEFAULT NULL,
  _limit int DEFAULT 50,
  _status text DEFAULT NULL,
  _busca text DEFAULT NULL
)
RETURNS TABLE (
  id bigint,
  protocolo text,
  paciente_nome text,
  paciente_nascimento date,
  solicitante text,
  status_resultado text,
  motivo_cancelamento text,
  data timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    a.id,
    a.protocolo,
    a.paciente_nome,
    a.paciente_nascimento,
    a.solicitante,
    a.status_atendimento AS status_resultado,
    a.motivo_cancelamento,
    a.data
  FROM public.atendimentos a
  WHERE
    a.tenant_id = public.current_tenant_id()
    AND (_status IS NULL OR a.status_atendimento = _status)
    AND (
      _busca IS NULL
      OR lower(a.paciente_nome) LIKE '%' || lower(_busca) || '%'
      OR lower(a.protocolo) LIKE '%' || lower(_busca) || '%'
    )
    AND (
      _cursor_data IS NULL
      OR (a.data, a.id) < (_cursor_data, COALESCE(_cursor_id, 9223372036854775807))
    )
  ORDER BY a.data DESC, a.id DESC
  LIMIT GREATEST(1, LEAST(_limit, 200));
$$;

REVOKE ALL ON FUNCTION public.resultados_page(timestamptz, bigint, int, text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.resultados_page(timestamptz, bigint, int, text, text) TO authenticated;

-- BLOCO 2 — índice cursor + ordenação (sem CONCURRENTLY pois migrations rodam em transação)
CREATE INDEX IF NOT EXISTS idx_atendimentos_tenant_data_id
  ON public.atendimentos (tenant_id, data DESC, id DESC);
