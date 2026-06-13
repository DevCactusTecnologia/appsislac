
-- 1) Colunas em atendimentos
ALTER TABLE public.atendimentos
  ADD COLUMN IF NOT EXISTS guia_numero text,
  ADD COLUMN IF NOT EXISTS guia_data date;

CREATE INDEX IF NOT EXISTS idx_atendimentos_guia
  ON public.atendimentos (tenant_id, guia_data, unidade_id);

-- 2) Tabela de sequência diária por unidade
CREATE TABLE IF NOT EXISTS public.guia_sequence (
  tenant_id   uuid NOT NULL,
  unidade_id  text NOT NULL,
  data        date NOT NULL,
  ultimo      int  NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, unidade_id, data)
);

GRANT SELECT ON public.guia_sequence TO authenticated;
GRANT ALL ON public.guia_sequence TO service_role;

ALTER TABLE public.guia_sequence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "guia_sequence_tenant_select"
  ON public.guia_sequence FOR SELECT
  TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin());

CREATE POLICY "guia_sequence_service_all"
  ON public.guia_sequence FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- 3) Função que retorna prefixo (2 primeiras letras da unidade, sem acento)
CREATE OR REPLACE FUNCTION public.unidade_prefixo(_nome text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, extensions
AS $$
  SELECT upper(substr(
    regexp_replace(
      translate(coalesce(_nome,''),
        'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
        'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'),
      '[^A-Za-z]', '', 'g'),
    1, 2));
$$;

-- 4) Função que aloca próximo número de guia (segura para concorrência)
CREATE OR REPLACE FUNCTION public.next_guia_numero(_tenant_id uuid, _unidade_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_data   date;
  v_ultimo int;
  v_nome   text;
  v_pref   text;
BEGIN
  v_data := (now() AT TIME ZONE 'America/Sao_Paulo')::date;

  SELECT nome INTO v_nome
  FROM public.unidades
  WHERE id = _unidade_id AND tenant_id = _tenant_id;

  v_pref := COALESCE(NULLIF(public.unidade_prefixo(v_nome), ''), 'GU');

  INSERT INTO public.guia_sequence (tenant_id, unidade_id, data, ultimo)
  VALUES (_tenant_id, _unidade_id, v_data, 1)
  ON CONFLICT (tenant_id, unidade_id, data)
  DO UPDATE SET ultimo = public.guia_sequence.ultimo + 1,
                updated_at = now()
  RETURNING ultimo INTO v_ultimo;

  RETURN jsonb_build_object(
    'guia_numero', v_pref || '-' || lpad(v_ultimo::text, 3, '0'),
    'guia_data',   v_data
  );
END;
$$;

-- 5) Atualizar create_atendimento_tx para gravar guia
CREATE OR REPLACE FUNCTION public.create_atendimento_tx(_atendimento jsonb, _exames jsonb, _pagamentos jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $function$
DECLARE
  v_my_tenant   uuid;
  v_at_id       bigint;
  v_protocolo   text;
  v_exame       jsonb;
  v_pag         jsonb;
  v_count_ex    int := 0;
  v_count_pg    int := 0;
  v_unidade_id  text;
  v_guia        jsonb;
  v_guia_numero text;
  v_guia_data   date;
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

  v_unidade_id := COALESCE(_atendimento->>'unidade_id','und-001');

  v_guia := public.next_guia_numero(v_my_tenant, v_unidade_id);
  v_guia_numero := v_guia->>'guia_numero';
  v_guia_data   := (v_guia->>'guia_data')::date;

  INSERT INTO public.atendimentos(
    tenant_id, protocolo, data,
    paciente_id, paciente_nome, paciente_cpf, paciente_nascimento,
    solicitante, convenio_id, convenio_nome, unidade_id,
    motivo_cancelamento, guia_numero, guia_data
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
    v_unidade_id,
    NULLIF(_atendimento->>'motivo_cancelamento',''),
    v_guia_numero,
    v_guia_data
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
    'guia_numero', v_guia_numero,
    'guia_data', v_guia_data,
    'exames_inseridos', v_count_ex,
    'pagamentos_inseridos', v_count_pg
  );
END;
$function$;
