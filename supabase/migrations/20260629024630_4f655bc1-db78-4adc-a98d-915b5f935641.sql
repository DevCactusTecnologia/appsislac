-- Função de teste automatizado para a RPC update_atendimento_tx.
-- SECURITY DEFINER (owner=postgres) para que possa ser chamada de qualquer role
-- e ainda assim ter acesso a auth.uid() / schema auth internamente.
CREATE OR REPLACE FUNCTION public.__test_update_atendimento_tx_state(
  _admin_uid uuid DEFAULT '295844d7-22ad-417b-bd33-4871adcb4187'::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','extensions'
AS $fn$
DECLARE
  v_tenant     uuid;
  v_at_id      bigint;
  v_protocolo  text := 'TEST-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSUS');

  v_id_a bigint; v_id_b bigint; v_id_c bigint;
  v_grupo_b uuid; v_grupo_c uuid;
  v_dt_coleta_b  timestamptz;
  v_dt_analise_c timestamptz;
  v_resultados_c jsonb;

  v_payload jsonb;
  v_count   int;
  v_status  text;
  v_result  jsonb := '[]'::jsonb;
BEGIN
  -- Garante que auth.uid() (chamado dentro da RPC alvo) resolva para o admin.
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', _admin_uid::text, 'role','authenticated')::text,
    true);

  SELECT tenant_id INTO v_tenant FROM public.profiles WHERE user_id = _admin_uid;
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Admin de teste sem tenant_id: %', _admin_uid;
  END IF;

  -- ─── Sub-transação: tudo aqui é revertido pelo RAISE final ───
  BEGIN
    -- ── Setup ──
    INSERT INTO public.atendimentos(
      tenant_id, protocolo, paciente_nome, paciente_cpf, paciente_nascimento,
      solicitante, convenio_id, convenio_nome, unidade_id,
      status_atendimento, status_pagamento
    ) VALUES (
      v_tenant, v_protocolo, 'PACIENTE TESTE', '00000000000', '1990-01-01',
      'DR ORIGINAL', 0, 'Particular', 'und-001',
      'Em coleta', 'Pago'
    ) RETURNING id INTO v_at_id;

    INSERT INTO public.atendimento_exames(
      tenant_id, atendimento_id, nome_exame, status, valor, ordem,
      cobranca_destino, amostra_seq, grupo_exame_id, tipo_processo, solicitante
    ) VALUES (
      v_tenant, v_at_id, 'HEMOGRAMA', 'pendente', 30, 1,
      'paciente', 1, gen_random_uuid(), 'INTERNO', 'DR ORIGINAL'
    ) RETURNING id INTO v_id_a;

    INSERT INTO public.atendimento_exames(
      tenant_id, atendimento_id, nome_exame, status, valor, ordem,
      cobranca_destino, amostra_seq, grupo_exame_id, tipo_processo, solicitante,
      coletor, data_coleta
    ) VALUES (
      v_tenant, v_at_id, 'GLICEMIA', 'coletado', 20, 2,
      'paciente', 1, gen_random_uuid(), 'INTERNO', 'DR ORIGINAL',
      'COLETOR JOAO', now() - interval '2 hours'
    ) RETURNING id, grupo_exame_id, data_coleta INTO v_id_b, v_grupo_b, v_dt_coleta_b;

    INSERT INTO public.atendimento_exames(
      tenant_id, atendimento_id, nome_exame, status, valor, ordem,
      cobranca_destino, amostra_seq, grupo_exame_id, tipo_processo, solicitante,
      coletor, data_coleta, analista, data_analise, resultados
    ) VALUES (
      v_tenant, v_at_id, 'COLESTEROL', 'analisado', 25, 3,
      'paciente', 1, gen_random_uuid(), 'INTERNO', 'DR ORIGINAL',
      'COLETOR JOAO', now() - interval '2 hours',
      'ANALISTA MARIA', now() - interval '30 minutes',
      '{"COL":"180","HDL":"45"}'::jsonb
    ) RETURNING id, grupo_exame_id, data_analise, resultados
          INTO v_id_c, v_grupo_c, v_dt_analise_c, v_resultados_c;

    -- ── Cenário 1: editar cabeçalho (solicitante) reenviando a mesma lista ──
    v_payload := jsonb_build_array(
      jsonb_build_object('nome_exame','HEMOGRAMA',  'valor',30,'ordem',1,'cobranca_destino','paciente'),
      jsonb_build_object('nome_exame','GLICEMIA',   'valor',20,'ordem',2,'cobranca_destino','paciente'),
      jsonb_build_object('nome_exame','COLESTEROL', 'valor',25,'ordem',3,'cobranca_destino','paciente')
    );
    PERFORM public.update_atendimento_tx(
      _atendimento_id := v_at_id,
      _patch := jsonb_build_object('solicitante','DR NOVO'),
      _exames := v_payload
    );

    -- IDs preservados
    PERFORM 1 FROM public.atendimento_exames
      WHERE id=v_id_a AND status='pendente';
    IF NOT FOUND THEN RAISE EXCEPTION 'C1: exame A perdeu identidade/status'; END IF;

    PERFORM 1 FROM public.atendimento_exames
      WHERE id=v_id_b AND status='coletado'
        AND data_coleta=v_dt_coleta_b
        AND coletor='COLETOR JOAO'
        AND grupo_exame_id=v_grupo_b;
    IF NOT FOUND THEN RAISE EXCEPTION 'C1: exame B (coletado) teve estado alterado'; END IF;

    PERFORM 1 FROM public.atendimento_exames
      WHERE id=v_id_c AND status='analisado'
        AND data_analise=v_dt_analise_c
        AND analista='ANALISTA MARIA'
        AND resultados=v_resultados_c
        AND grupo_exame_id=v_grupo_c;
    IF NOT FOUND THEN RAISE EXCEPTION 'C1: exame C (analisado) perdeu resultados/analista'; END IF;

    PERFORM 1 FROM public.atendimentos WHERE id=v_at_id AND solicitante='DR NOVO';
    IF NOT FOUND THEN RAISE EXCEPTION 'C1: patch de solicitante não foi aplicado'; END IF;

    v_result := v_result || jsonb_build_object('cenario','editar_cabecalho','ok',true);

    -- ── Cenário 2: ADICIONAR um exame novo ──
    v_payload := v_payload || jsonb_build_array(
      jsonb_build_object('nome_exame','TGO','valor',18,'ordem',4,'cobranca_destino','paciente')
    );
    PERFORM public.update_atendimento_tx(
      _atendimento_id := v_at_id,
      _exames := v_payload
    );

    SELECT count(*) INTO v_count FROM public.atendimento_exames WHERE atendimento_id=v_at_id;
    IF v_count <> 4 THEN RAISE EXCEPTION 'C2: esperava 4 exames, achou %', v_count; END IF;

    SELECT status INTO v_status FROM public.atendimento_exames
      WHERE atendimento_id=v_at_id AND ordem=4 AND nome_exame='TGO';
    IF v_status <> 'pendente' THEN RAISE EXCEPTION 'C2: TGO novo deveria ser pendente, é %', v_status; END IF;

    PERFORM 1 FROM public.atendimento_exames
      WHERE id=v_id_b AND status='coletado' AND data_coleta=v_dt_coleta_b;
    IF NOT FOUND THEN RAISE EXCEPTION 'C2: exame B perdeu estado após adição'; END IF;
    PERFORM 1 FROM public.atendimento_exames
      WHERE id=v_id_c AND status='analisado' AND resultados=v_resultados_c;
    IF NOT FOUND THEN RAISE EXCEPTION 'C2: exame C perdeu estado após adição'; END IF;

    v_result := v_result || jsonb_build_object('cenario','adicionar_exame','ok',true);

    -- ── Cenário 3: REMOVER o exame A ──
    v_payload := jsonb_build_array(
      jsonb_build_object('nome_exame','GLICEMIA',   'valor',20,'ordem',2,'cobranca_destino','paciente'),
      jsonb_build_object('nome_exame','COLESTEROL', 'valor',25,'ordem',3,'cobranca_destino','paciente'),
      jsonb_build_object('nome_exame','TGO',        'valor',18,'ordem',4,'cobranca_destino','paciente')
    );
    PERFORM public.update_atendimento_tx(
      _atendimento_id := v_at_id,
      _exames := v_payload
    );

    SELECT count(*) INTO v_count FROM public.atendimento_exames WHERE atendimento_id=v_at_id;
    IF v_count <> 3 THEN RAISE EXCEPTION 'C3: esperava 3 exames após remoção, achou %', v_count; END IF;

    PERFORM 1 FROM public.atendimento_exames WHERE id=v_id_a;
    IF FOUND THEN RAISE EXCEPTION 'C3: exame A (id=%) deveria ter sido removido', v_id_a; END IF;

    PERFORM 1 FROM public.atendimento_exames
      WHERE id=v_id_b AND status='coletado' AND data_coleta=v_dt_coleta_b;
    IF NOT FOUND THEN RAISE EXCEPTION 'C3: exame B perdeu estado após remover A'; END IF;
    PERFORM 1 FROM public.atendimento_exames
      WHERE id=v_id_c AND status='analisado' AND resultados=v_resultados_c;
    IF NOT FOUND THEN RAISE EXCEPTION 'C3: exame C perdeu estado após remover A'; END IF;

    v_result := v_result || jsonb_build_object('cenario','remover_exame','ok',true);

    -- Sentinela: força rollback do bloco (savepoint implícito) — nada persiste.
    RAISE EXCEPTION 'TEST_OK_ROLLBACK' USING DETAIL = v_result::text;

  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM = 'TEST_OK_ROLLBACK' THEN
        RETURN jsonb_build_object(
          'ok', true,
          'scenarios', v_result,
          'message', 'Todos os cenários passaram. Estado clínico preservado.'
        );
      END IF;
      -- Falha real: re-raise mantendo a mensagem.
      RAISE;
  END;
END
$fn$;

-- Só super-admins humanos / postgres devem rodar isto. Sem grants para anon/authenticated.
REVOKE ALL ON FUNCTION public.__test_update_atendimento_tx_state(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.__test_update_atendimento_tx_state(uuid) TO service_role;