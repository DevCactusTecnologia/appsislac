DO $$
DECLARE
  v_tenant uuid := '00000000-0000-0000-0000-000000000001';
  v_admin uuid;
  rec record;
  v_now timestamptz := now();
BEGIN
  SELECT user_id INTO v_admin FROM profiles
  WHERE tenant_id = v_tenant AND perfil = 'admin' LIMIT 1;

  -- 1) Diversificar status dos exames
  UPDATE atendimento_exames ae
  SET
    status = CASE
      WHEN (ae.id % 20) < 8 THEN 'finalizado'
      WHEN (ae.id % 20) < 11 THEN 'em_analise'
      WHEN (ae.id % 20) < 15 THEN 'coletado'
      WHEN (ae.id % 20) < 19 THEN 'pendente'
      ELSE 'cancelado'
    END,
    data_coleta = CASE
      WHEN (ae.id % 20) >= 15 THEN ae.data_coleta
      ELSE COALESCE(ae.data_coleta, ae.created_at + interval '2 hours')
    END,
    data_analise = CASE
      WHEN (ae.id % 20) < 11 THEN COALESCE(ae.data_analise, ae.created_at + interval '6 hours')
      ELSE NULL
    END,
    data_liberacao = CASE
      WHEN (ae.id % 20) < 8 THEN COALESCE(ae.data_liberacao, ae.created_at + interval '10 hours')
      ELSE NULL
    END,
    motivo_cancelamento = CASE
      WHEN (ae.id % 20) = 19 THEN 'Amostra insuficiente'
      ELSE NULL
    END,
    coletor = CASE
      WHEN (ae.id % 20) < 19 AND (ae.coletor IS NULL OR ae.coletor = '') THEN
        (ARRAY['Ana Recepção','Carla Mendes','Roberto Farias'])[1 + (ae.id % 3)]
      ELSE ae.coletor
    END,
    analista = CASE
      WHEN (ae.id % 20) < 11 AND (ae.analista IS NULL OR ae.analista = '') THEN
        (ARRAY['Marcos Lisboa','Patrícia Andrade','Álvaro Saraiva'])[1 + (ae.id % 3)]
      ELSE ae.analista
    END,
    resultados = CASE
      WHEN (ae.id % 20) < 8 THEN
        CASE ae.nome_exame
          WHEN 'Glicemia' THEN jsonb_build_object('glicose', (85 + (ae.id % 40))::text || ' mg/dL')
          WHEN 'Colesterol Total' THEN jsonb_build_object('colesterol', (150 + (ae.id % 80))::text || ' mg/dL')
          WHEN 'Colesterol HDL' THEN jsonb_build_object('hdl', (35 + (ae.id % 30))::text || ' mg/dL')
          WHEN 'Colesterol LDL' THEN jsonb_build_object('ldl', (80 + (ae.id % 60))::text || ' mg/dL')
          WHEN 'Triglicerídeos' THEN jsonb_build_object('triglicerides', (90 + (ae.id % 100))::text || ' mg/dL')
          WHEN 'Creatinina' THEN jsonb_build_object('creatinina', round((0.6 + (ae.id % 10) * 0.1)::numeric, 2)::text || ' mg/dL')
          WHEN 'Ureia' THEN jsonb_build_object('ureia', (20 + (ae.id % 30))::text || ' mg/dL')
          WHEN 'Ácido Úrico' THEN jsonb_build_object('acido_urico', round((3.0 + (ae.id % 40) * 0.1)::numeric, 2)::text || ' mg/dL')
          WHEN 'TGO (AST)' THEN jsonb_build_object('tgo', (15 + (ae.id % 35))::text || ' U/L')
          WHEN 'TGP (ALT)' THEN jsonb_build_object('tgp', (15 + (ae.id % 40))::text || ' U/L')
          WHEN 'TSH' THEN jsonb_build_object('tsh', round((0.5 + (ae.id % 50) * 0.1)::numeric, 2)::text || ' µUI/mL')
          WHEN 'T4 Livre' THEN jsonb_build_object('t4_livre', round((0.7 + (ae.id % 15) * 0.1)::numeric, 2)::text || ' ng/dL')
          WHEN 'PSA Total' THEN jsonb_build_object('psa', round((0.4 + (ae.id % 30) * 0.1)::numeric, 2)::text || ' ng/mL')
          WHEN 'Hemograma Completo' THEN jsonb_build_object(
            'hemoglobina', (12 + (ae.id % 5))::text || ' g/dL',
            'hematocrito', (37 + (ae.id % 10))::text || ' %',
            'leucocitos', (5000 + (ae.id % 5000))::text || ' /mm³',
            'plaquetas', (180000 + (ae.id % 100000))::text || ' /mm³'
          )
          ELSE jsonb_build_object('resultado', 'Dentro dos valores de referência')
        END
      ELSE '{}'::jsonb
    END,
    updated_at = v_now
  WHERE ae.tenant_id = v_tenant;

  -- 2) Recalcular status dos atendimentos
  FOR rec IN SELECT id FROM atendimentos WHERE tenant_id = v_tenant LOOP
    PERFORM recompute_atendimento_status(rec.id);
  END LOOP;

  -- 3) Auditoria: liberações
  INSERT INTO atendimento_audit (
    entidade, operacao, acao, atendimento_id, registro_id,
    protocolo, paciente_nome, exame_nome,
    old_value, new_value,
    changed_by, changed_by_email, changed_at, tenant_id
  )
  SELECT
    'exame', 'UPDATE', 'liberar_resultado',
    ae.atendimento_id, ae.id,
    a.protocolo, a.paciente_nome, ae.nome_exame,
    jsonb_build_object('status', 'em_analise'),
    jsonb_build_object('status', 'finalizado', 'resultados', ae.resultados),
    v_admin, 'admin@sislac.com',
    ae.data_liberacao, v_tenant
  FROM atendimento_exames ae
  JOIN atendimentos a ON a.id = ae.atendimento_id
  WHERE ae.tenant_id = v_tenant
    AND ae.status = 'finalizado'
    AND ae.data_liberacao IS NOT NULL
  LIMIT 30;

  -- 4) Auditoria: cancelamentos de exames
  INSERT INTO atendimento_audit (
    entidade, operacao, acao, atendimento_id, registro_id,
    protocolo, paciente_nome, exame_nome,
    old_value, new_value,
    changed_by, changed_by_email, changed_at, tenant_id
  )
  SELECT
    'exame', 'UPDATE', 'cancelar_exame',
    ae.atendimento_id, ae.id,
    a.protocolo, a.paciente_nome, ae.nome_exame,
    jsonb_build_object('status', 'pendente'),
    jsonb_build_object('status', 'cancelado', 'motivo', ae.motivo_cancelamento),
    v_admin, 'admin@sislac.com',
    ae.updated_at, v_tenant
  FROM atendimento_exames ae
  JOIN atendimentos a ON a.id = ae.atendimento_id
  WHERE ae.tenant_id = v_tenant
    AND ae.status = 'cancelado'
  LIMIT 15;

  -- 5) Auditoria: criação de atendimentos (amostra)
  INSERT INTO atendimento_audit (
    entidade, operacao, acao, atendimento_id,
    protocolo, paciente_nome,
    new_value,
    changed_by, changed_by_email, changed_at, tenant_id
  )
  SELECT
    'atendimento', 'INSERT', 'criar_atendimento',
    a.id, a.protocolo, a.paciente_nome,
    jsonb_build_object('status', a.status_atendimento, 'convenio', a.convenio_nome),
    v_admin, 'admin@sislac.com',
    a.created_at, v_tenant
  FROM atendimentos a
  WHERE a.tenant_id = v_tenant
  LIMIT 25;

END $$;