
-- Seed: 8 novos atendimentos fictícios com exames pendentes para a fila de coleta
DO $$
DECLARE
  v_tenant uuid := '00000000-0000-0000-0000-000000000001';
  v_unidade text := 'und-001';
  v_next_num int;
  v_protocolo text;
  v_atend_id bigint;
  v_paciente_id bigint;
  r record;
  e record;
BEGIN
  -- Próximo número de protocolo
  SELECT COALESCE(
    MAX( (regexp_replace(protocolo, 'ATD-\d{4}-', ''))::int ),
    0
  ) + 1
  INTO v_next_num
  FROM atendimentos
  WHERE tenant_id = v_tenant
    AND protocolo ~ '^ATD-\d{4}-\d+$';

  FOR r IN
    SELECT * FROM (VALUES
      (1, 'Helena Vasconcelos Maia',    '111.222.333-01', '1992-03-14'::date, 'F'),
      (2, 'Ricardo Moura Tavares',      '111.222.333-02', '1985-07-22'::date, 'M'),
      (3, 'Juliana Freitas Cardoso',    '111.222.333-03', '1978-11-05'::date, 'F'),
      (4, 'Bernardo Siqueira Antunes',  '111.222.333-04', '2001-01-30'::date, 'M'),
      (5, 'Larissa Cordeiro Brandão',   '111.222.333-05', '1996-09-18'::date, 'F'),
      (6, 'Thiago Rezende Macedo',      '111.222.333-06', '1989-04-09'::date, 'M'),
      (7, 'Patrícia Nogueira Sales',    '111.222.333-07', '1972-12-02'::date, 'F'),
      (8, 'André Quintela Bittencourt', '111.222.333-08', '1965-06-27'::date, 'M')
    ) AS t(idx, nome, cpf, nasc, sexo)
  LOOP
    v_protocolo := 'ATD-2025-' || lpad((v_next_num + r.idx - 1)::text, 4, '0');

    -- Garante paciente
    SELECT id INTO v_paciente_id
    FROM pacientes
    WHERE tenant_id = v_tenant AND cpf = r.cpf
    LIMIT 1;

    IF v_paciente_id IS NULL THEN
      INSERT INTO pacientes (tenant_id, nome, cpf, sexo, data_nascimento, status)
      VALUES (v_tenant, r.nome, r.cpf, r.sexo, r.nasc, 'Ativo')
      RETURNING id INTO v_paciente_id;
    END IF;

    -- Cria atendimento
    INSERT INTO atendimentos (
      tenant_id, unidade_id, protocolo, paciente_id, paciente_nome, paciente_cpf,
      paciente_nascimento, convenio_id, convenio_nome, solicitante,
      status_atendimento, status_pagamento, data
    )
    VALUES (
      v_tenant, v_unidade, v_protocolo, v_paciente_id, r.nome, r.cpf,
      r.nasc, 0, 'Particular', 'Dr. Auto Seed',
      'Pedido Realizado', 'Pagamento efetuado', now()
    )
    RETURNING id INTO v_atend_id;

    -- Insere combo de exames pendentes para este atendimento (idx)
    FOR e IN
      SELECT * FROM (VALUES
        -- idx, ordem, nome_exame, material
        (1, 1, 'Hemograma Completo', 'Sangue'),
        (1, 2, 'Glicemia', 'Sangue'),
        (1, 3, 'Colesterol Total', 'Sangue'),

        (2, 1, 'TSH', 'Sangue'),
        (2, 2, 'T4 Livre', 'Sangue'),

        (3, 1, 'Hemograma Completo', 'Sangue'),
        (3, 2, 'Ureia', 'Sangue'),
        (3, 3, 'Creatinina', 'Sangue'),
        (3, 4, 'Ácido Úrico', 'Sangue'),

        (4, 1, 'Glicemia', 'Sangue'),

        (5, 1, 'Colesterol Total', 'Sangue'),
        (5, 2, 'Colesterol HDL', 'Sangue'),
        (5, 3, 'Colesterol LDL', 'Sangue'),
        (5, 4, 'Triglicerídeos', 'Sangue'),

        (6, 1, 'TGO (AST)', 'Sangue'),
        (6, 2, 'TGP (ALT)', 'Sangue'),

        (7, 1, 'Hemograma Completo', 'Sangue'),
        (7, 2, 'Glicemia', 'Sangue'),

        (8, 1, 'PSA Total', 'Sangue'),
        (8, 2, 'Creatinina', 'Sangue'),
        (8, 3, 'Ureia', 'Sangue')
      ) AS x(idx, ordem, nome_exame, material)
      WHERE x.idx = r.idx
      ORDER BY x.ordem
    LOOP
      INSERT INTO atendimento_exames (
        tenant_id, atendimento_id, nome_exame, material, status, ordem, valor
      )
      VALUES (
        v_tenant, v_atend_id, e.nome_exame, e.material, 'pendente', e.ordem, 0
      );
    END LOOP;
  END LOOP;
END $$;
