CREATE OR REPLACE FUNCTION public.atendimentos_page(
  _status text DEFAULT NULL,
  _pagamento text DEFAULT NULL,
  _unidade_id text DEFAULT NULL,
  _q text DEFAULT NULL,
  _cursor_data timestamptz DEFAULT NULL,
  _cursor_id bigint DEFAULT NULL,
  _page_size integer DEFAULT 50
)
RETURNS TABLE(
  id bigint, protocolo text, data timestamptz, paciente_nome text, paciente_cpf text,
  paciente_nascimento date, solicitante text, convenio_id integer, convenio_nome text,
  unidade_id text, status_atendimento text, status_pagamento text,
  motivo_cancelamento text, updated_at timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
       OR lower(a.paciente_nome) LIKE '%' || v_q || '%'
       OR lower(a.protocolo)     LIKE '%' || v_q || '%'
     )
     AND (
       _cursor_data IS NULL OR _cursor_id IS NULL
       OR (a.data, a.id) < (_cursor_data, _cursor_id)
     )
   ORDER BY a.data DESC, a.id DESC
   LIMIT v_size;
END;
$function$;

REVOKE ALL ON FUNCTION public.atendimentos_page(text,text,text,text,timestamptz,bigint,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.atendimentos_page(text,text,text,text,timestamptz,bigint,integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.atendimentos_page(text,text,text,text,timestamptz,bigint,integer) TO authenticated;