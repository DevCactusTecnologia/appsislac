-- ========================================
-- FINANCEIRO 2.0 — FASE 2
-- Decisão 1: revoga DELETE em atendimento_pagamentos (estorno é o caminho oficial)
-- Decisão 3: persiste subtotal/desconto_total/acrescimo_total/total em atendimentos
-- ========================================

-- 1) DELETE em atendimento_pagamentos: revogado (RLS).
--    O trigger trg_block_delete_pagamentos já barra; aqui removemos a policy RLS
--    para que nem chegue ao trigger via path operacional. service_role mantém
--    capacidade técnica (bypass RLS).
DROP POLICY IF EXISTS atpag_delete ON public.atendimento_pagamentos;

-- 2) Colunas financeiras canônicas no cabeçalho do atendimento.
ALTER TABLE public.atendimentos
  ADD COLUMN IF NOT EXISTS subtotal         numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS desconto_total   numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS acrescimo_total  numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total            numeric(12,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.atendimentos.subtotal        IS 'Soma de valor_original dos exames não cancelados (preço cheio).';
COMMENT ON COLUMN public.atendimentos.desconto_total  IS 'Diferença subtotal - total quando subtotal > total. Persistido para auditoria.';
COMMENT ON COLUMN public.atendimentos.acrescimo_total IS 'Diferença total - subtotal quando total > subtotal. Persistido para auditoria.';
COMMENT ON COLUMN public.atendimentos.total           IS 'Soma de valor (líquido) dos exames não cancelados. Total cobrado ao cliente.';

-- 3) Função que recalcula totais a partir de atendimento_exames.
CREATE OR REPLACE FUNCTION public.recompute_atendimento_totais(_atendimento_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_subtotal numeric(12,2) := 0;
  v_total    numeric(12,2) := 0;
  v_delta    numeric(12,2);
BEGIN
  SELECT
    COALESCE(SUM(COALESCE(valor_original, valor)), 0),
    COALESCE(SUM(valor), 0)
  INTO v_subtotal, v_total
  FROM public.atendimento_exames
  WHERE atendimento_id = _atendimento_id
    AND COALESCE(status,'') <> 'cancelado';

  v_delta := v_subtotal - v_total;

  UPDATE public.atendimentos
     SET subtotal        = v_subtotal,
         total           = v_total,
         desconto_total  = CASE WHEN v_delta > 0 THEN v_delta ELSE 0 END,
         acrescimo_total = CASE WHEN v_delta < 0 THEN -v_delta ELSE 0 END
   WHERE id = _atendimento_id;
END;
$$;

-- 4) Trigger que dispara o recompute em qualquer alteração de exames.
CREATE OR REPLACE FUNCTION public.trg_recompute_totais_on_exame()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_atendimento_totais(OLD.atendimento_id);
    RETURN OLD;
  ELSE
    PERFORM public.recompute_atendimento_totais(NEW.atendimento_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS recompute_totais_on_exame ON public.atendimento_exames;
CREATE TRIGGER recompute_totais_on_exame
AFTER INSERT OR UPDATE OR DELETE ON public.atendimento_exames
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_totais_on_exame();

-- 5) Backfill dos atendimentos existentes.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.atendimentos LOOP
    PERFORM public.recompute_atendimento_totais(r.id);
  END LOOP;
END$$;