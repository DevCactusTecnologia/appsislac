-- ============================================================
-- ocorrencias_page — RPC paginada por cursor (occurred_at DESC, id DESC)
-- ------------------------------------------------------------
-- Unifica em uma única lista:
--   1) Atendimentos com status "Cancelado" / "Pedido Cancelado"
--      (categoria='atendimento')
--   2) Exames com status='cancelado' cujo atendimento NÃO está
--      totalmente cancelado (categoria='amostra')
--
-- Multi-tenant: usa current_tenant_id() — frontend nunca envia tenant.
-- Read-only, STABLE, security definer com search_path travado.
-- ============================================================

CREATE OR REPLACE FUNCTION public.ocorrencias_page(
  _cursor_occurred_at timestamptz DEFAULT NULL,
  _cursor_id          bigint      DEFAULT NULL,
  _cursor_kind        text        DEFAULT NULL, -- 'atendimento' | 'amostra'
  _limit              integer     DEFAULT 50,
  _date_from          timestamptz DEFAULT NULL,
  _date_to            timestamptz DEFAULT NULL,
  _busca              text        DEFAULT NULL
)
RETURNS TABLE (
  kind                text,        -- 'atendimento' ou 'amostra'
  row_id              bigint,      -- id do atendimento ou do exame
  atendimento_id      bigint,
  protocolo           text,
  paciente_nome       text,
  paciente_cpf        text,
  data_protocolo      timestamptz,
  occurred_at         timestamptz, -- chave de ordenação/cursor
  motivo              text,
  exame_nome          text,        -- só para kind='amostra'
  exame_material      text,        -- só para kind='amostra'
  exame_data_coleta   timestamptz, -- só para kind='amostra'
  exame_data_analise  timestamptz  -- só para kind='amostra'
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant uuid := public.current_tenant_id();
  _safe_limit integer := LEAST(GREATEST(COALESCE(_limit, 50), 1), 200);
  _busca_norm text := NULLIF(TRIM(LOWER(COALESCE(_busca, ''))), '');
  _busca_digits text := NULLIF(REGEXP_REPLACE(COALESCE(_busca, ''), '\D', '', 'g'), '');
BEGIN
  IF _tenant IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH
  -- ── Atendimentos cancelados ────────────────────────────────────────
  at_cancelados AS (
    SELECT
      'atendimento'::text                        AS kind,
      a.id                                       AS row_id,
      a.id                                       AS atendimento_id,
      a.protocolo,
      a.paciente_nome,
      a.paciente_cpf,
      a.data                                     AS data_protocolo,
      COALESCE(a.updated_at, a.data)             AS occurred_at,
      COALESCE(NULLIF(a.motivo_cancelamento, ''), 'Não informado') AS motivo,
      NULL::text                                 AS exame_nome,
      NULL::text                                 AS exame_material,
      NULL::timestamptz                          AS exame_data_coleta,
      NULL::timestamptz                          AS exame_data_analise
    FROM public.atendimentos a
    WHERE a.tenant_id = _tenant
      AND a.status_atendimento IN ('Cancelado', 'Pedido Cancelado')
  ),
  -- ── Exames cancelados (com atendimento ainda ativo) ────────────────
  ex_cancelados AS (
    SELECT
      'amostra'::text                            AS kind,
      e.id                                       AS row_id,
      a.id                                       AS atendimento_id,
      a.protocolo,
      a.paciente_nome,
      a.paciente_cpf,
      a.data                                     AS data_protocolo,
      COALESCE(e.updated_at, e.data_analise, e.data_coleta, a.data) AS occurred_at,
      COALESCE(
        NULLIF(e.motivo_cancelamento, ''),
        CASE WHEN e.data_analise IS NOT NULL
             THEN 'Cancelado na etapa de análise'
             ELSE 'Cancelado na etapa de coleta'
        END
      )                                          AS motivo,
      e.nome_exame                               AS exame_nome,
      NULLIF(e.material, '')                     AS exame_material,
      e.data_coleta                              AS exame_data_coleta,
      e.data_analise                             AS exame_data_analise
    FROM public.atendimento_exames e
    JOIN public.atendimentos a
      ON a.id = e.atendimento_id
     AND a.tenant_id = _tenant
    WHERE e.tenant_id = _tenant
      AND e.status = 'cancelado'
      AND a.status_atendimento NOT IN ('Cancelado', 'Pedido Cancelado')
  ),
  unificado AS (
    SELECT * FROM at_cancelados
    UNION ALL
    SELECT * FROM ex_cancelados
  ),
  filtrado AS (
    SELECT *
    FROM unificado u
    WHERE
      (_date_from IS NULL OR u.occurred_at >= _date_from)
      AND (_date_to IS NULL OR u.occurred_at <  _date_to + interval '1 day')
      AND (
        _busca_norm IS NULL
        OR LOWER(u.paciente_nome) LIKE '%' || _busca_norm || '%'
        OR LOWER(u.protocolo)     LIKE '%' || _busca_norm || '%'
        OR (_busca_digits IS NOT NULL
            AND REGEXP_REPLACE(u.paciente_cpf, '\D', '', 'g') LIKE '%' || _busca_digits || '%')
      )
      -- Cursor composto (occurred_at DESC, kind, row_id DESC).
      -- O kind entra na chave para evitar empate exato entre atendimento/amostra.
      AND (
        _cursor_occurred_at IS NULL
        OR u.occurred_at < _cursor_occurred_at
        OR (
          u.occurred_at = _cursor_occurred_at
          AND (
            (u.kind, u.row_id) < (COALESCE(_cursor_kind, 'zzz'), COALESCE(_cursor_id, 9223372036854775807))
          )
        )
      )
  )
  SELECT
    f.kind, f.row_id, f.atendimento_id, f.protocolo,
    f.paciente_nome, f.paciente_cpf, f.data_protocolo, f.occurred_at,
    f.motivo, f.exame_nome, f.exame_material,
    f.exame_data_coleta, f.exame_data_analise
  FROM filtrado f
  ORDER BY f.occurred_at DESC, f.kind ASC, f.row_id DESC
  LIMIT _safe_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.ocorrencias_page(timestamptz, bigint, text, integer, timestamptz, timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ocorrencias_page(timestamptz, bigint, text, integer, timestamptz, timestamptz, text) TO authenticated;