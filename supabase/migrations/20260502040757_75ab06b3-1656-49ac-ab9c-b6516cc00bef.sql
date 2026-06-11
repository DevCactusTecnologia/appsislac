
-- =====================================================================
-- HARDENING P1: comprovante_links, REVOKE EXECUTE, update_atendimento_tx
-- LGPD retention para signup_attempts
-- =====================================================================

-- ─── P1-3: Remover SELECT público em comprovante_links ────────────────
DROP POLICY IF EXISTS "Leitura publica por codigo" ON public.comprovante_links;
-- Acesso público passa exclusivamente pela edge function comprovante-resolve
-- (service_role bypassa RLS). Tenants autenticados continuam vendo seus links
-- via a policy "Tenant pode ver links do proprio lab".

-- ─── P1-6: REVOKE EXECUTE em funções internas/criptográficas ─────────
REVOKE EXECUTE ON FUNCTION public._get_protocolo_hmac_key(uuid)        FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_tenant_hmac_key(uuid)         FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gerar_assinatura_protocolo(uuid, text, bigint, timestamptz) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_protocolo_sequencial(text, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._get_audit_justificativa()           FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public._is_post_finalizacao(bigint)         FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public._calc_dv_amostra(text)               FROM anon, authenticated, PUBLIC;
-- Todas continuam executáveis por triggers/SECURITY DEFINER e service_role.

-- ─── P1-7: update_atendimento_tx exige permissão ─────────────────────
CREATE OR REPLACE FUNCTION public.update_atendimento_tx(_atendimento_id bigint, _patch jsonb, _exames jsonb, _pagamentos jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Verifica permissão: admin OU has_permission('atendimentos')
  IF NOT (
    public.has_role(v_uid, 'admin'::app_role)
    OR public.has_role(v_uid, 'super_admin'::app_role)
    OR public.has_permission(v_uid, 'atendimentos')
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

  PERFORM public.recompute_atendimento_status(_atendimento_id);

  RETURN jsonb_build_object(
    'ok', true,
    'atendimento_id', _atendimento_id,
    'exames_inseridos', v_count_ex,
    'pagamentos_inseridos', v_count_pg
  );
END;
$function$;

-- ─── P1-10: Retenção LGPD para signup_attempts (90 dias) ─────────────
CREATE OR REPLACE FUNCTION public.purge_old_signup_attempts()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE v_count integer;
BEGIN
  DELETE FROM public.signup_attempts WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.purge_old_signup_attempts() FROM anon, authenticated, PUBLIC;

-- Tabela auxiliar para rate limit de signup por IP (P0-2 — persistente)
CREATE TABLE IF NOT EXISTS public.signup_rate_limit (
  ip_address text PRIMARY KEY,
  attempts   integer NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),
  blocked_until timestamptz
);
ALTER TABLE public.signup_rate_limit ENABLE ROW LEVEL SECURITY;
-- Sem policies → apenas service_role acessa (a edge function usa service key).
