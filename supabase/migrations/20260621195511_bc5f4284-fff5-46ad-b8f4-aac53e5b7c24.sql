
-- =====================================================================
-- FASE 5 — CAIXA OPERACIONAL (hardening + RPCs + vinculação automática)
-- =====================================================================

-- 5.1 HARDENING caixa_sessoes ------------------------------------------------
-- coluna fechado_por (responsavel_id continua sendo "quem abriu")
ALTER TABLE public.caixa_sessoes
  ADD COLUMN IF NOT EXISTS fechado_por uuid;

-- unique parcial: 1 caixa aberto por (tenant, unidade)
DROP INDEX IF EXISTS public.caixa_sessoes_uniq_aberta;
CREATE UNIQUE INDEX caixa_sessoes_uniq_aberta
  ON public.caixa_sessoes (tenant_id, unidade_id)
  WHERE status = 'aberta';

CREATE INDEX IF NOT EXISTS caixa_sessoes_tenant_status_idx
  ON public.caixa_sessoes (tenant_id, status);

-- trigger updated_at
CREATE OR REPLACE FUNCTION public.touch_caixa_sessao_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_caixa_sessoes_updated_at ON public.caixa_sessoes;
CREATE TRIGGER trg_caixa_sessoes_updated_at
  BEFORE UPDATE ON public.caixa_sessoes
  FOR EACH ROW EXECUTE FUNCTION public.touch_caixa_sessao_updated_at();

-- 5.4 VINCULAÇÃO -------------------------------------------------------------
-- coluna caixa_sessao_id em atendimento_pagamentos e financeiro_saidas
ALTER TABLE public.atendimento_pagamentos
  ADD COLUMN IF NOT EXISTS caixa_sessao_id bigint REFERENCES public.caixa_sessoes(id) ON DELETE SET NULL;

ALTER TABLE public.financeiro_saidas
  ADD COLUMN IF NOT EXISTS caixa_sessao_id bigint REFERENCES public.caixa_sessoes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS atpag_caixa_sessao_idx
  ON public.atendimento_pagamentos (caixa_sessao_id) WHERE caixa_sessao_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS saidas_caixa_sessao_idx
  ON public.financeiro_saidas (caixa_sessao_id) WHERE caixa_sessao_id IS NOT NULL;

-- trigger: amarra pagamento de paciente à sessão aberta da unidade
CREATE OR REPLACE FUNCTION public.attach_pagamento_to_caixa()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_unidade text;
  v_sessao  bigint;
BEGIN
  IF NEW.caixa_sessao_id IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.tipo NOT IN ('Dinheiro','PIX') THEN RETURN NEW; END IF;

  SELECT unidade_id INTO v_unidade
    FROM public.atendimentos
   WHERE id = NEW.atendimento_id AND tenant_id = NEW.tenant_id;
  IF v_unidade IS NULL THEN RETURN NEW; END IF;

  SELECT id INTO v_sessao
    FROM public.caixa_sessoes
   WHERE tenant_id = NEW.tenant_id
     AND unidade_id = v_unidade
     AND status = 'aberta'
   LIMIT 1;

  NEW.caixa_sessao_id := v_sessao;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_atpag_attach_caixa ON public.atendimento_pagamentos;
CREATE TRIGGER trg_atpag_attach_caixa
  BEFORE INSERT ON public.atendimento_pagamentos
  FOR EACH ROW EXECUTE FUNCTION public.attach_pagamento_to_caixa();

-- trigger: amarra saída à sessão aberta — só quando há exatamente 1 caixa aberto no tenant
CREATE OR REPLACE FUNCTION public.attach_saida_to_caixa()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_count int;
  v_sessao bigint;
BEGIN
  IF NEW.caixa_sessao_id IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.foi_pago IS DISTINCT FROM TRUE THEN RETURN NEW; END IF;
  IF NEW.forma_pagamento NOT IN ('Dinheiro','PIX') THEN RETURN NEW; END IF;

  SELECT count(*), max(id) INTO v_count, v_sessao
    FROM public.caixa_sessoes
   WHERE tenant_id = NEW.tenant_id AND status = 'aberta';

  IF v_count = 1 THEN NEW.caixa_sessao_id := v_sessao; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_saida_attach_caixa ON public.financeiro_saidas;
CREATE TRIGGER trg_saida_attach_caixa
  BEFORE INSERT ON public.financeiro_saidas
  FOR EACH ROW EXECUTE FUNCTION public.attach_saida_to_caixa();

-- 5.2 RPC caixa_abrir --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.caixa_abrir(
  p_unidade_id text,
  p_valor_abertura numeric DEFAULT 0,
  p_observacoes text DEFAULT NULL
) RETURNS public.caixa_sessoes
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant uuid := public.current_tenant_id();
  v_user uuid := auth.uid();
  v_row public.caixa_sessoes;
BEGIN
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'tenant_nao_resolvido'; END IF;
  IF NOT (public.is_super_admin() OR public.has_permission(v_user,'gestao_financeira')) THEN
    RAISE EXCEPTION 'sem_permissao';
  END IF;
  IF p_unidade_id IS NULL OR length(trim(p_unidade_id))=0 THEN
    RAISE EXCEPTION 'unidade_obrigatoria';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.caixa_sessoes
     WHERE tenant_id = v_tenant AND unidade_id = p_unidade_id AND status = 'aberta'
  ) THEN
    RAISE EXCEPTION 'caixa_ja_aberto_para_unidade';
  END IF;

  INSERT INTO public.caixa_sessoes
    (tenant_id, unidade_id, aberta_em, responsavel_id, valor_abertura, observacoes, status)
  VALUES (v_tenant, p_unidade_id, now(), v_user, COALESCE(p_valor_abertura,0), p_observacoes, 'aberta')
  RETURNING * INTO v_row;

  RETURN v_row;
END $$;

-- 5.3 RPC caixa_fechar -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.caixa_fechar(
  p_sessao_id bigint,
  p_observacoes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant uuid := public.current_tenant_id();
  v_user uuid := auth.uid();
  v_sessao public.caixa_sessoes;
  v_dinheiro numeric := 0;
  v_pix numeric := 0;
  v_saidas numeric := 0;
  v_saldo_final numeric;
BEGIN
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'tenant_nao_resolvido'; END IF;
  IF NOT (public.is_super_admin() OR public.has_permission(v_user,'gestao_financeira')) THEN
    RAISE EXCEPTION 'sem_permissao';
  END IF;

  SELECT * INTO v_sessao FROM public.caixa_sessoes
   WHERE id = p_sessao_id AND tenant_id = v_tenant FOR UPDATE;
  IF v_sessao.id IS NULL THEN RAISE EXCEPTION 'sessao_nao_encontrada'; END IF;
  IF v_sessao.status <> 'aberta' THEN RAISE EXCEPTION 'sessao_ja_fechada'; END IF;

  -- entradas dinheiro/pix presencial vinculadas (excluindo estornadas)
  SELECT
    COALESCE(SUM(CASE WHEN p.tipo='Dinheiro' THEN p.valor ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN p.tipo='PIX'      THEN p.valor ELSE 0 END),0)
  INTO v_dinheiro, v_pix
  FROM public.atendimento_pagamentos p
  WHERE p.tenant_id = v_tenant
    AND p.caixa_sessao_id = p_sessao_id
    AND NOT EXISTS (
      SELECT 1 FROM public.financeiro_estornos e
       WHERE e.tenant_id = v_tenant AND e.tipo = 'pagamento' AND e.origem_id = p.id
    );

  SELECT COALESCE(SUM(s.valor),0) INTO v_saidas
  FROM public.financeiro_saidas s
  WHERE s.tenant_id = v_tenant
    AND s.caixa_sessao_id = p_sessao_id
    AND s.foi_pago = true
    AND NOT EXISTS (
      SELECT 1 FROM public.financeiro_estornos e
       WHERE e.tenant_id = v_tenant AND e.tipo = 'saida' AND e.origem_id = s.id
    );

  v_saldo_final := COALESCE(v_sessao.valor_abertura,0) + v_dinheiro + v_pix - v_saidas;

  UPDATE public.caixa_sessoes
     SET status = 'fechada',
         fechada_em = now(),
         fechado_por = v_user,
         valor_fechamento = v_saldo_final,
         observacoes = COALESCE(p_observacoes, observacoes)
   WHERE id = p_sessao_id;

  RETURN jsonb_build_object(
    'sessao_id', p_sessao_id,
    'valor_abertura', v_sessao.valor_abertura,
    'entradas_dinheiro', v_dinheiro,
    'entradas_pix', v_pix,
    'saidas', v_saidas,
    'saldo_final', v_saldo_final,
    'aberta_em', v_sessao.aberta_em,
    'fechada_em', now()
  );
END $$;

GRANT EXECUTE ON FUNCTION public.caixa_abrir(text, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.caixa_fechar(bigint, text) TO authenticated;
