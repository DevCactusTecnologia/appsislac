
CREATE OR REPLACE FUNCTION public.resultados_page(
  _cursor_data timestamp with time zone DEFAULT NULL::timestamp with time zone,
  _cursor_id bigint DEFAULT NULL::bigint,
  _limit integer DEFAULT 50,
  _status text DEFAULT NULL::text,
  _busca text DEFAULT NULL::text
)
RETURNS TABLE(id bigint, protocolo text, paciente_nome text, paciente_nascimento date, solicitante text, status_resultado text, motivo_cancelamento text, data timestamp with time zone, tem_retificacao boolean)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT
      a.id, a.protocolo, a.paciente_nome, a.paciente_nascimento, a.solicitante,
      a.status_atendimento,
      a.motivo_cancelamento, a.data, a.tem_retificacao,
      EXISTS (
        SELECT 1 FROM public.atendimento_exames ae
        WHERE ae.atendimento_id = a.id
          AND ae.lab_apoio_id IS NULL
          AND COALESCE(ae.tipo_processo,'INTERNO') = 'INTERNO'
          AND ae.status IN ('analisado','resultado_salvo','resultado_liberado','finalizado','em_analise')
      ) AS tem_exame_analisado
    FROM public.atendimentos a
    WHERE a.tenant_id = public.current_tenant_id()
      AND (_busca IS NULL OR lower(a.paciente_nome) LIKE '%' || lower(_busca) || '%' OR lower(a.protocolo) LIKE '%' || lower(_busca) || '%')
  )
  SELECT
    b.id, b.protocolo, b.paciente_nome, b.paciente_nascimento, b.solicitante,
    CASE
      WHEN b.status_atendimento IN ('Resultado Liberado','Amostra Analisada','Resultado Salvo','Cancelado')
        THEN b.status_atendimento
      WHEN b.tem_exame_analisado THEN 'Amostra Analisada'
      ELSE b.status_atendimento
    END AS status_resultado,
    b.motivo_cancelamento, b.data, b.tem_retificacao
  FROM base b
  WHERE (
          b.status_atendimento IN ('Resultado Liberado','Amostra Analisada','Resultado Salvo','Cancelado')
          OR b.tem_exame_analisado
        )
    AND (
          _status IS NULL
          OR (CASE
                WHEN b.status_atendimento IN ('Resultado Liberado','Amostra Analisada','Resultado Salvo','Cancelado')
                  THEN b.status_atendimento
                WHEN b.tem_exame_analisado THEN 'Amostra Analisada'
                ELSE b.status_atendimento
              END) = _status
        )
    AND (_cursor_data IS NULL OR (b.data, b.id) < (_cursor_data, COALESCE(_cursor_id, 9223372036854775807)))
  ORDER BY b.data DESC, b.id DESC
  LIMIT GREATEST(1, LEAST(_limit, 200));
$function$;
