-- ============================================================================
-- Teste de integração: update_atendimento_tx NÃO destrói estado clínico
-- ----------------------------------------------------------------------------
-- Garante que ao atualizar campos do cabeçalho (prioridade/jejum/pagamento/
-- solicitante/convênio) OU ao adicionar/remover exames, as linhas existentes
-- em atendimento_exames mantêm:
--   • o mesmo `id` (PK referenciado por amostras/resultados/auditoria)
--   • o `status` clínico (coletado, analisado, finalizado)
--   • os timestamps (data_coleta, data_analise, data_liberacao)
--   • o JSON de `resultados`, `coletor`, `analista`, `grupo_exame_id`,
--     `amostra_seq`, `amostra_id`
-- Exames adicionados aparecem como `pendente`; exames removidos somem da tabela.
--
-- Execução:  psql -v ON_ERROR_STOP=1 -f supabase/tests/update_atendimento_tx_preserves_state.sql
-- O teste roda em transação e termina com ROLLBACK — não polui o banco.
-- ============================================================================

BEGIN;

-- Simula contexto de autenticação de um admin do tenant default.
SET LOCAL "request.jwt.claims" = '{"sub":"295844d7-22ad-417b-bd33-4871adcb4187","role":"authenticated"}';

DO $test$
DECLARE
  v_tenant     uuid := '00000000-0000-0000-0000-000000000001';
  v_at_id      bigint;
  v_protocolo  text := 'TEST-' || to_char(now(), 'YYYYMMDDHH24MISSMS');
  v_amostra_id uuid;

  -- IDs e snapshots originais
  v_id_a bigint; v_id_b bigint; v_id_c bigint;
  v_grupo_a uuid; v_grupo_b uuid; v_grupo_c uuid;
  v_dt_coleta_b  timestamptz;
  v_dt_analise_c timestamptz;
  v_resultados_c jsonb;

  -- Coletados pós-update
  v_id_a2 bigint; v_id_b2 bigint; v_id_c2 bigint;
  v_status_a text; v_status_b text; v_status_c text;
  v_count int;
  v_payload jsonb;
BEGIN
  RAISE NOTICE '── Setup: criando atendimento de teste %', v_protocolo;

  INSERT INTO public.atendimentos(
    tenant_id, protocolo, paciente_nome, paciente_cpf, paciente_nascimento,
    solicitante, convenio_id, convenio_nome, unidade_id,
    status_atendimento, status_pagamento
  ) VALUES (
    v_tenant, v_protocolo, 'PACIENTE TESTE', '00000000000', '1990-01-01',
    'DR ORIGINAL', 0, 'Particular', 'und-001',
    'Em coleta', 'Pago'
  ) RETURNING id INTO v_at_id;

  -- Exame A: pendente (ainda não coletado)
  INSERT INTO public.atendimento_exames(
    tenant_id, atendimento_id, nome_exame, status, valor, ordem,
    cobranca_destino, amostra_seq, grupo_exame_id, tipo_processo, solicitante
  ) VALUES (
    v_tenant, v_at_id, 'HEMOGRAMA', 'pendente', 30, 1,
    'paciente', 1, gen_random_uuid(), 'INTERNO', 'DR ORIGINAL'
  ) RETURNING id, grupo_exame_id INTO v_id_a, v_grupo_a;

  -- Exame B: já coletado, com timestamp e coletor
  INSERT INTO public.atendimento_exames(
    tenant_id, atendimento_id, nome_exame, status, valor, ordem,
    cobranca_destino, amostra_seq, grupo_exame_id, tipo_processo, solicitante,
    coletor, data_coleta
  ) VALUES (
    v_tenant, v_at_id, 'GLICEMIA', 'coletado', 20, 2,
    'paciente', 1, gen_random_uuid(), 'INTERNO', 'DR ORIGINAL',
    'COLETOR JOAO', now() - interval '2 hours'
  ) RETURNING id, grupo_exame_id, data_coleta INTO v_id_b, v_grupo_b, v_dt_coleta_b;

  -- Exame C: analisado, com resultados preenchidos
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

  RAISE NOTICE '── Cenário 1: editar APENAS solicitante (payload reenvia mesma lista)';

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

  -- Asserts: IDs e estado preservados
  SELECT id, status INTO v_id_a2, v_status_a FROM public.atendimento_exames WHERE atendimento_id=v_at_id AND ordem=1;
  SELECT id, status INTO v_id_b2, v_status_b FROM public.atendimento_exames WHERE atendimento_id=v_at_id AND ordem=2;
  SELECT id, status INTO v_id_c2, v_status_c FROM public.atendimento_exames WHERE atendimento_id=v_at_id AND ordem=3;

  IF v_id_a2 <> v_id_a THEN RAISE EXCEPTION 'FALHOU: id do exame A mudou (%→%)', v_id_a, v_id_a2; END IF;
  IF v_id_b2 <> v_id_b THEN RAISE EXCEPTION 'FALHOU: id do exame B mudou (%→%)', v_id_b, v_id_b2; END IF;
  IF v_id_c2 <> v_id_c THEN RAISE EXCEPTION 'FALHOU: id do exame C mudou (%→%)', v_id_c, v_id_c2; END IF;

  IF v_status_a <> 'pendente'  THEN RAISE EXCEPTION 'FALHOU: status A = %, esperado pendente',  v_status_a; END IF;
  IF v_status_b <> 'coletado'  THEN RAISE EXCEPTION 'FALHOU: status B = %, esperado coletado',  v_status_b; END IF;
  IF v_status_c <> 'analisado' THEN RAISE EXCEPTION 'FALHOU: status C = %, esperado analisado', v_status_c; END IF;

  -- Coletor/analista e timestamps de B e C preservados
  PERFORM 1 FROM public.atendimento_exames
   WHERE id=v_id_b
     AND coletor='COLETOR JOAO'
     AND data_coleta=v_dt_coleta_b
     AND amostra_seq=1
     AND grupo_exame_id=v_grupo_b;
  IF NOT FOUND THEN RAISE EXCEPTION 'FALHOU: metadados clínicos do exame B perdidos'; END IF;

  PERFORM 1 FROM public.atendimento_exames
   WHERE id=v_id_c
     AND analista='ANALISTA MARIA'
     AND data_analise=v_dt_analise_c
     AND resultados=v_resultados_c
     AND grupo_exame_id=v_grupo_c;
  IF NOT FOUND THEN RAISE EXCEPTION 'FALHOU: resultados/analista do exame C perdidos'; END IF;

  -- Patch foi aplicado
  PERFORM 1 FROM public.atendimentos WHERE id=v_at_id AND solicitante='DR NOVO';
  IF NOT FOUND THEN RAISE EXCEPTION 'FALHOU: patch solicitante não aplicado'; END IF;

  RAISE NOTICE '✓ Cenário 1 OK — estado clínico preservado em edição de cabeçalho';

  RAISE NOTICE '── Cenário 2: ADICIONAR um novo exame (4 itens no payload)';

  v_payload := jsonb_build_array(
    jsonb_build_object('nome_exame','HEMOGRAMA',  'valor',30,'ordem',1,'cobranca_destino','paciente'),
    jsonb_build_object('nome_exame','GLICEMIA',   'valor',20,'ordem',2,'cobranca_destino','paciente'),
    jsonb_build_object('nome_exame','COLESTEROL', 'valor',25,'ordem',3,'cobranca_destino','paciente'),
    jsonb_build_object('nome_exame','TGO',        'valor',18,'ordem',4,'cobranca_destino','paciente')
  );

  PERFORM public.update_atendimento_tx(
    _atendimento_id := v_at_id,
    _exames := v_payload
  );

  SELECT count(*) INTO v_count FROM public.atendimento_exames WHERE atendimento_id=v_at_id;
  IF v_count <> 4 THEN RAISE EXCEPTION 'FALHOU: esperava 4 exames após adição, encontrou %', v_count; END IF;

  -- Novos status
  PERFORM 1 FROM public.atendimento_exames WHERE atendimento_id=v_at_id AND ordem=4 AND nome_exame='TGO' AND status='pendente';
  IF NOT FOUND THEN RAISE EXCEPTION 'FALHOU: exame novo (TGO) não foi inserido como pendente na ordem 4'; END IF;

  -- IDs originais preservados
  PERFORM 1 FROM public.atendimento_exames WHERE id=v_id_b AND status='coletado' AND data_coleta=v_dt_coleta_b;
  IF NOT FOUND THEN RAISE EXCEPTION 'FALHOU: exame B perdeu estado após adição'; END IF;
  PERFORM 1 FROM public.atendimento_exames WHERE id=v_id_c AND status='analisado' AND resultados=v_resultados_c;
  IF NOT FOUND THEN RAISE EXCEPTION 'FALHOU: exame C perdeu estado após adição'; END IF;

  RAISE NOTICE '✓ Cenário 2 OK — adição preservou os 3 originais e inseriu o novo como pendente';

  RAISE NOTICE '── Cenário 3: REMOVER o exame A (envia só 3 itens nas ordens 2,3,4)';

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
  IF v_count <> 3 THEN RAISE EXCEPTION 'FALHOU: esperava 3 exames após remoção, encontrou %', v_count; END IF;

  PERFORM 1 FROM public.atendimento_exames WHERE id=v_id_a;
  IF FOUND THEN RAISE EXCEPTION 'FALHOU: exame A (id=%) deveria ter sido removido', v_id_a; END IF;

  -- B e C ainda intactos
  PERFORM 1 FROM public.atendimento_exames WHERE id=v_id_b AND status='coletado' AND data_coleta=v_dt_coleta_b;
  IF NOT FOUND THEN RAISE EXCEPTION 'FALHOU: exame B perdeu estado após remoção do A'; END IF;
  PERFORM 1 FROM public.atendimento_exames WHERE id=v_id_c AND status='analisado' AND resultados=v_resultados_c;
  IF NOT FOUND THEN RAISE EXCEPTION 'FALHOU: exame C perdeu estado após remoção do A'; END IF;

  RAISE NOTICE '✓ Cenário 3 OK — remoção tirou apenas o exame alvo, preservou os demais';

  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ TODOS OS CENÁRIOS PASSARAM — update_atendimento_tx é seguro';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
END
$test$;

ROLLBACK;
