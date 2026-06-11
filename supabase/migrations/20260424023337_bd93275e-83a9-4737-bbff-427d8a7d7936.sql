-- create_atendimento_tx: insere atendimento + exames + pagamentos atomicamente
-- Mesmo padrão de update_atendimento_tx: tenant validado, BEGIN/COMMIT/ROLLBACK
-- gerenciados pelo PostgreSQL.
CREATE OR REPLACE FUNCTION public.create_atendimento_tx(
  _atendimento jsonb,
  _exames jsonb,
  _pagamentos jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  -- 1) Tenant do usuário autenticado (a função já é STABLE/SECURITY DEFINER)
  v_my_tenant := public.current_tenant_id();
  IF v_my_tenant IS NULL THEN
    RAISE EXCEPTION 'Usuário sem tenant associado'
      USING ERRCODE = '42501';
  END IF;

  -- 2) Validação básica do payload de atendimento
  IF _atendimento IS NULL OR _atendimento = '{}'::jsonb THEN
    RAISE EXCEPTION 'Payload de atendimento vazio'
      USING ERRCODE = '22023';
  END IF;
  IF NULLIF(_atendimento->>'paciente_nome','') IS NULL THEN
    RAISE EXCEPTION 'paciente_nome obrigatório'
      USING ERRCODE = '22023';
  END IF;
  IF NULLIF(_atendimento->>'paciente_cpf','') IS NULL THEN
    RAISE EXCEPTION 'paciente_cpf obrigatório'
      USING ERRCODE = '22023';
  END IF;

  -- 3) Insere atendimento (protocolo + assinatura são gerados via triggers).
  --    O cliente envia 'protocolo' apenas como placeholder; a trigger
  --    atendimento_assign_protocolo sobrescreve com o oficial.
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
    _atendimento->>'paciente_cpf',
    NULLIF(_atendimento->>'paciente_nascimento','')::date,
    COALESCE(_atendimento->>'solicitante',''),
    COALESCE((_atendimento->>'convenio_id')::int, 0),
    COALESCE(_atendimento->>'convenio_nome','Particular'),
    COALESCE(_atendimento->>'unidade_id','und-001'),
    NULLIF(_atendimento->>'motivo_cancelamento','')
  )
  RETURNING id, protocolo INTO v_at_id, v_protocolo;

  -- 4) Insere exames (se houver)
  IF _exames IS NOT NULL AND jsonb_array_length(_exames) > 0 THEN
    FOR v_exame IN SELECT * FROM jsonb_array_elements(_exames)
    LOOP
      IF NULLIF(v_exame->>'nome_exame','') IS NULL THEN
        RAISE EXCEPTION 'exame.nome_exame obrigatório'
          USING ERRCODE = '22023';
      END IF;
      INSERT INTO public.atendimento_exames(
        tenant_id, atendimento_id, nome_exame, exame_id, material,
        status, valor, ordem,
        cobranca_destino, convenio_cobranca_id,
        amostra_seq, grupo_exame_id, tipo_processo, lab_apoio_id
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
        NULLIF(v_exame->>'lab_apoio_id','')::uuid
      );
      v_count_ex := v_count_ex + 1;
    END LOOP;
  END IF;

  -- 5) Insere pagamentos (se houver)
  IF _pagamentos IS NOT NULL AND jsonb_array_length(_pagamentos) > 0 THEN
    FOR v_pag IN SELECT * FROM jsonb_array_elements(_pagamentos)
    LOOP
      IF NULLIF(v_pag->>'tipo','') IS NULL THEN
        RAISE EXCEPTION 'pagamento.tipo obrigatório'
          USING ERRCODE = '22023';
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

  -- 6) Recompute para garantir status_atendimento/pagamento corretos
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

REVOKE ALL ON FUNCTION public.create_atendimento_tx(jsonb, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_atendimento_tx(jsonb, jsonb, jsonb) TO authenticated;