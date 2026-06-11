-- RPC transacional para atualização atômica de atendimento.
-- Toda função PL/pgSQL roda em uma única transação implícita:
-- se qualquer statement falhar, TODO o efeito é revertido (ROLLBACK automático).
CREATE OR REPLACE FUNCTION public.update_atendimento_tx(
  _atendimento_id  bigint,
  _patch           jsonb,           -- colunas do atendimento a atualizar
  _exames          jsonb,           -- array de exames OU null (não mexer)
  _pagamentos      jsonb,           -- array de pagamentos OU null (não mexer)
  _cancelar_tudo   boolean DEFAULT false,
  _motivo_cancel   text    DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tenant     uuid;
  v_my_tenant  uuid;
  v_exame      jsonb;
  v_pag        jsonb;
  v_count_ex   int := 0;
  v_count_pg   int := 0;
  v_protocolo  text;
BEGIN
  -- 1) Validação de existência + isolamento multi-tenant
  SELECT tenant_id, protocolo INTO v_tenant, v_protocolo
  FROM public.atendimentos WHERE id = _atendimento_id;

  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Atendimento % não encontrado', _atendimento_id
      USING ERRCODE = '42704';
  END IF;

  v_my_tenant := public.current_tenant_id();
  IF v_my_tenant IS NULL OR v_my_tenant <> v_tenant THEN
    RAISE EXCEPTION 'Acesso negado: tenant divergente'
      USING ERRCODE = '42501';
  END IF;

  -- 2) Update do atendimento (apenas colunas permitidas via jsonb_populate_record-like)
  IF _patch IS NOT NULL AND _patch <> '{}'::jsonb THEN
    UPDATE public.atendimentos SET
      paciente_nome       = COALESCE(_patch->>'paciente_nome', paciente_nome),
      paciente_cpf        = COALESCE(_patch->>'paciente_cpf', paciente_cpf),
      paciente_nascimento = CASE WHEN _patch ? 'paciente_nascimento'
                                 THEN NULLIF(_patch->>'paciente_nascimento','')::date
                                 ELSE paciente_nascimento END,
      solicitante         = COALESCE(_patch->>'solicitante', solicitante),
      convenio_id         = COALESCE((_patch->>'convenio_id')::int, convenio_id),
      convenio_nome       = COALESCE(_patch->>'convenio_nome', convenio_nome),
      unidade_id          = COALESCE(_patch->>'unidade_id', unidade_id),
      motivo_cancelamento = CASE WHEN _patch ? 'motivo_cancelamento'
                                 THEN NULLIF(_patch->>'motivo_cancelamento','')
                                 ELSE motivo_cancelamento END
    WHERE id = _atendimento_id;
  END IF;

  -- 3) Reset transacional de EXAMES (só se array foi enviado)
  IF _exames IS NOT NULL THEN
    DELETE FROM public.atendimento_exames WHERE atendimento_id = _atendimento_id;

    FOR v_exame IN SELECT * FROM jsonb_array_elements(_exames)
    LOOP
      INSERT INTO public.atendimento_exames(
        tenant_id, atendimento_id, nome_exame, exame_id, material,
        status, valor, ordem, motivo_cancelamento,
        cobranca_destino, convenio_cobranca_id,
        amostra_seq, grupo_exame_id, tipo_processo, lab_apoio_id
      ) VALUES (
        v_tenant,
        _atendimento_id,
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
        NULLIF(v_exame->>'lab_apoio_id','')::uuid
      );
      v_count_ex := v_count_ex + 1;
    END LOOP;
  END IF;

  -- 4) Reset transacional de PAGAMENTOS (só se array foi enviado)
  IF _pagamentos IS NOT NULL THEN
    DELETE FROM public.atendimento_pagamentos WHERE atendimento_id = _atendimento_id;

    FOR v_pag IN SELECT * FROM jsonb_array_elements(_pagamentos)
    LOOP
      INSERT INTO public.atendimento_pagamentos(
        tenant_id, atendimento_id, tipo, valor, data
      ) VALUES (
        v_tenant,
        _atendimento_id,
        v_pag->>'tipo',
        COALESCE((v_pag->>'valor')::numeric, 0),
        COALESCE(NULLIF(v_pag->>'data','')::timestamptz, now())
      );
      v_count_pg := v_count_pg + 1;
    END LOOP;
  END IF;

  -- 5) Cancelamento total (se flag): cancela exames remanescentes + remove pagamentos
  IF _cancelar_tudo THEN
    IF _exames IS NULL THEN
      UPDATE public.atendimento_exames
         SET status = 'cancelado',
             motivo_cancelamento = COALESCE(_motivo_cancel, motivo_cancelamento)
       WHERE atendimento_id = _atendimento_id;
    END IF;
    IF _pagamentos IS NULL THEN
      DELETE FROM public.atendimento_pagamentos WHERE atendimento_id = _atendimento_id;
    END IF;
  END IF;

  -- 6) Recomputa status (trigger já faz, mas chamamos para garantir consistência final)
  PERFORM public.recompute_atendimento_status(_atendimento_id);

  RETURN jsonb_build_object(
    'ok', true,
    'atendimento_id', _atendimento_id,
    'protocolo', v_protocolo,
    'exames_inseridos', v_count_ex,
    'pagamentos_inseridos', v_count_pg
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_atendimento_tx(bigint, jsonb, jsonb, jsonb, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_atendimento_tx(bigint, jsonb, jsonb, jsonb, boolean, text) TO authenticated;