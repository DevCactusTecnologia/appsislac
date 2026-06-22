
-- =========================================================
-- CONVÊNIOS 2.0 — FASE 2 (HARDENING)
-- 2.1 Cancelamento sem DELETE + auditoria
-- 2.2 Auditoria formal (financeiro_audit)
-- 2.3 SSOT de elegibilidade (status='finalizado' + ignora itens de faturas canceladas)
-- 2.4 Recálculo de subtotal/total no banco
-- =========================================================

-- ---------- 2.1: colunas de cancelamento ----------
ALTER TABLE public.convenio_faturas
  ADD COLUMN IF NOT EXISTS cancelada_em        timestamptz,
  ADD COLUMN IF NOT EXISTS cancelada_por       uuid,
  ADD COLUMN IF NOT EXISTS motivo_cancelamento text;

-- ---------- 2.4: recálculo automático ----------
CREATE OR REPLACE FUNCTION public.convenio_fatura_recalc(p_fatura_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub numeric;
  v_desc numeric;
BEGIN
  SELECT COALESCE(SUM(valor), 0)::numeric INTO v_sub
  FROM public.convenio_fatura_itens WHERE fatura_id = p_fatura_id;

  SELECT COALESCE(desconto, 0) INTO v_desc
  FROM public.convenio_faturas WHERE id = p_fatura_id;

  UPDATE public.convenio_faturas
  SET subtotal = ROUND(v_sub, 2),
      total    = ROUND(GREATEST(v_sub - COALESCE(v_desc, 0), 0), 2)
  WHERE id = p_fatura_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_convenio_fatura_itens_recalc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.convenio_fatura_recalc(OLD.fatura_id);
    RETURN OLD;
  ELSE
    PERFORM public.convenio_fatura_recalc(NEW.fatura_id);
    IF TG_OP = 'UPDATE' AND NEW.fatura_id <> OLD.fatura_id THEN
      PERFORM public.convenio_fatura_recalc(OLD.fatura_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_convenio_fatura_itens_recalc ON public.convenio_fatura_itens;
CREATE TRIGGER trg_convenio_fatura_itens_recalc
AFTER INSERT OR UPDATE OR DELETE ON public.convenio_fatura_itens
FOR EACH ROW EXECUTE FUNCTION public.tg_convenio_fatura_itens_recalc();

-- Ao mudar desconto na fatura, recalcular total
CREATE OR REPLACE FUNCTION public.tg_convenio_fatura_recalc_on_desconto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.desconto IS DISTINCT FROM OLD.desconto THEN
    NEW.total := ROUND(GREATEST(COALESCE(NEW.subtotal, 0) - COALESCE(NEW.desconto, 0), 0), 2);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_convenio_fatura_recalc_on_desconto ON public.convenio_faturas;
CREATE TRIGGER trg_convenio_fatura_recalc_on_desconto
BEFORE UPDATE ON public.convenio_faturas
FOR EACH ROW EXECUTE FUNCTION public.tg_convenio_fatura_recalc_on_desconto();

-- ---------- 2.2: auditoria formal ----------
CREATE OR REPLACE FUNCTION public.tg_audit_convenio_faturas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acao text;
  v_antes jsonb;
  v_depois jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_acao := 'create';
    v_antes := NULL;
    v_depois := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      v_acao := CASE NEW.status
        WHEN 'paga'      THEN 'pay'
        WHEN 'cancelada' THEN 'cancel'
        ELSE 'update_status'
      END;
    ELSIF NEW.observacao IS DISTINCT FROM OLD.observacao THEN
      v_acao := 'update_observacao';
    ELSIF NEW.desconto IS DISTINCT FROM OLD.desconto THEN
      v_acao := 'update_desconto';
    ELSE
      v_acao := 'update';
    END IF;
    v_antes := to_jsonb(OLD);
    v_depois := to_jsonb(NEW);
  ELSE
    v_acao := 'delete';
    v_antes := to_jsonb(OLD);
    v_depois := NULL;
  END IF;

  INSERT INTO public.financeiro_audit (tenant_id, entidade, entidade_id, acao, antes, depois, ator_id)
  VALUES (
    COALESCE(NEW.tenant_id, OLD.tenant_id),
    'convenio_fatura',
    COALESCE(NEW.id, OLD.id)::text,
    v_acao,
    v_antes,
    v_depois,
    auth.uid()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_convenio_faturas ON public.convenio_faturas;
CREATE TRIGGER trg_audit_convenio_faturas
AFTER INSERT OR UPDATE OR DELETE ON public.convenio_faturas
FOR EACH ROW EXECUTE FUNCTION public.tg_audit_convenio_faturas();

-- ---------- 2.1: RPC oficial de cancelamento (sem DELETE) ----------
CREATE OR REPLACE FUNCTION public.convenio_fatura_cancelar(p_fatura_id bigint, p_motivo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.convenio_faturas;
BEGIN
  SELECT * INTO v_row FROM public.convenio_faturas WHERE id = p_fatura_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fatura % não encontrada', p_fatura_id;
  END IF;
  IF v_row.tenant_id <> public.current_tenant_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Acesso negado à fatura %', p_fatura_id USING ERRCODE = '42501';
  END IF;
  IF v_row.status = 'paga' THEN
    RAISE EXCEPTION 'Fatura paga não pode ser cancelada — registre estorno antes';
  END IF;
  IF v_row.status = 'cancelada' THEN
    RETURN jsonb_build_object('ok', true, 'already', true);
  END IF;
  IF COALESCE(p_motivo, '') = '' THEN
    RAISE EXCEPTION 'Motivo do cancelamento é obrigatório';
  END IF;

  UPDATE public.convenio_faturas
  SET status = 'cancelada',
      cancelada_em = now(),
      cancelada_por = auth.uid(),
      motivo_cancelamento = p_motivo
  WHERE id = p_fatura_id;

  RETURN jsonb_build_object('ok', true, 'fatura_id', p_fatura_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.convenio_fatura_cancelar(bigint, text) TO authenticated;

-- ---------- 2.3: SSOT de elegibilidade — status='finalizado' + ignora itens de faturas canceladas ----------
CREATE OR REPLACE FUNCTION public.financeiro_a_receber_totais()
RETURNS TABLE(total_pacientes numeric, qtd_pacientes bigint, total_convenios numeric, qtd_convenios bigint, total_geral numeric)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT
      a.id,
      COALESCE(SUM(CASE WHEN e.cobranca_destino = 'paciente' THEN e.valor ELSE 0 END), 0) AS valor_total
    FROM public.atendimentos a
    LEFT JOIN public.atendimento_exames e ON e.atendimento_id = a.id
    WHERE a.tenant_id = current_tenant_id()
      AND a.status_atendimento <> 'Cancelado'
    GROUP BY a.id
  ),
  pagos AS (
    SELECT atendimento_id, COALESCE(SUM(valor), 0) AS valor_pago
    FROM public.atendimento_pagamentos
    WHERE tenant_id = current_tenant_id()
    GROUP BY atendimento_id
  ),
  pacientes AS (
    SELECT
      ROUND((b.valor_total - COALESCE(p.valor_pago, 0))::numeric, 2) AS saldo
    FROM base b
    LEFT JOIN pagos p ON p.atendimento_id = b.id
    WHERE ROUND((b.valor_total - COALESCE(p.valor_pago, 0))::numeric, 2) > 0.009
  ),
  conv_exames AS (
    SELECT
      e.convenio_cobranca_id AS convenio_id,
      e.valor
    FROM public.atendimento_exames e
    JOIN public.atendimentos a ON a.id = e.atendimento_id
    WHERE e.tenant_id = current_tenant_id()
      AND e.cobranca_destino = 'convenio'
      AND e.status = 'finalizado'  -- SSOT: somente finalizados são elegíveis
      AND e.convenio_cobranca_id IS NOT NULL
      AND a.status_atendimento <> 'Cancelado'
      AND NOT EXISTS (
        SELECT 1 FROM public.convenio_fatura_itens fi
        JOIN public.convenio_faturas f ON f.id = fi.fatura_id
        WHERE fi.atendimento_exame_id = e.id
          AND f.status <> 'cancelada'  -- itens de faturas canceladas voltam a ser elegíveis
      )
  ),
  conv_agg AS (
    SELECT
      ce.convenio_id,
      ROUND(COALESCE(SUM(ce.valor), 0)::numeric, 2) AS saldo
    FROM conv_exames ce
    JOIN public.convenios c
      ON c.id = ce.convenio_id
     AND c.tenant_id = current_tenant_id()
     AND c.id <> 0
    GROUP BY ce.convenio_id
    HAVING ROUND(COALESCE(SUM(ce.valor), 0)::numeric, 2) > 0.009
  ),
  pac_tot AS (
    SELECT COALESCE(SUM(saldo), 0) AS total, COUNT(*)::bigint AS qtd FROM pacientes
  ),
  conv_tot AS (
    SELECT COALESCE(SUM(saldo), 0) AS total, COUNT(*)::bigint AS qtd FROM conv_agg
  )
  SELECT
    ROUND(pac_tot.total, 2),
    pac_tot.qtd,
    ROUND(conv_tot.total, 2),
    conv_tot.qtd,
    ROUND((pac_tot.total + conv_tot.total), 2)
  FROM pac_tot, conv_tot;
$function$;

-- v2: alinhar critério de elegibilidade convenio
CREATE OR REPLACE FUNCTION public.financeiro_a_receber_v2(
  p_tipo text DEFAULT 'paciente'::text,
  p_search text DEFAULT NULL::text,
  p_date_from timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_date_to timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_status text DEFAULT NULL::text,
  p_cursor_data timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_cursor_id bigint DEFAULT NULL::bigint,
  p_limit integer DEFAULT 50
)
RETURNS TABLE(tipo text, ref_id bigint, protocolo text, data timestamp with time zone, desde timestamp with time zone, quem text, convenio_nome text, valor_total numeric, valor_pago numeric, saldo numeric, status text, qtd_exames integer, qtd_pacientes integer)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT
      a.id, a.protocolo, a.data, a.paciente_nome, a.convenio_nome,
      COALESCE(SUM(CASE WHEN e.cobranca_destino = 'paciente' THEN e.valor ELSE 0 END), 0) AS valor_total
    FROM public.atendimentos a
    LEFT JOIN public.atendimento_exames e ON e.atendimento_id = a.id
    WHERE a.tenant_id = current_tenant_id()
      AND a.status_atendimento <> 'Cancelado'
      AND (p_date_from IS NULL OR a.data >= p_date_from)
      AND (p_date_to   IS NULL OR a.data <= p_date_to)
      AND (
        p_search IS NULL OR p_search = ''
        OR lower(a.paciente_nome) LIKE '%' || lower(p_search) || '%'
        OR lower(a.protocolo)     LIKE '%' || lower(p_search) || '%'
      )
    GROUP BY a.id, a.protocolo, a.data, a.paciente_nome, a.convenio_nome
  ),
  pagos AS (
    SELECT atendimento_id, COALESCE(SUM(valor), 0) AS valor_pago
    FROM public.atendimento_pagamentos
    WHERE tenant_id = current_tenant_id()
    GROUP BY atendimento_id
  ),
  pacientes AS (
    SELECT
      'paciente'::text AS tipo,
      b.id::bigint AS ref_id,
      b.protocolo,
      b.data,
      b.data AS desde,
      b.paciente_nome AS quem,
      b.convenio_nome,
      ROUND(b.valor_total::numeric, 2) AS valor_total,
      ROUND(COALESCE(p.valor_pago, 0)::numeric, 2) AS valor_pago,
      ROUND((b.valor_total - COALESCE(p.valor_pago, 0))::numeric, 2) AS saldo,
      CASE
        WHEN COALESCE(p.valor_pago, 0) = 0 THEN 'pendente'
        WHEN COALESCE(p.valor_pago, 0) < b.valor_total THEN 'parcial'
        ELSE 'quitado'
      END AS status,
      0::integer AS qtd_exames,
      1::integer AS qtd_pacientes
    FROM base b
    LEFT JOIN pagos p ON p.atendimento_id = b.id
    WHERE ROUND((b.valor_total - COALESCE(p.valor_pago, 0))::numeric, 2) > 0.009
  ),
  conv_exames AS (
    SELECT
      e.convenio_cobranca_id AS convenio_id,
      e.id AS exame_id,
      e.atendimento_id,
      e.valor,
      a.data,
      a.paciente_nome
    FROM public.atendimento_exames e
    JOIN public.atendimentos a ON a.id = e.atendimento_id
    WHERE e.tenant_id = current_tenant_id()
      AND e.cobranca_destino = 'convenio'
      AND e.status = 'finalizado'
      AND e.convenio_cobranca_id IS NOT NULL
      AND a.status_atendimento <> 'Cancelado'
      AND (p_date_from IS NULL OR a.data >= p_date_from)
      AND (p_date_to   IS NULL OR a.data <= p_date_to)
      AND NOT EXISTS (
        SELECT 1 FROM public.convenio_fatura_itens fi
        JOIN public.convenio_faturas f ON f.id = fi.fatura_id
        WHERE fi.atendimento_exame_id = e.id
          AND f.status <> 'cancelada'
      )
  ),
  convenios_agg AS (
    SELECT
      'convenio'::text AS tipo,
      c.id::bigint AS ref_id,
      ('CONV-' || c.id::text) AS protocolo,
      MAX(ce.data) AS data,
      MIN(ce.data) AS desde,
      c.nome AS quem,
      c.nome AS convenio_nome,
      ROUND(SUM(ce.valor)::numeric, 2) AS valor_total,
      0::numeric AS valor_pago,
      ROUND(SUM(ce.valor)::numeric, 2) AS saldo,
      'pendente'::text AS status,
      COUNT(ce.exame_id)::integer AS qtd_exames,
      COUNT(DISTINCT ce.atendimento_id)::integer AS qtd_pacientes
    FROM conv_exames ce
    JOIN public.convenios c ON c.id = ce.convenio_id AND c.tenant_id = current_tenant_id() AND c.id <> 0
    WHERE (p_search IS NULL OR p_search = '' OR lower(c.nome) LIKE '%' || lower(p_search) || '%')
    GROUP BY c.id, c.nome
    HAVING ROUND(SUM(ce.valor)::numeric, 2) > 0.009
  ),
  unioned AS (
    SELECT * FROM pacientes WHERE p_tipo = 'paciente'
    UNION ALL
    SELECT * FROM convenios_agg WHERE p_tipo = 'convenio'
  )
  SELECT * FROM unioned u
  WHERE (p_status IS NULL OR p_status = '' OR u.status = p_status)
    AND (p_cursor_data IS NULL OR (u.data, u.ref_id) < (p_cursor_data, COALESCE(p_cursor_id, 9223372036854775807)))
  ORDER BY u.data DESC, u.ref_id DESC
  LIMIT p_limit;
$function$;
