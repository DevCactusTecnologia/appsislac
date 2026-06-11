-- ============================================================
-- FASE 1: Cobrança híbrida paciente/convênio
-- ============================================================

-- 1) Convênios: novas configurações
ALTER TABLE public.convenios
  ADD COLUMN IF NOT EXISTS libera_fluxo_sem_pagamento boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prazo_faturamento_dias integer NOT NULL DEFAULT 30;

-- 2) Atendimento exames: destino de cobrança por exame
ALTER TABLE public.atendimento_exames
  ADD COLUMN IF NOT EXISTS cobranca_destino text NOT NULL DEFAULT 'paciente',
  ADD COLUMN IF NOT EXISTS convenio_cobranca_id integer NULL REFERENCES public.convenios(id);

-- Constraint de validação (não usar CHECK time-based — apenas enum estático: ok)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'atex_cobranca_destino_chk'
  ) THEN
    ALTER TABLE public.atendimento_exames
      ADD CONSTRAINT atex_cobranca_destino_chk
      CHECK (cobranca_destino IN ('paciente','convenio'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_atex_cobranca
  ON public.atendimento_exames(tenant_id, convenio_cobranca_id, cobranca_destino);

-- 3) Faturas de convênio (cabeçalho de lote)
CREATE TABLE IF NOT EXISTS public.convenio_faturas (
  id              bigserial PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  convenio_id     integer NOT NULL REFERENCES public.convenios(id),
  codigo          text NOT NULL,
  periodo_inicio  date NOT NULL,
  periodo_fim     date NOT NULL,
  subtotal        numeric(12,2) NOT NULL DEFAULT 0,
  desconto        numeric(12,2) NOT NULL DEFAULT 0,
  total           numeric(12,2) NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'aberta',
  forma_pagamento text NOT NULL DEFAULT '',
  data_pagamento  date NULL,
  observacao      text NOT NULL DEFAULT '',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cf_status_chk CHECK (status IN ('aberta','fechada','paga','cancelada')),
  UNIQUE (tenant_id, codigo)
);

CREATE INDEX IF NOT EXISTS idx_cf_tenant_status ON public.convenio_faturas(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_cf_convenio ON public.convenio_faturas(tenant_id, convenio_id);

-- 4) Itens da fatura (vincula exames cobrados do convênio à fatura)
CREATE TABLE IF NOT EXISTS public.convenio_fatura_itens (
  id                    bigserial PRIMARY KEY,
  tenant_id             uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  fatura_id             bigint NOT NULL REFERENCES public.convenio_faturas(id) ON DELETE CASCADE,
  atendimento_exame_id  bigint NOT NULL REFERENCES public.atendimento_exames(id) ON DELETE RESTRICT,
  valor                 numeric(12,2) NOT NULL DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (atendimento_exame_id)  -- 1 exame entra em apenas 1 fatura
);

CREATE INDEX IF NOT EXISTS idx_cfi_fatura ON public.convenio_fatura_itens(tenant_id, fatura_id);

-- 5) Triggers updated_at
CREATE OR REPLACE FUNCTION public.touch_convenio_faturas_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_cf_touch ON public.convenio_faturas;
CREATE TRIGGER trg_cf_touch
  BEFORE UPDATE ON public.convenio_faturas
  FOR EACH ROW EXECUTE FUNCTION public.touch_convenio_faturas_updated_at();

-- 6) Trigger de proteção: fatura paga não pode ser editada (exceto cancelada→paga)
CREATE OR REPLACE FUNCTION public.protect_convenio_fatura_paga()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status = 'paga' AND NEW.status <> 'cancelada' THEN
    -- Permite apenas mudança para 'cancelada' (estorno) ou nenhuma alteração estrutural
    IF NEW.subtotal IS DISTINCT FROM OLD.subtotal
       OR NEW.desconto IS DISTINCT FROM OLD.desconto
       OR NEW.total    IS DISTINCT FROM OLD.total
       OR NEW.periodo_inicio IS DISTINCT FROM OLD.periodo_inicio
       OR NEW.periodo_fim    IS DISTINCT FROM OLD.periodo_fim THEN
      RAISE EXCEPTION 'Fatura paga não pode ser editada (use Cancelar para estornar)';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_cf_protect ON public.convenio_faturas;
CREATE TRIGGER trg_cf_protect
  BEFORE UPDATE ON public.convenio_faturas
  FOR EACH ROW EXECUTE FUNCTION public.protect_convenio_fatura_paga();

-- 7) RLS
ALTER TABLE public.convenio_faturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.convenio_fatura_itens ENABLE ROW LEVEL SECURITY;

-- convenio_faturas
CREATE POLICY cf_select ON public.convenio_faturas
  FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()) OR ((tenant_id = current_tenant_id()) AND has_permission(auth.uid(), 'visualizar_financeiro')));

CREATE POLICY cf_insert ON public.convenio_faturas
  FOR INSERT TO authenticated
  WITH CHECK ((tenant_id = current_tenant_id()) AND has_permission(auth.uid(), 'gestao_financeira'));

CREATE POLICY cf_update ON public.convenio_faturas
  FOR UPDATE TO authenticated
  USING ((tenant_id = current_tenant_id()) AND has_permission(auth.uid(), 'gestao_financeira'))
  WITH CHECK ((tenant_id = current_tenant_id()) AND has_permission(auth.uid(), 'gestao_financeira'));

CREATE POLICY cf_delete ON public.convenio_faturas
  FOR DELETE TO authenticated
  USING ((tenant_id = current_tenant_id()) AND has_role(auth.uid(), 'admin'::app_role));

-- convenio_fatura_itens
CREATE POLICY cfi_select ON public.convenio_fatura_itens
  FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()) OR ((tenant_id = current_tenant_id()) AND has_permission(auth.uid(), 'visualizar_financeiro')));

CREATE POLICY cfi_insert ON public.convenio_fatura_itens
  FOR INSERT TO authenticated
  WITH CHECK ((tenant_id = current_tenant_id()) AND has_permission(auth.uid(), 'gestao_financeira'));

CREATE POLICY cfi_update ON public.convenio_fatura_itens
  FOR UPDATE TO authenticated
  USING ((tenant_id = current_tenant_id()) AND has_permission(auth.uid(), 'gestao_financeira'))
  WITH CHECK ((tenant_id = current_tenant_id()) AND has_permission(auth.uid(), 'gestao_financeira'));

CREATE POLICY cfi_delete ON public.convenio_fatura_itens
  FOR DELETE TO authenticated
  USING ((tenant_id = current_tenant_id()) AND has_role(auth.uid(), 'admin'::app_role));

-- 8) Recalcula status_pagamento ignorando exames cobrados do convênio
CREATE OR REPLACE FUNCTION public.recompute_atendimento_status(_atendimento_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  total_exames INT;
  total_cancelados INT;
  total_finalizados INT;
  total_em_analise INT;
  total_coletados INT;
  ativos INT;
  novo_status_at TEXT;
  total_valor_paciente NUMERIC(12,2);
  total_pago NUMERIC(12,2);
  novo_status_pg TEXT;
BEGIN
  SELECT
    count(*),
    count(*) FILTER (WHERE status = 'cancelado'),
    count(*) FILTER (WHERE status = 'finalizado'),
    count(*) FILTER (WHERE status = 'em_analise'),
    count(*) FILTER (WHERE status = 'coletado')
  INTO total_exames, total_cancelados, total_finalizados, total_em_analise, total_coletados
  FROM public.atendimento_exames
  WHERE atendimento_id = _atendimento_id;

  ativos := total_exames - total_cancelados;

  IF total_exames = 0 THEN
    novo_status_at := 'Pedido Realizado';
  ELSIF total_cancelados = total_exames THEN
    novo_status_at := 'Cancelado';
  ELSIF total_finalizados = ativos THEN
    novo_status_at := 'Resultado Liberado';
  ELSIF (total_finalizados + total_em_analise) = ativos AND total_em_analise > 0 THEN
    novo_status_at := 'Amostra Analisada';
  ELSIF (total_finalizados + total_em_analise + total_coletados) > 0 THEN
    novo_status_at := 'Amostra Coletada';
  ELSE
    novo_status_at := 'Pedido Realizado';
  END IF;

  -- Apenas exames cobrados do PACIENTE entram no status de pagamento
  SELECT COALESCE(SUM(valor), 0) INTO total_valor_paciente
  FROM public.atendimento_exames
  WHERE atendimento_id = _atendimento_id
    AND status <> 'cancelado'
    AND cobranca_destino = 'paciente';

  SELECT COALESCE(SUM(valor), 0) INTO total_pago
  FROM public.atendimento_pagamentos
  WHERE atendimento_id = _atendimento_id;

  IF total_cancelados = total_exames AND total_exames > 0 THEN
    novo_status_pg := 'Pagamento cancelado';
  ELSIF ativos = 0 THEN
    novo_status_pg := 'Pagamento efetuado';
  ELSIF total_valor_paciente = 0 THEN
    -- Tudo é cobrado de convênios → paciente nada deve
    novo_status_pg := 'Pagamento efetuado';
  ELSIF total_pago > 0 AND total_pago >= total_valor_paciente THEN
    novo_status_pg := 'Pagamento efetuado';
  ELSIF total_pago > 0 AND total_pago < total_valor_paciente THEN
    novo_status_pg := 'Pagamento parcial';
  ELSE
    novo_status_pg := 'Pagamento pendente';
  END IF;

  UPDATE public.atendimentos
  SET status_atendimento = novo_status_at,
      status_pagamento = novo_status_pg
  WHERE id = _atendimento_id;
END;
$function$;