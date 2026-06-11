CREATE OR REPLACE FUNCTION public.create_atendimento_tx(_atendimento jsonb, _exames jsonb, _pagamentos jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_my_tenant   uuid;
  v_at_id       bigint;
  v_protocolo   text;
  v_exame       jsonb;
  v_pag         jsonb;
  v_count_ex    int := 0;
  v_count_pg    int := 0;
BEGIN
  v_my_tenant := public.current_tenant_id();
  IF v_my_tenant IS NULL THEN
    RAISE EXCEPTION 'Usuário sem tenant associado' USING ERRCODE = '42501';
  END IF;

  IF _atendimento IS NULL OR _atendimento = '{}'::jsonb THEN
    RAISE EXCEPTION 'Payload de atendimento vazio' USING ERRCODE = '22023';
  END IF;
  IF NULLIF(_atendimento->>'paciente_nome','') IS NULL THEN
    RAISE EXCEPTION 'paciente_nome obrigatório' USING ERRCODE = '22023';
  END IF;
  -- CPF é opcional: atendimento pode ser criado sem CPF.

  INSERT INTO public.atendimentos(
    tenant_id, protocolo, data,
    paciente_id, paciente_nome, paciente_cpf, paciente_nascimento,
    solicitante, convenio_id, convenio_nome, unidade_id,
    motivo_cancelamento
  ) VALUES (
    v_my_tenant,
    COALESCE(NULLIF(_atendimento->>'protocolo',''), 'TMP'),
    COALESCE(NULLIF(_atendimento->>'data','')::timestamptz, now()),
    NULLIF(_atendimento->>'paciente_id','')::bigint,
    _atendimento->>'paciente_nome',
    COALESCE(_atendimento->>'paciente_cpf',''),
    NULLIF(_atendimento->>'paciente_nascimento','')::date,
    COALESCE(_atendimento->>'solicitante',''),
    COALESCE((_atendimento->>'convenio_id')::int, 0),
    COALESCE(_atendimento->>'convenio_nome','Particular'),
    COALESCE(_atendimento->>'unidade_id','und-001'),
    NULLIF(_atendimento->>'motivo_cancelamento','')
  )
  RETURNING id, protocolo INTO v_at_id, v_protocolo;

  IF _exames IS NOT NULL AND jsonb_array_length(_exames) > 0 THEN
    FOR v_exame IN SELECT * FROM jsonb_array_elements(_exames)
    LOOP
      IF NULLIF(v_exame->>'nome_exame','') IS NULL THEN
        RAISE EXCEPTION 'exame.nome_exame obrigatório' USING ERRCODE = '22023';
      END IF;
      INSERT INTO public.atendimento_exames(
        tenant_id, atendimento_id, nome_exame, exame_id, material,
        status, valor, ordem,
        cobranca_destino, convenio_cobranca_id,
        amostra_seq, grupo_exame_id, tipo_processo, lab_apoio_id,
        solicitante
      ) VALUES (
        v_my_tenant,
        v_at_id,
        v_exame->>'nome_exame',
        NULLIF(v_exame->>'exame_id','')::uuid,
        COALESCE(v_exame->>'material',''),
        COALESCE(v_exame->>'status','pendente'),
        COALESCE((v_exame->>'valor')::numeric, 0),
        COALESCE((v_exame->>'ordem')::int, 0),
        COALESCE(v_exame->>'cobranca_destino','paciente'),
        NULLIF(v_exame->>'convenio_cobranca_id','')::int,
        COALESCE((v_exame->>'amostra_seq')::int, 1),
        COALESCE(NULLIF(v_exame->>'grupo_exame_id','')::uuid, gen_random_uuid()),
        COALESCE(v_exame->>'tipo_processo','INTERNO'),
        NULLIF(v_exame->>'lab_apoio_id','')::uuid,
        COALESCE(v_exame->>'solicitante','')
      );
      v_count_ex := v_count_ex + 1;
    END LOOP;
  END IF;

  IF _pagamentos IS NOT NULL AND jsonb_array_length(_pagamentos) > 0 THEN
    FOR v_pag IN SELECT * FROM jsonb_array_elements(_pagamentos)
    LOOP
      IF NULLIF(v_pag->>'tipo','') IS NULL THEN
        RAISE EXCEPTION 'pagamento.tipo obrigatório' USING ERRCODE = '22023';
      END IF;
      INSERT INTO public.atendimento_pagamentos(
        tenant_id, atendimento_id, tipo, valor, data
      ) VALUES (
        v_my_tenant,
        v_at_id,
        v_pag->>'tipo',
        COALESCE((v_pag->>'valor')::numeric, 0),
        COALESCE(NULLIF(v_pag->>'data','')::timestamptz, now())
      );
      v_count_pg := v_count_pg + 1;
    END LOOP;
  END IF;

  PERFORM public.recompute_atendimento_status(v_at_id);

  RETURN jsonb_build_object(
    'ok', true,
    'atendimento_id', v_at_id,
    'protocolo', v_protocolo,
    'exames_inseridos', v_count_ex,
    'pagamentos_inseridos', v_count_pg
  );
END;
$function$;