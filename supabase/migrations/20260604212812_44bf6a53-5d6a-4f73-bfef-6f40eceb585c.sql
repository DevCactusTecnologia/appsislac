-- Dropa todas as versões conhecidas para evitar conflito de "not unique"
DROP FUNCTION IF EXISTS public.update_atendimento_tx(bigint, jsonb, jsonb, jsonb);
DROP FUNCTION IF EXISTS public.update_atendimento_tx(bigint, jsonb, jsonb, jsonb, boolean, text);
DROP FUNCTION IF EXISTS public.update_atendimento_tx(bigint, jsonb, jsonb, jsonb, boolean, text, text);

-- Cria a versão definitiva
CREATE OR REPLACE FUNCTION public.update_atendimento_tx(
  _atendimento_id bigint,
  _patch jsonb DEFAULT '{}'::jsonb,
  _exames jsonb DEFAULT NULL,
  _pagamentos jsonb DEFAULT NULL,
  _cancelar_tudo boolean DEFAULT false,
  _motivo_cancel text DEFAULT NULL,
  _justificativa text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_tenant      uuid;
  v_at_tenant   uuid;
  v_exame       jsonb;
  v_pag         jsonb;
  v_count_ex    int := 0;
  v_count_pg    int := 0;
  v_uid         uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  v_tenant := public.current_tenant_id();
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Usuário sem tenant associado' USING ERRCODE = '42501';
  END IF;

  -- 0) Seta justificativa para triggers (auditoria)
  IF _justificativa IS NOT NULL THEN
    PERFORM public.set_audit_justificativa(_justificativa);
  END IF;

  -- Verifica permissão: admin OU has_permission('atendimentos')
  -- Adicionada permissão específica para registrar_pagamento quando for apenas pagamento
  IF NOT (
    public.has_role(v_uid, 'admin'::app_role)
    OR public.has_role(v_uid, 'super_admin'::app_role)
    OR public.has_permission(v_uid, 'atendimentos')
    OR (_patch = '{}'::jsonb AND _exames IS NULL AND _pagamentos IS NOT NULL AND public.has_permission(v_uid, 'registrar_pagamento'))
  ) THEN
    RAISE EXCEPTION 'Sem permissão para alterar atendimentos' USING ERRCODE = '42501';
  END IF;

  SELECT tenant_id INTO v_at_tenant FROM public.atendimentos WHERE id = _atendimento_id;
  IF v_at_tenant IS NULL THEN
    RAISE EXCEPTION 'Atendimento não encontrado' USING ERRCODE = '22023';
  END IF;
  IF v_at_tenant <> v_tenant AND NOT public.is_super_admin(v_uid) THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  IF _patch IS NOT NULL AND _patch <> '{}'::jsonb THEN
    UPDATE public.atendimentos SET
      data                = COALESCE(NULLIF(_patch->>'data','')::timestamptz, data),
      paciente_id         = COALESCE(NULLIF(_patch->>'paciente_id','')::bigint, paciente_id),
      paciente_nome       = COALESCE(_patch->>'paciente_nome', paciente_nome),
      paciente_cpf        = COALESCE(_patch->>'paciente_cpf', paciente_cpf),
      paciente_nascimento = COALESCE(NULLIF(_patch->>'paciente_nascimento','')::date, paciente_nascimento),
      solicitante         = COALESCE(_patch->>'solicitante', solicitante),
      convenio_id         = COALESCE((_patch->>'convenio_id')::int, convenio_id),
      convenio_nome       = COALESCE(_patch->>'convenio_nome', convenio_nome),
      unidade_id          = COALESCE(_patch->>'unidade_id', unidade_id),
      motivo_cancelamento = CASE WHEN _patch ? 'motivo_cancelamento'
                                 THEN NULLIF(_patch->>'motivo_cancelamento','')
                                 ELSE motivo_cancelamento END
    WHERE id = _atendimento_id;
  END IF;

  IF _exames IS NOT NULL THEN
    DELETE FROM public.atendimento_exames WHERE atendimento_id = _atendimento_id;
    FOR v_exame IN SELECT * FROM jsonb_array_elements(_exames)
    LOOP
      INSERT INTO public.atendimento_exames(
        tenant_id, atendimento_id, nome_exame, exame_id, material,
        status, valor, ordem, motivo_cancelamento,
        cobranca_destino, convenio_cobranca_id,
        amostra_seq, grupo_exame_id, tipo_processo, lab_apoio_id,
        solicitante
      ) VALUES (
        v_tenant, _atendimento_id,
        v_exame->>'nome_exame',
        NULLIF(v_exame->>'exame_id','')::uuid,
        COALESCE(v_exame->>'material',''),
        COALESCE(v_exame->>'status','pendente'),
        COALESCE((v_exame->>'valor')::numeric, 0),
        COALESCE((v_exame->>'ordem')::int, 0),
        NULLIF(v_exame->>'motivo_cancelamento',''),
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

  IF _pagamentos IS NOT NULL THEN
    DELETE FROM public.atendimento_pagamentos WHERE atendimento_id = _atendimento_id;
    FOR v_pag IN SELECT * FROM jsonb_array_elements(_pagamentos)
    LOOP
      IF NULLIF(v_pag->>'tipo','') IS NULL THEN
        RAISE EXCEPTION 'pagamento.tipo obrigatório' USING ERRCODE = '22023';
      END IF;
      INSERT INTO public.atendimento_pagamentos(
        tenant_id, atendimento_id, tipo, valor, data
      ) VALUES (
        v_tenant, _atendimento_id,
        v_pag->>'tipo',
        COALESCE((v_pag->>'valor')::numeric, 0),
        COALESCE(NULLIF(v_pag->>'data','')::timestamptz, now())
      );
      v_count_pg := v_count_pg + 1;
    END LOOP;
  END IF;

  IF _cancelar_tudo THEN
    UPDATE public.atendimentos SET
      status_atendimento = 'Cancelado',
      motivo_cancelamento = COALESCE(_motivo_cancel, motivo_cancelamento)
    WHERE id = _atendimento_id;
    
    UPDATE public.atendimento_exames SET
      status = 'cancelado',
      motivo_cancelamento = COALESCE(_motivo_cancel, motivo_cancelamento)
    WHERE atendimento_id = _atendimento_id;
  END IF;

  PERFORM public.recompute_atendimento_status(_atendimento_id);

  RETURN jsonb_build_object(
    'ok', true,
    'atendimento_id', _atendimento_id,
    'count_exames', v_count_ex,
    'count_pagamentos', v_count_pg
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_atendimento_tx TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_atendimento_tx TO service_role;
