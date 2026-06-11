ALTER TABLE public.atendimentos
  ADD COLUMN IF NOT EXISTS tem_retificacao boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.recompute_atendimento_status(_atendimento_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  total_exames INT;
  total_cancelados INT;
  total_finalizados INT;
  total_em_analise INT;
  total_analisado INT;
  total_em_bancada INT;
  total_coletados INT;
  total_retificados_em_curso INT;
  ativos INT;
  novo_status_at TEXT;
  total_valor_paciente NUMERIC(12,2);
  total_pago NUMERIC(12,2);
  novo_status_pg TEXT;
BEGIN
  SELECT
    count(*),
    count(*) FILTER (WHERE status = 'cancelado'),
    count(*) FILTER (WHERE status = 'finalizado'),
    count(*) FILTER (WHERE status = 'em_analise'),
    count(*) FILTER (WHERE status = 'analisado'),
    count(*) FILTER (WHERE status = 'em_bancada'),
    count(*) FILTER (WHERE status = 'coletado'),
    count(*) FILTER (WHERE retificado = true AND status IN ('em_analise','em_bancada','analisado','pendente'))
  INTO total_exames, total_cancelados, total_finalizados, total_em_analise,
       total_analisado, total_em_bancada, total_coletados,
       total_retificados_em_curso
  FROM public.atendimento_exames
  WHERE atendimento_id = _atendimento_id;

  ativos := total_exames - total_cancelados;

  IF total_exames = 0 THEN
    novo_status_at := 'Pedido Realizado';
  ELSIF total_cancelados = total_exames THEN
    novo_status_at := 'Cancelado';
  ELSIF total_finalizados = ativos THEN
    novo_status_at := 'Resultado Liberado';
  ELSIF (total_finalizados + total_em_analise) = ativos AND total_em_analise > 0 THEN
    novo_status_at := 'Resultado Salvo';
  ELSIF (total_finalizados + total_em_analise + total_analisado) = ativos AND total_analisado > 0 THEN
    novo_status_at := 'Amostra Analisada';
  ELSIF total_em_bancada > 0 THEN
    novo_status_at := 'Em Análise';
  ELSIF total_coletados > 0 THEN
    novo_status_at := 'Amostra Coletada';
  ELSE
    novo_status_at := 'Pedido Realizado';
  END IF;

  SELECT COALESCE(SUM(valor), 0) INTO total_valor_paciente
  FROM public.atendimento_exames
  WHERE atendimento_id = _atendimento_id
    AND status <> 'cancelado'
    AND cobranca_destino = 'paciente';

  SELECT COALESCE(SUM(valor), 0) INTO total_pago
  FROM public.atendimento_pagamentos
  WHERE atendimento_id = _atendimento_id;

  IF total_cancelados = total_exames AND total_exames > 0 THEN
    novo_status_pg := 'Pagamento cancelado';
  ELSIF ativos = 0 THEN
    novo_status_pg := 'Pagamento efetuado';
  ELSIF total_valor_paciente = 0 THEN
    novo_status_pg := 'Pagamento efetuado';
  ELSIF total_pago > 0 AND total_pago >= total_valor_paciente THEN
    novo_status_pg := 'Pagamento efetuado';
  ELSIF total_pago > 0 AND total_pago < total_valor_paciente THEN
    novo_status_pg := 'Pagamento parcial';
  ELSE
    novo_status_pg := 'Pagamento pendente';
  END IF;

  UPDATE public.atendimentos
  SET status_atendimento = novo_status_at,
      status_pagamento = novo_status_pg,
      tem_retificacao = (total_retificados_em_curso > 0)
  WHERE id = _atendimento_id;
END;
$function$;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.atendimentos LOOP
    PERFORM public.recompute_atendimento_status(r.id);
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS public.resultados_page(timestamp with time zone, bigint, integer, text, text);
CREATE FUNCTION public.resultados_page(
  _cursor_data timestamp with time zone DEFAULT NULL,
  _cursor_id bigint DEFAULT NULL,
  _limit integer DEFAULT 50,
  _status text DEFAULT NULL,
  _busca text DEFAULT NULL
)
 RETURNS TABLE(id bigint, protocolo text, paciente_nome text, paciente_nascimento date, solicitante text, status_resultado text, motivo_cancelamento text, data timestamp with time zone, tem_retificacao boolean)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT
    a.id, a.protocolo, a.paciente_nome, a.paciente_nascimento, a.solicitante,
    a.status_atendimento AS status_resultado, a.motivo_cancelamento, a.data, a.tem_retificacao
  FROM public.atendimentos a
  WHERE a.tenant_id = public.current_tenant_id()
    AND (_status IS NULL OR a.status_atendimento = _status)
    AND (_busca IS NULL OR lower(a.paciente_nome) LIKE '%' || lower(_busca) || '%' OR lower(a.protocolo) LIKE '%' || lower(_busca) || '%')
    AND (_cursor_data IS NULL OR (a.data, a.id) < (_cursor_data, COALESCE(_cursor_id, 9223372036854775807)))
  ORDER BY a.data DESC, a.id DESC
  LIMIT GREATEST(1, LEAST(_limit, 200));
$function$;

DROP FUNCTION IF EXISTS public.atendimentos_page(text, text, text, text, timestamp with time zone, bigint, integer);
CREATE FUNCTION public.atendimentos_page(
  _status text DEFAULT NULL,
  _pagamento text DEFAULT NULL,
  _unidade_id text DEFAULT NULL,
  _q text DEFAULT NULL,
  _cursor_data timestamp with time zone DEFAULT NULL,
  _cursor_id bigint DEFAULT NULL,
  _page_size integer DEFAULT 50
)
 RETURNS TABLE(id bigint, protocolo text, data timestamp with time zone, paciente_nome text, paciente_cpf text, paciente_nascimento date, solicitante text, convenio_id integer, convenio_nome text, unidade_id text, status_atendimento text, status_pagamento text, motivo_cancelamento text, updated_at timestamp with time zone, tem_retificacao boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant uuid := public.current_tenant_id();
  v_q text := NULLIF(lower(trim(COALESCE(_q,''))), '');
  v_size int := LEAST(GREATEST(COALESCE(_page_size, 50), 10), 200);
BEGIN
  IF v_tenant IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT a.id, a.protocolo, a.data, a.paciente_nome, a.paciente_cpf,
         a.paciente_nascimento, a.solicitante, a.convenio_id, a.convenio_nome,
         a.unidade_id, a.status_atendimento, a.status_pagamento,
         a.motivo_cancelamento, a.updated_at, a.tem_retificacao
    FROM public.atendimentos a
   WHERE a.tenant_id = v_tenant
     AND (_status IS NULL OR _status = 'Todos' OR a.status_atendimento = _status)
     AND (_pagamento IS NULL OR _pagamento = 'Todos' OR a.status_pagamento = _pagamento)
     AND (_unidade_id IS NULL OR _unidade_id = 'Todos' OR a.unidade_id = _unidade_id)
     AND (v_q IS NULL OR lower(a.paciente_nome) LIKE '%' || v_q || '%' OR lower(a.protocolo) LIKE '%' || v_q || '%')
     AND (_cursor_data IS NULL OR _cursor_id IS NULL OR (a.data, a.id) < (_cursor_data, _cursor_id))
   ORDER BY a.data DESC, a.id DESC
   LIMIT v_size;
END;
$function$;