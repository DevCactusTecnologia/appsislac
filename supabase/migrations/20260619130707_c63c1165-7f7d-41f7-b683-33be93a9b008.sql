-- Fase 5 (Financeiro V2) — Adiciona coluna `desde` na RPC SSOT `financeiro_a_receber_v2`.
-- Para PACIENTES: data do atendimento (igual `data`).
-- Para CONVÊNIOS: data do atendimento mais antigo com exame em aberto.
-- Mantém todos os demais campos e semântica da Fase 1.

DROP FUNCTION IF EXISTS public.financeiro_a_receber_v2(text, text, timestamptz, timestamptz, text, timestamptz, bigint, integer);

CREATE OR REPLACE FUNCTION public.financeiro_a_receber_v2(
  p_tipo        text                     DEFAULT 'paciente',
  p_search      text                     DEFAULT NULL,
  p_date_from   timestamptz              DEFAULT NULL,
  p_date_to     timestamptz              DEFAULT NULL,
  p_status      text                     DEFAULT NULL,
  p_cursor_data timestamptz              DEFAULT NULL,
  p_cursor_id   bigint                   DEFAULT NULL,
  p_limit       integer                  DEFAULT 50
)
RETURNS TABLE (
  tipo           text,
  ref_id         bigint,
  protocolo      text,
  data           timestamptz,
  desde          timestamptz,
  quem           text,
  convenio_nome  text,
  valor_total    numeric,
  valor_pago     numeric,
  saldo          numeric,
  status         text,
  qtd_exames     integer,
  qtd_pacientes  integer
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
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
  pacientes AS (
    SELECT
      'paciente'::text AS tipo,
      b.id::bigint     AS ref_id,
      b.protocolo,
      b.data,
      b.data           AS desde,
      b.paciente_nome  AS quem,
      b.convenio_nome,
      b.valor_total,
      COALESCE(p.valor_pago, 0) AS valor_pago,
      ROUND((b.valor_total - COALESCE(p.valor_pago, 0))::numeric, 2) AS saldo,
      CASE WHEN COALESCE(p.valor_pago, 0) > 0 THEN 'parcial' ELSE 'pendente' END AS status,
      NULL::integer AS qtd_exames,
      NULL::integer AS qtd_pacientes
    FROM base b
    LEFT JOIN pagos p ON p.atendimento_id = b.id
    WHERE ROUND((b.valor_total - COALESCE(p.valor_pago, 0))::numeric, 2) > 0.009
  ),
  conv_exames AS (
    SELECT
      e.convenio_cobranca_id AS convenio_id,
      e.atendimento_id,
      e.id AS exame_id,
      e.valor,
      a.data AS data_atendimento
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
      COALESCE(SUM(ce.valor), 0)            AS saldo,
      COUNT(*)::integer                     AS qtd_exames,
      COUNT(DISTINCT ce.atendimento_id)::integer AS qtd_pacientes,
      MIN(ce.data_atendimento)              AS desde
    FROM conv_exames ce
    GROUP BY ce.convenio_id
  ),
  convenios AS (
    SELECT
      'convenio'::text       AS tipo,
      c.id::bigint           AS ref_id,
      NULL::text             AS protocolo,
      NULL::timestamptz      AS data,
      ca.desde               AS desde,
      c.nome                 AS quem,
      NULL::text             AS convenio_nome,
      ROUND(ca.saldo::numeric, 2) AS valor_total,
      0::numeric             AS valor_pago,
      ROUND(ca.saldo::numeric, 2) AS saldo,
      'aberto'::text         AS status,
      ca.qtd_exames,
      ca.qtd_pacientes
    FROM conv_agg ca
    JOIN public.convenios c ON c.id = ca.convenio_id
    WHERE c.tenant_id = current_tenant_id()
      AND c.id <> 0
      AND ca.saldo > 0.009
      AND (
        p_search IS NULL OR p_search = ''
        OR lower(c.nome) LIKE '%' || lower(p_search) || '%'
      )
  )
  SELECT * FROM (
    SELECT * FROM pacientes
    WHERE p_tipo = 'paciente'
      AND (p_status IS NULL OR status = p_status)
      AND (
        p_cursor_data IS NULL
        OR data < p_cursor_data
        OR (data = p_cursor_data AND ref_id < p_cursor_id)
      )
    ORDER BY data DESC, ref_id DESC
    LIMIT GREATEST(1, LEAST(p_limit, 200))
  ) p
  UNION ALL
  SELECT * FROM (
    SELECT * FROM convenios
    WHERE p_tipo = 'convenio'
    ORDER BY saldo DESC
  ) c;
$function$;

GRANT EXECUTE ON FUNCTION public.financeiro_a_receber_v2(text, text, timestamptz, timestamptz, text, timestamptz, bigint, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.financeiro_a_receber_v2(text, text, timestamptz, timestamptz, text, timestamptz, bigint, integer) TO service_role;

COMMENT ON FUNCTION public.financeiro_a_receber_v2(text, text, timestamptz, timestamptz, text, timestamptz, bigint, integer)
IS 'SSOT Financeiro V2 — Fases 1+5. Fonte única de "A Receber" (pacientes paginados + convênios agregados). Coluna `desde` adicionada na Fase 5 (split UI).';