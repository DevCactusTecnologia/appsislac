-- Corrige update_atendimento_tx: substitui DELETE+INSERT em atendimento_exames
-- por MERGE in-place (UPDATE por ordem, INSERT para novos, DELETE só para removidos).
-- Preserva status clínico (coleta/análise/resultado), grupo_exame_id, amostra_seq
-- e principalmente o `id` PK referenciado por amostras, resultados e auditorias.
CREATE OR REPLACE FUNCTION public.update_atendimento_tx(
  _atendimento_id bigint,
  _patch jsonb DEFAULT '{}'::jsonb,
  _exames jsonb DEFAULT NULL::jsonb,
  _pagamentos jsonb DEFAULT NULL::jsonb,
  _cancelar_tudo boolean DEFAULT false,
  _motivo_cancel text DEFAULT NULL::text,
  _justificativa text DEFAULT NULL::text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_tenant      uuid;
  v_at_tenant   uuid;
  v_exame       jsonb;
  v_pag         jsonb;
  v_count_ex    int := 0;
  v_count_pg    int := 0;
  v_uid         uuid := auth.uid();
  v_material_nome text;
  v_material_id   uuid;
  v_incoming_ordens int[];
  v_existing_id   bigint;
  v_existing_status text;
  v_existing_grupo  uuid;
  v_existing_seq    int;
  v_ordem        int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  v_tenant := public.current_tenant_id();
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Usuário sem tenant associado' USING ERRCODE = '42501';
  END IF;

  IF _justificativa IS NOT NULL THEN
    PERFORM public.set_audit_justificativa(_justificativa);
  END IF;

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
    RAISE EXCEPTION 'Atendimento % não encontrado', _atendimento_id USING ERRCODE = '42704';
  END IF;
  IF v_at_tenant <> v_tenant THEN
    RAISE EXCEPTION 'Atendimento de outro tenant' USING ERRCODE = '42501';
  END IF;

  -- Patch escalar de atendimentos (inalterado)
  IF _patch IS NOT NULL AND _patch <> '{}'::jsonb THEN
    UPDATE public.atendimentos a SET
      paciente_nome       = COALESCE(NULLIF(_patch->>'paciente_nome',''), a.paciente_nome),
      paciente_cpf        = COALESCE(NULLIF(_patch->>'paciente_cpf',''),  a.paciente_cpf),
      paciente_nascimento = COALESCE((_patch->>'paciente_nascimento')::date, a.paciente_nascimento),
      solicitante         = COALESCE(_patch->>'solicitante', a.solicitante),
      convenio_id         = COALESCE((_patch->>'convenio_id')::int, a.convenio_id),
      convenio_nome       = COALESCE(_patch->>'convenio_nome', a.convenio_nome),
      unidade_id          = COALESCE(_patch->>'unidade_id', a.unidade_id),
      status_atendimento  = COALESCE(_patch->>'status_atendimento', a.status_atendimento),
      status_pagamento    = COALESCE(_patch->>'status_pagamento', a.status_pagamento),
      motivo_cancelamento = COALESCE(_patch->>'motivo_cancelamento', a.motivo_cancelamento),
      guia_numero         = COALESCE(_patch->>'guia_numero', a.guia_numero),
      guia_data           = COALESCE((_patch->>'guia_data')::date, a.guia_data)
    WHERE a.id = _atendimento_id;
  END IF;

  -- ──────────────────────────────────────────────────────────────────
  -- MERGE de atendimento_exames (preserva estado clínico e PKs)
  -- ──────────────────────────────────────────────────────────────────
  IF _exames IS NOT NULL THEN
    v_incoming_ordens := ARRAY[]::int[];

    FOR v_exame IN SELECT * FROM jsonb_array_elements(_exames)
    LOOP
      v_count_ex := v_count_ex + 1;
      v_ordem := COALESCE((v_exame->>'ordem')::int, v_count_ex);
      v_incoming_ordens := array_append(v_incoming_ordens, v_ordem);

      v_material_nome := NULLIF(v_exame->>'material','');
      v_material_id := NULL;
      IF v_material_nome IS NOT NULL THEN
        SELECT id INTO v_material_id
          FROM public.materiais_amostra
         WHERE tenant_id = v_tenant
           AND lower(nome) = lower(v_material_nome)
         LIMIT 1;
      END IF;

      -- Procura linha existente pela MESMA ORDEM (ordem é estável: o frontend
      -- envia idx+1 e a ordem original do atendimento).
      SELECT id, status, grupo_exame_id, amostra_seq
        INTO v_existing_id, v_existing_status, v_existing_grupo, v_existing_seq
        FROM public.atendimento_exames
       WHERE atendimento_id = _atendimento_id
         AND ordem = v_ordem
       LIMIT 1;

      IF v_existing_id IS NOT NULL THEN
        -- UPDATE in-place: preserva id (FK das amostras/resultados),
        -- status clínico, grupo_exame_id e amostra_seq. Atualiza só campos
        -- de cobrança e metadados que podem mudar em edição.
        UPDATE public.atendimento_exames SET
          nome_exame           = COALESCE(v_exame->>'nome_exame', nome_exame),
          exame_id             = COALESCE(NULLIF(v_exame->>'exame_id','')::uuid, exame_id),
          material_id          = COALESCE(v_material_id, material_id),
          valor                = COALESCE((v_exame->>'valor')::numeric, valor),
          valor_original       = COALESCE((v_exame->>'valor_original')::numeric, valor_original),
          cobranca_destino     = COALESCE(v_exame->>'cobranca_destino', cobranca_destino),
          convenio_cobranca_id = COALESCE(NULLIF(v_exame->>'convenio_cobranca_id','')::int, convenio_cobranca_id),
          tipo_processo        = COALESCE(v_exame->>'tipo_processo', tipo_processo),
          lab_apoio_id         = CASE
                                   WHEN COALESCE(v_exame->>'tipo_processo', tipo_processo) = 'TERCEIRIZADO'
                                     THEN COALESCE(NULLIF(v_exame->>'lab_apoio_id','')::uuid, lab_apoio_id)
                                   ELSE NULL
                                 END,
          solicitante          = COALESCE(v_exame->>'solicitante', solicitante),
          motivo_cancelamento  = COALESCE(v_exame->>'motivo_cancelamento', motivo_cancelamento),
          -- Status: só sobrescreve se for cancelamento explícito (cancelar_tudo
          -- ou flag vinda no payload). Edições normais NÃO mexem em status.
          status               = CASE
                                   WHEN _cancelar_tudo THEN 'cancelado'
                                   WHEN v_exame->>'status' = 'cancelado' THEN 'cancelado'
                                   ELSE status
                                 END
         WHERE id = v_existing_id;
      ELSE
        -- INSERT: é um exame realmente novo (adicionado nesta edição).
        INSERT INTO public.atendimento_exames(
          tenant_id, atendimento_id, nome_exame, exame_id, material_id, status, valor,
          ordem, motivo_cancelamento, cobranca_destino, convenio_cobranca_id,
          amostra_seq, grupo_exame_id, tipo_processo, lab_apoio_id, solicitante,
          valor_original
        ) VALUES (
          v_tenant,
          _atendimento_id,
          v_exame->>'nome_exame',
          NULLIF(v_exame->>'exame_id','')::uuid,
          v_material_id,
          COALESCE(v_exame->>'status','pendente'),
          COALESCE((v_exame->>'valor')::numeric, 0),
          v_ordem,
          v_exame->>'motivo_cancelamento',
          COALESCE(v_exame->>'cobranca_destino','paciente'),
          NULLIF(v_exame->>'convenio_cobranca_id','')::int,
          COALESCE((v_exame->>'amostra_seq')::int, 1),
          COALESCE(NULLIF(v_exame->>'grupo_exame_id','')::uuid, gen_random_uuid()),
          COALESCE(v_exame->>'tipo_processo','INTERNO'),
          NULLIF(v_exame->>'lab_apoio_id','')::uuid,
          COALESCE(v_exame->>'solicitante',''),
          COALESCE((v_exame->>'valor_original')::numeric, (v_exame->>'valor')::numeric, 0)
        );
      END IF;
    END LOOP;

    -- DELETE somente das linhas cujas ordens não vieram no payload (exames
    -- realmente removidos pelo usuário durante a edição).
    IF array_length(v_incoming_ordens, 1) IS NOT NULL THEN
      DELETE FROM public.atendimento_exames
       WHERE atendimento_id = _atendimento_id
         AND NOT (ordem = ANY(v_incoming_ordens));
    ELSE
      -- payload vazio: usuário removeu todos os exames.
      DELETE FROM public.atendimento_exames WHERE atendimento_id = _atendimento_id;
    END IF;
  END IF;

  -- Pagamentos (inalterado)
  IF _pagamentos IS NOT NULL THEN
    FOR v_pag IN SELECT * FROM jsonb_array_elements(_pagamentos)
    LOOP
      IF NULLIF(v_pag->>'tipo','') IS NULL THEN
        CONTINUE;
      END IF;
      INSERT INTO public.atendimento_pagamentos(
        tenant_id, atendimento_id, tipo, valor, data
      ) VALUES (
        v_tenant,
        _atendimento_id,
        v_pag->>'tipo',
        COALESCE((v_pag->>'valor')::numeric, 0),
        COALESCE((v_pag->>'data')::timestamptz, now())
      );
      v_count_pg := v_count_pg + 1;
    END LOOP;
  END IF;

  IF _cancelar_tudo THEN
    UPDATE public.atendimento_exames
       SET status = 'cancelado',
           motivo_cancelamento = COALESCE(_motivo_cancel, motivo_cancelamento)
     WHERE atendimento_id = _atendimento_id;
    UPDATE public.atendimentos
       SET status_atendimento = 'Cancelado',
           motivo_cancelamento = COALESCE(_motivo_cancel, motivo_cancelamento)
     WHERE id = _atendimento_id;
  END IF;

  PERFORM public.recompute_atendimento_status(_atendimento_id);

  RETURN jsonb_build_object(
    'ok', true,
    'atendimento_id', _atendimento_id,
    'count_exames', v_count_ex,
    'count_pagamentos', v_count_pg
  );
END;
$function$;