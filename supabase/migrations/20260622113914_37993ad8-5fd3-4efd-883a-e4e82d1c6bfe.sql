CREATE OR REPLACE FUNCTION public.caixa_fechar(p_sessao_id bigint, p_observacoes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  SELECT
    COALESCE(SUM(CASE WHEN p.tipo='Dinheiro' THEN p.valor ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN p.tipo='PIX'      THEN p.valor ELSE 0 END),0)
  INTO v_dinheiro, v_pix
  FROM public.atendimento_pagamentos p
  WHERE p.tenant_id = v_tenant
    AND p.caixa_sessao_id = p_sessao_id
    AND NOT EXISTS (
      SELECT 1 FROM public.financeiro_estornos e
       WHERE e.tenant_id = v_tenant AND e.origem_tipo = 'pagamento' AND e.origem_id = p.id
    );

  SELECT COALESCE(SUM(s.valor),0) INTO v_saidas
  FROM public.financeiro_saidas s
  WHERE s.tenant_id = v_tenant
    AND s.caixa_sessao_id = p_sessao_id
    AND s.foi_pago = true
    AND NOT EXISTS (
      SELECT 1 FROM public.financeiro_estornos e
       WHERE e.tenant_id = v_tenant AND e.origem_tipo = 'saida' AND e.origem_id = s.id
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
END $function$;