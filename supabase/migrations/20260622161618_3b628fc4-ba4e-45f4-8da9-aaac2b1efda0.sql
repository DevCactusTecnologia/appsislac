
-- Add new modo value
ALTER TYPE public.whatsapp_modo ADD VALUE IF NOT EXISTS 'centralized';

-- ============ whatsapp_outbox ============
CREATE TABLE public.whatsapp_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  paciente_id uuid,
  telefone text NOT NULL,
  template_nome text NOT NULL,
  template_versao text,
  idioma text NOT NULL DEFAULT 'pt_BR',
  variaveis jsonb NOT NULL DEFAULT '{}'::jsonb,
  botoes jsonb,
  prioridade smallint NOT NULL DEFAULT 5,
  status text NOT NULL DEFAULT 'pending',
  tentativa smallint NOT NULL DEFAULT 0,
  max_tentativas smallint NOT NULL DEFAULT 5,
  proxima_tentativa_em timestamptz NOT NULL DEFAULT now(),
  idempotency_key text NOT NULL,
  message_id text,
  erro text,
  atendimento_protocolo text,
  tipo_documento text,
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_outbox_status_chk CHECK (status IN ('pending','sending','sent','failed','failed_permanent','opted_out','rate_limited','cancelled')),
  CONSTRAINT whatsapp_outbox_idem_uq UNIQUE (tenant_id, idempotency_key)
);
CREATE INDEX whatsapp_outbox_dispatch_idx ON public.whatsapp_outbox (status, proxima_tentativa_em) WHERE status IN ('pending','failed');
CREATE INDEX whatsapp_outbox_tenant_idx ON public.whatsapp_outbox (tenant_id, criado_em DESC);
CREATE INDEX whatsapp_outbox_paciente_idx ON public.whatsapp_outbox (paciente_id) WHERE paciente_id IS NOT NULL;

GRANT SELECT ON public.whatsapp_outbox TO authenticated;
GRANT ALL ON public.whatsapp_outbox TO service_role;

ALTER TABLE public.whatsapp_outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "outbox_select_tenant_or_super" ON public.whatsapp_outbox FOR SELECT TO authenticated
  USING (public.is_super_admin() OR tenant_id = public.current_tenant_id());
CREATE POLICY "outbox_service_all" ON public.whatsapp_outbox FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============ whatsapp_opt_out ============
CREATE TABLE public.whatsapp_opt_out (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  paciente_id uuid,
  telefone text,
  motivo text,
  origem text NOT NULL DEFAULT 'webhook',
  criado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_opt_out_key_chk CHECK (paciente_id IS NOT NULL OR telefone IS NOT NULL)
);
CREATE INDEX whatsapp_opt_out_paciente_idx ON public.whatsapp_opt_out (paciente_id) WHERE paciente_id IS NOT NULL;
CREATE INDEX whatsapp_opt_out_telefone_idx ON public.whatsapp_opt_out (telefone) WHERE telefone IS NOT NULL;
CREATE UNIQUE INDEX whatsapp_opt_out_uq_pac ON public.whatsapp_opt_out (coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), paciente_id) WHERE paciente_id IS NOT NULL;
CREATE UNIQUE INDEX whatsapp_opt_out_uq_tel ON public.whatsapp_opt_out (coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), telefone) WHERE telefone IS NOT NULL AND paciente_id IS NULL;

GRANT SELECT, INSERT ON public.whatsapp_opt_out TO authenticated;
GRANT ALL ON public.whatsapp_opt_out TO service_role;

ALTER TABLE public.whatsapp_opt_out ENABLE ROW LEVEL SECURITY;

CREATE POLICY "optout_select" ON public.whatsapp_opt_out FOR SELECT TO authenticated
  USING (public.is_super_admin() OR tenant_id IS NULL OR tenant_id = public.current_tenant_id());
CREATE POLICY "optout_insert" ON public.whatsapp_opt_out FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR tenant_id = public.current_tenant_id());
CREATE POLICY "optout_service_all" ON public.whatsapp_opt_out FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============ whatsapp_metrics_tenant ============
CREATE TABLE public.whatsapp_metrics_tenant (
  tenant_id uuid NOT NULL,
  dia date NOT NULL,
  enviados int NOT NULL DEFAULT 0,
  entregues int NOT NULL DEFAULT 0,
  lidos int NOT NULL DEFAULT 0,
  falhas int NOT NULL DEFAULT 0,
  opt_outs int NOT NULL DEFAULT 0,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, dia)
);
GRANT SELECT ON public.whatsapp_metrics_tenant TO authenticated;
GRANT ALL ON public.whatsapp_metrics_tenant TO service_role;
ALTER TABLE public.whatsapp_metrics_tenant ENABLE ROW LEVEL SECURITY;
CREATE POLICY "metrics_select" ON public.whatsapp_metrics_tenant FOR SELECT TO authenticated
  USING (public.is_super_admin() OR tenant_id = public.current_tenant_id());
CREATE POLICY "metrics_service_all" ON public.whatsapp_metrics_tenant FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============ whatsapp_templates_cache (Meta = SSOT) ============
CREATE TABLE public.whatsapp_templates_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  idioma text NOT NULL DEFAULT 'pt_BR',
  versao text,
  categoria text,
  status text NOT NULL DEFAULT 'unknown',
  corpo text,
  botoes jsonb,
  variaveis_count smallint DEFAULT 0,
  meta_payload jsonb,
  sincronizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_templates_cache_uq UNIQUE (nome, idioma)
);
GRANT SELECT ON public.whatsapp_templates_cache TO authenticated;
GRANT ALL ON public.whatsapp_templates_cache TO service_role;
ALTER TABLE public.whatsapp_templates_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "templates_cache_select_all_auth" ON public.whatsapp_templates_cache FOR SELECT TO authenticated USING (true);
CREATE POLICY "templates_cache_service_all" ON public.whatsapp_templates_cache FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============ tenant_rate_limit ============
CREATE TABLE public.tenant_rate_limit (
  tenant_id uuid PRIMARY KEY,
  mensagens_por_hora int NOT NULL DEFAULT 250,
  mensagens_por_dia int NOT NULL DEFAULT 1000,
  bloqueado_ate timestamptz,
  motivo_bloqueio text,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tenant_rate_limit TO authenticated;
GRANT ALL ON public.tenant_rate_limit TO service_role;
ALTER TABLE public.tenant_rate_limit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ratelimit_select" ON public.tenant_rate_limit FOR SELECT TO authenticated
  USING (public.is_super_admin() OR tenant_id = public.current_tenant_id());
CREATE POLICY "ratelimit_service_all" ON public.tenant_rate_limit FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============ updated_at trigger reuse ============
CREATE OR REPLACE FUNCTION public.whatsapp_outbox_touch() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.atualizado_em := now(); RETURN NEW; END $$;
CREATE TRIGGER trg_whatsapp_outbox_touch BEFORE UPDATE ON public.whatsapp_outbox
  FOR EACH ROW EXECUTE FUNCTION public.whatsapp_outbox_touch();

-- ============ enqueue_whatsapp(...) ============
CREATE OR REPLACE FUNCTION public.enqueue_whatsapp(
  p_tenant_id uuid,
  p_paciente_id uuid,
  p_telefone text,
  p_template text,
  p_variaveis jsonb,
  p_idempotency_key text,
  p_atendimento_protocolo text DEFAULT NULL,
  p_tipo_documento text DEFAULT NULL,
  p_idioma text DEFAULT 'pt_BR',
  p_botoes jsonb DEFAULT NULL,
  p_prioridade smallint DEFAULT 5
) RETURNS TABLE(outbox_id uuid, status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_phone text := regexp_replace(coalesce(p_telefone,''), '\D', '', 'g');
  v_id uuid;
  v_blocked timestamptz;
  v_count_hour int;
  v_count_day int;
  v_lim_hour int;
  v_lim_day int;
  v_existing uuid;
  v_existing_status text;
BEGIN
  IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id obrigatorio'; END IF;
  IF p_template IS NULL OR length(p_template)=0 THEN RAISE EXCEPTION 'template obrigatorio'; END IF;
  IF length(v_phone) < 10 THEN RAISE EXCEPTION 'telefone invalido'; END IF;
  IF left(v_phone,2) <> '55' THEN v_phone := '55' || v_phone; END IF;

  -- idempotência
  SELECT id, status INTO v_existing, v_existing_status FROM public.whatsapp_outbox
    WHERE tenant_id = p_tenant_id AND idempotency_key = p_idempotency_key;
  IF v_existing IS NOT NULL THEN
    RETURN QUERY SELECT v_existing, v_existing_status;
    RETURN;
  END IF;

  -- opt-out (paciente prioritário, telefone fallback)
  IF p_paciente_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.whatsapp_opt_out
    WHERE paciente_id = p_paciente_id AND (tenant_id IS NULL OR tenant_id = p_tenant_id)
  ) THEN
    INSERT INTO public.whatsapp_outbox (tenant_id, paciente_id, telefone, template_nome, idioma, variaveis, botoes, prioridade, status, idempotency_key, erro, atendimento_protocolo, tipo_documento, criado_por, max_tentativas, proxima_tentativa_em)
    VALUES (p_tenant_id, p_paciente_id, v_phone, p_template, p_idioma, coalesce(p_variaveis,'{}'::jsonb), p_botoes, p_prioridade, 'opted_out', p_idempotency_key, 'paciente em opt-out', p_atendimento_protocolo, p_tipo_documento, auth.uid(), 0, now())
    RETURNING id INTO v_id;
    RETURN QUERY SELECT v_id, 'opted_out'::text; RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.whatsapp_opt_out WHERE telefone = v_phone AND (tenant_id IS NULL OR tenant_id = p_tenant_id)) THEN
    INSERT INTO public.whatsapp_outbox (tenant_id, paciente_id, telefone, template_nome, idioma, variaveis, botoes, prioridade, status, idempotency_key, erro, atendimento_protocolo, tipo_documento, criado_por, max_tentativas, proxima_tentativa_em)
    VALUES (p_tenant_id, p_paciente_id, v_phone, p_template, p_idioma, coalesce(p_variaveis,'{}'::jsonb), p_botoes, p_prioridade, 'opted_out', p_idempotency_key, 'telefone em opt-out', p_atendimento_protocolo, p_tipo_documento, auth.uid(), 0, now())
    RETURNING id INTO v_id;
    RETURN QUERY SELECT v_id, 'opted_out'::text; RETURN;
  END IF;

  -- rate limit
  SELECT bloqueado_ate, mensagens_por_hora, mensagens_por_dia
    INTO v_blocked, v_lim_hour, v_lim_day
  FROM public.tenant_rate_limit WHERE tenant_id = p_tenant_id;
  v_lim_hour := coalesce(v_lim_hour, 250);
  v_lim_day  := coalesce(v_lim_day, 1000);
  IF v_blocked IS NOT NULL AND v_blocked > now() THEN
    INSERT INTO public.whatsapp_outbox (tenant_id, paciente_id, telefone, template_nome, idioma, variaveis, botoes, prioridade, status, idempotency_key, erro, atendimento_protocolo, tipo_documento, criado_por, max_tentativas, proxima_tentativa_em)
    VALUES (p_tenant_id, p_paciente_id, v_phone, p_template, p_idioma, coalesce(p_variaveis,'{}'::jsonb), p_botoes, p_prioridade, 'rate_limited', p_idempotency_key, 'tenant bloqueado', p_atendimento_protocolo, p_tipo_documento, auth.uid(), 0, v_blocked)
    RETURNING id INTO v_id;
    RETURN QUERY SELECT v_id, 'rate_limited'::text; RETURN;
  END IF;
  SELECT count(*) INTO v_count_hour FROM public.whatsapp_outbox
    WHERE tenant_id = p_tenant_id AND status IN ('pending','sending','sent') AND criado_em > now() - interval '1 hour';
  SELECT count(*) INTO v_count_day FROM public.whatsapp_outbox
    WHERE tenant_id = p_tenant_id AND status IN ('pending','sending','sent') AND criado_em > now() - interval '1 day';
  IF v_count_hour >= v_lim_hour OR v_count_day >= v_lim_day THEN
    INSERT INTO public.whatsapp_outbox (tenant_id, paciente_id, telefone, template_nome, idioma, variaveis, botoes, prioridade, status, idempotency_key, erro, atendimento_protocolo, tipo_documento, criado_por, max_tentativas, proxima_tentativa_em)
    VALUES (p_tenant_id, p_paciente_id, v_phone, p_template, p_idioma, coalesce(p_variaveis,'{}'::jsonb), p_botoes, p_prioridade, 'rate_limited', p_idempotency_key, 'rate limit atingido', p_atendimento_protocolo, p_tipo_documento, auth.uid(), 0, now() + interval '1 hour')
    RETURNING id INTO v_id;
    RETURN QUERY SELECT v_id, 'rate_limited'::text; RETURN;
  END IF;

  -- enqueue
  INSERT INTO public.whatsapp_outbox (tenant_id, paciente_id, telefone, template_nome, idioma, variaveis, botoes, prioridade, status, idempotency_key, atendimento_protocolo, tipo_documento, criado_por)
  VALUES (p_tenant_id, p_paciente_id, v_phone, p_template, p_idioma, coalesce(p_variaveis,'{}'::jsonb), p_botoes, p_prioridade, 'pending', p_idempotency_key, p_atendimento_protocolo, p_tipo_documento, auth.uid())
  RETURNING id INTO v_id;
  RETURN QUERY SELECT v_id, 'pending'::text;
END $$;

REVOKE ALL ON FUNCTION public.enqueue_whatsapp(uuid,uuid,text,text,jsonb,text,text,text,text,jsonb,smallint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_whatsapp(uuid,uuid,text,text,jsonb,text,text,text,text,jsonb,smallint) TO authenticated, service_role;
