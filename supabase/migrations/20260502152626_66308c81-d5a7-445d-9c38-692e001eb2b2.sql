-- ============================================================
-- BLOCO 1: Índice composto para filtros por status + ordenação
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_atendimentos_tenant_status_data_id
  ON public.atendimentos (tenant_id, status_atendimento, data DESC, id DESC);

-- ============================================================
-- BLOCO 3: RPC a_receber_pacientes_page
-- Lista paginada (cursor por data/id) de saldos a receber por paciente.
-- Considera apenas exames com cobranca_destino='paciente'.
-- Soma valor dos exames - pagamentos efetivados.
-- ============================================================
CREATE OR REPLACE FUNCTION public.a_receber_pacientes_page(
  p_search    text DEFAULT NULL,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to   timestamptz DEFAULT NULL,
  p_status    text DEFAULT NULL, -- 'parcial' | 'pendente' | NULL (todas)
  p_cursor_data timestamptz DEFAULT NULL,
  p_cursor_id   bigint DEFAULT NULL,
  p_limit       integer DEFAULT 50
)
RETURNS TABLE (
  id            bigint,
  protocolo     text,
  data          timestamptz,
  paciente_nome text,
  convenio_nome text,
  valor_total   numeric,
  valor_pago    numeric,
  saldo         numeric,
  status        text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      a.id, a.protocolo, a.data, a.paciente_nome, a.convenio_nome,
      COALESCE(SUM(CASE WHEN e.cobranca_destino = 'paciente' THEN e.valor ELSE 0 END), 0) AS valor_total
    FROM public.atendimentos a
    LEFT JOIN public.atendimento_exames e ON e.atendimento_id = a.id
    WHERE a.tenant_id = current_tenant_id()
      AND a.status_atendimento <> 'Cancelado'
      AND (p_date_from IS NULL OR a.data >= p_date_from)
      AND (p_date_to   IS NULL OR a.data <= p_date_to)
      AND (
        p_search IS NULL OR p_search = ''
        OR lower(a.paciente_nome) LIKE '%' || lower(p_search) || '%'
        OR lower(a.protocolo)     LIKE '%' || lower(p_search) || '%'
      )
    GROUP BY a.id, a.protocolo, a.data, a.paciente_nome, a.convenio_nome
  ),
  pagos AS (
    SELECT atendimento_id, COALESCE(SUM(valor), 0) AS valor_pago
    FROM public.atendimento_pagamentos
    WHERE tenant_id = current_tenant_id()
    GROUP BY atendimento_id
  ),
  joined AS (
    SELECT
      b.id, b.protocolo, b.data, b.paciente_nome, b.convenio_nome,
      b.valor_total,
      COALESCE(p.valor_pago, 0) AS valor_pago,
      ROUND((b.valor_total - COALESCE(p.valor_pago, 0))::numeric, 2) AS saldo,
      CASE WHEN COALESCE(p.valor_pago, 0) > 0 THEN 'parcial' ELSE 'pendente' END AS status
    FROM base b
    LEFT JOIN pagos p ON p.atendimento_id = b.id
  )
  SELECT id, protocolo, data, paciente_nome, convenio_nome,
         valor_total, valor_pago, saldo, status
  FROM joined
  WHERE saldo > 0.009
    AND (p_status IS NULL OR status = p_status)
    AND (
      p_cursor_data IS NULL
      OR data < p_cursor_data
      OR (data = p_cursor_data AND id < p_cursor_id)
    )
  ORDER BY data DESC, id DESC
  LIMIT GREATEST(1, LEAST(p_limit, 200));
$$;

REVOKE ALL ON FUNCTION public.a_receber_pacientes_page(text, timestamptz, timestamptz, text, timestamptz, bigint, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.a_receber_pacientes_page(text, timestamptz, timestamptz, text, timestamptz, bigint, integer) TO authenticated;

-- ============================================================
-- BLOCO 3: RPC financeiro_resumo
-- Totais agregados num único round-trip.
-- ============================================================
CREATE OR REPLACE FUNCTION public.financeiro_resumo(
  p_date_from timestamptz DEFAULT NULL,
  p_date_to   timestamptz DEFAULT NULL,
  p_convenio  text DEFAULT NULL
)
RETURNS TABLE (
  total_recebido        numeric,
  qtd_recebido          bigint,
  total_a_receber       numeric,
  qtd_a_receber         bigint,
  total_saidas_pagas    numeric,
  qtd_saidas_pagas      bigint,
  total_saidas_pendentes numeric,
  qtd_saidas_pendentes  bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH receb AS (
    SELECT COALESCE(SUM(p.valor), 0) AS total, COUNT(*)::bigint AS qtd
    FROM public.atendimento_pagamentos p
    JOIN public.atendimentos a ON a.id = p.atendimento_id
    WHERE p.tenant_id = current_tenant_id()
      AND a.status_atendimento <> 'Cancelado'
      AND (p_date_from IS NULL OR p.data >= p_date_from)
      AND (p_date_to   IS NULL OR p.data <= p_date_to)
      AND (p_convenio IS NULL OR p_convenio = '' OR a.convenio_nome = p_convenio)
  ),
  exames_paciente AS (
    SELECT a.id, COALESCE(SUM(e.valor), 0) AS valor_total
    FROM public.atendimentos a
    JOIN public.atendimento_exames e ON e.atendimento_id = a.id
    WHERE a.tenant_id = current_tenant_id()
      AND a.status_atendimento <> 'Cancelado'
      AND e.cobranca_destino = 'paciente'
      AND (p_date_from IS NULL OR a.data >= p_date_from)
      AND (p_date_to   IS NULL OR a.data <= p_date_to)
      AND (p_convenio IS NULL OR p_convenio = '' OR a.convenio_nome = p_convenio)
    GROUP BY a.id
  ),
  pagos AS (
    SELECT atendimento_id, COALESCE(SUM(valor), 0) AS pago
    FROM public.atendimento_pagamentos
    WHERE tenant_id = current_tenant_id()
    GROUP BY atendimento_id
  ),
  arec AS (
    SELECT
      COALESCE(SUM(GREATEST(ep.valor_total - COALESCE(p.pago, 0), 0)), 0) AS total,
      COUNT(*) FILTER (WHERE ep.valor_total - COALESCE(p.pago, 0) > 0.009)::bigint AS qtd
    FROM exames_paciente ep
    LEFT JOIN pagos p ON p.atendimento_id = ep.id
  ),
  said_pagas AS (
    SELECT COALESCE(SUM(valor), 0) AS total, COUNT(*)::bigint AS qtd
    FROM public.financeiro_saidas
    WHERE tenant_id = current_tenant_id()
      AND foi_pago = true
      AND (p_date_from IS NULL OR data >= p_date_from)
      AND (p_date_to   IS NULL OR data <= p_date_to)
  ),
  said_pend AS (
    SELECT COALESCE(SUM(valor), 0) AS total, COUNT(*)::bigint AS qtd
    FROM public.financeiro_saidas
    WHERE tenant_id = current_tenant_id()
      AND foi_pago = false
      AND (p_date_from IS NULL OR data >= p_date_from)
      AND (p_date_to   IS NULL OR data <= p_date_to)
  )
  SELECT
    receb.total, receb.qtd,
    arec.total,  arec.qtd,
    said_pagas.total, said_pagas.qtd,
    said_pend.total,  said_pend.qtd
  FROM receb, arec, said_pagas, said_pend;
$$;

REVOKE ALL ON FUNCTION public.financeiro_resumo(timestamptz, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.financeiro_resumo(timestamptz, timestamptz, text) TO authenticated;