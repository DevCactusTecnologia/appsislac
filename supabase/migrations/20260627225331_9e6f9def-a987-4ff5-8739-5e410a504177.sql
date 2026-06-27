CREATE OR REPLACE FUNCTION public.update_atendimento_exames_cobranca_tx(
  _atendimento_id bigint,
  _exames jsonb,
  _justificativa text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_tenant uuid;
  v_at_tenant uuid;
  v_uid uuid := auth.uid();
  v_exame jsonb;
  v_row_id bigint;
  v_ordem int;
  v_count int := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  v_tenant := public.current_tenant_id();
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Usuário sem tenant associado' USING ERRCODE = '42501';
  END IF;

  IF NOT (
    public.has_role(v_uid, 'admin'::app_role)
    OR public.has_role(v_uid, 'super_admin'::app_role)
    OR public.has_permission(v_uid, 'registrar_pagamento')
    OR public.has_permission(v_uid, 'editar_atendimento')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para alterar cobrança de exames' USING ERRCODE = '42501';
  END IF;

  SELECT tenant_id INTO v_at_tenant
    FROM public.atendimentos
   WHERE id = _atendimento_id;

  IF v_at_tenant IS NULL THEN
    RAISE EXCEPTION 'Atendimento % não encontrado', _atendimento_id USING ERRCODE = '42704';
  END IF;

  IF v_at_tenant <> v_tenant THEN
    RAISE EXCEPTION 'Atendimento de outro tenant' USING ERRCODE = '42501';
  END IF;

  IF _justificativa IS NOT NULL AND length(trim(_justificativa)) >= 5 THEN
    PERFORM public.set_audit_justificativa(_justificativa);
  END IF;

  IF _exames IS NULL OR jsonb_typeof(_exames) <> 'array' THEN
    RAISE EXCEPTION 'exames deve ser array' USING ERRCODE = '22023';
  END IF;

  FOR v_exame IN SELECT * FROM jsonb_array_elements(_exames)
  LOOP
    v_row_id := NULLIF(v_exame->>'atendimento_exame_id','')::bigint;
    v_ordem := NULLIF(v_exame->>'ordem','')::int;

    IF v_row_id IS NULL AND v_ordem IS NOT NULL THEN
      SELECT id INTO v_row_id
        FROM public.atendimento_exames
       WHERE atendimento_id = _atendimento_id
         AND tenant_id = v_tenant
         AND ordem = v_ordem
       LIMIT 1;
    END IF;

    IF v_row_id IS NULL THEN
      CONTINUE;
    END IF;

    UPDATE public.atendimento_exames
       SET valor = COALESCE((v_exame->>'valor')::numeric, valor),
           valor_original = COALESCE((v_exame->>'valor_original')::numeric, valor_original, (v_exame->>'valor')::numeric, 0),
           cobranca_destino = COALESCE(NULLIF(v_exame->>'cobranca_destino',''), cobranca_destino),
           convenio_cobranca_id = NULLIF(v_exame->>'convenio_cobranca_id','')::int
     WHERE id = v_row_id
       AND atendimento_id = _atendimento_id
       AND tenant_id = v_tenant;

    IF FOUND THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;

  PERFORM public.recompute_atendimento_status(_atendimento_id);

  RETURN jsonb_build_object(
    'ok', true,
    'atendimento_id', _atendimento_id,
    'count_exames_cobranca', v_count
  );
END;
$function$;