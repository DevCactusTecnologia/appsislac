-- Seed de amostras fictícias baseado em exames já coletados
DO $$
DECLARE
  rec RECORD;
  v_codigo TEXT;
  v_validade TIMESTAMPTZ;
  v_status TEXT;
  v_localizacao TEXT;
  v_observacao TEXT;
  v_paciente_id BIGINT;
  v_amostra_id UUID;
  v_idx INT := 0;
  v_freezers TEXT[] := ARRAY['F1','F2','F3'];
  v_gavetas TEXT[] := ARRAY['G1','G2','G3','G4','G5'];
  v_racks TEXT[] := ARRAY['R01','R02','R03','R04','R05','R06'];
  v_pos TEXT[] := ARRAY['P01','P02','P03','P04','P05','P06','P07','P08','P09','P10','P11','P12'];
  v_data_coleta TIMESTAMPTZ;
BEGIN
  FOR rec IN
    SELECT ae.id, ae.atendimento_id, ae.exame_id, ae.material, ae.tenant_id, ae.data_coleta, ae.status,
           a.paciente_id
    FROM public.atendimento_exames ae
    JOIN public.atendimentos a ON a.id = ae.atendimento_id
    WHERE ae.amostra_id IS NULL
      AND ae.status IN ('coletado','em_analise','liberado','finalizado')
      AND ae.material IS NOT NULL
      AND ae.material <> ''
    ORDER BY ae.id
  LOOP
    v_idx := v_idx + 1;
    v_data_coleta := COALESCE(rec.data_coleta, now() - (random() * interval '5 days'));

    -- Distribui status: 50% disponível (recente), 25% utilizada, 15% vencida, 10% descartada
    IF v_idx % 10 = 0 THEN
      v_status := 'DESCARTADA';
      v_validade := v_data_coleta + interval '24 hours';
      v_observacao := 'Descartada após uso conforme protocolo.';
    ELSIF v_idx % 10 IN (1,2) THEN
      v_status := 'VENCIDA';
      v_validade := v_data_coleta + interval '24 hours';
      v_observacao := 'Validade expirada antes do reaproveitamento.';
    ELSIF v_idx % 10 IN (3,4,5) THEN
      v_status := 'UTILIZADA';
      v_validade := v_data_coleta + interval '24 hours';
      v_observacao := 'Reutilizada em novo atendimento.';
    ELSE
      v_status := 'DISPONIVEL';
      -- Para disponíveis, gera validade ainda no futuro
      v_validade := now() + ((random() * 36 + 4) || ' hours')::interval;
      v_observacao := '';
    END IF;

    v_codigo := 'A-' || to_char(v_data_coleta, 'YYYYMMDD') || '-' ||
                lpad((100000 + v_idx)::text, 6, '0');

    v_localizacao := v_freezers[1 + (v_idx % 3)] || '-' ||
                     v_gavetas[1 + (v_idx % 5)] || '-' ||
                     v_racks[1 + (v_idx % 6)] || '-' ||
                     v_pos[1 + (v_idx % 12)];

    INSERT INTO public.amostras (
      tenant_id, atendimento_id, atendimento_exame_id, exame_id, paciente_id,
      codigo_barra, tipo_material, status, data_coleta, data_validade,
      localizacao, observacao
    ) VALUES (
      rec.tenant_id, rec.atendimento_id, rec.id, rec.exame_id, rec.paciente_id,
      v_codigo, upper(rec.material), v_status, v_data_coleta, v_validade,
      v_localizacao, v_observacao
    )
    RETURNING id INTO v_amostra_id;

    -- Vincula a amostra ao exame
    UPDATE public.atendimento_exames
       SET amostra_id = v_amostra_id,
           is_reutilizacao = (v_status = 'UTILIZADA')
     WHERE id = rec.id;
  END LOOP;
END $$;