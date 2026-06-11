-- ============================================================
-- MÓDULO DE ESTOQUE — SISLAC
-- ============================================================

-- 1) FORNECEDORES (catálogo simples)
CREATE TABLE public.estoque_fornecedores (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome text NOT NULL,
  cnpj text NOT NULL DEFAULT '',
  contato text NOT NULL DEFAULT '',
  telefone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_estoque_fornecedores_tenant ON public.estoque_fornecedores(tenant_id);
ALTER TABLE public.estoque_fornecedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY estfor_select ON public.estoque_fornecedores FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()) OR tenant_id = current_tenant_id());
CREATE POLICY estfor_insert ON public.estoque_fornecedores FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_tenant_id() AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY estfor_update ON public.estoque_fornecedores FOR UPDATE TO authenticated
  USING (tenant_id = current_tenant_id() AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (tenant_id = current_tenant_id() AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY estfor_delete ON public.estoque_fornecedores FOR DELETE TO authenticated
  USING (tenant_id = current_tenant_id() AND has_role(auth.uid(), 'admin'::app_role));

-- 2) INSUMOS (catálogo)
CREATE TABLE public.estoque_insumos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  codigo text NOT NULL DEFAULT '',
  nome text NOT NULL,
  categoria text NOT NULL DEFAULT 'Outros',
  unidade_medida text NOT NULL DEFAULT 'un',
  fornecedor_id uuid REFERENCES public.estoque_fornecedores(id) ON DELETE SET NULL,
  estoque_minimo numeric(12,3) NOT NULL DEFAULT 0,
  alerta_validade_dias integer NOT NULL DEFAULT 30,
  observacao text NOT NULL DEFAULT '',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_estoque_insumos_tenant ON public.estoque_insumos(tenant_id);
CREATE INDEX idx_estoque_insumos_categoria ON public.estoque_insumos(tenant_id, categoria);
CREATE INDEX idx_estoque_insumos_nome ON public.estoque_insumos(tenant_id, nome);
ALTER TABLE public.estoque_insumos ENABLE ROW LEVEL SECURITY;

CREATE POLICY estins_select ON public.estoque_insumos FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()) OR tenant_id = current_tenant_id());
CREATE POLICY estins_insert ON public.estoque_insumos FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_tenant_id() AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY estins_update ON public.estoque_insumos FOR UPDATE TO authenticated
  USING (tenant_id = current_tenant_id() AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (tenant_id = current_tenant_id() AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY estins_delete ON public.estoque_insumos FOR DELETE TO authenticated
  USING (tenant_id = current_tenant_id() AND has_role(auth.uid(), 'admin'::app_role));

-- 3) LOTES
CREATE TABLE public.estoque_lotes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  insumo_id uuid NOT NULL REFERENCES public.estoque_insumos(id) ON DELETE CASCADE,
  numero_lote text NOT NULL,
  data_validade date NOT NULL,
  quantidade_inicial numeric(12,3) NOT NULL DEFAULT 0,
  quantidade_atual numeric(12,3) NOT NULL DEFAULT 0,
  custo_unitario numeric(12,4) NOT NULL DEFAULT 0,
  fornecedor_id uuid REFERENCES public.estoque_fornecedores(id) ON DELETE SET NULL,
  data_entrada date NOT NULL DEFAULT CURRENT_DATE,
  nota_fiscal text NOT NULL DEFAULT '',
  observacao text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'ativo',  -- ativo | esgotado | vencido | descartado
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_estoque_lotes_tenant ON public.estoque_lotes(tenant_id);
CREATE INDEX idx_estoque_lotes_insumo ON public.estoque_lotes(insumo_id);
CREATE INDEX idx_estoque_lotes_validade ON public.estoque_lotes(tenant_id, data_validade);
ALTER TABLE public.estoque_lotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY estlot_select ON public.estoque_lotes FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()) OR tenant_id = current_tenant_id());
CREATE POLICY estlot_insert ON public.estoque_lotes FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_tenant_id() AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY estlot_update ON public.estoque_lotes FOR UPDATE TO authenticated
  USING (tenant_id = current_tenant_id() AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (tenant_id = current_tenant_id() AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY estlot_delete ON public.estoque_lotes FOR DELETE TO authenticated
  USING (tenant_id = current_tenant_id() AND has_role(auth.uid(), 'admin'::app_role));

-- 4) MOVIMENTAÇÕES (entrada / saida / ajuste / descarte)
CREATE TABLE public.estoque_movimentacoes (
  id bigserial PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  insumo_id uuid NOT NULL REFERENCES public.estoque_insumos(id) ON DELETE CASCADE,
  lote_id uuid REFERENCES public.estoque_lotes(id) ON DELETE SET NULL,
  tipo text NOT NULL,  -- entrada | saida | ajuste | descarte
  quantidade numeric(12,3) NOT NULL,
  motivo text NOT NULL DEFAULT '',
  observacao text NOT NULL DEFAULT '',
  usuario_email text NOT NULL DEFAULT '',
  data timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_estoque_mov_tenant ON public.estoque_movimentacoes(tenant_id);
CREATE INDEX idx_estoque_mov_insumo ON public.estoque_movimentacoes(insumo_id);
CREATE INDEX idx_estoque_mov_lote ON public.estoque_movimentacoes(lote_id);
CREATE INDEX idx_estoque_mov_data ON public.estoque_movimentacoes(tenant_id, data DESC);
ALTER TABLE public.estoque_movimentacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY estmov_select ON public.estoque_movimentacoes FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()) OR tenant_id = current_tenant_id());
CREATE POLICY estmov_insert ON public.estoque_movimentacoes FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_tenant_id() AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY estmov_delete ON public.estoque_movimentacoes FOR DELETE TO authenticated
  USING (tenant_id = current_tenant_id() AND has_role(auth.uid(), 'admin'::app_role));

-- triggers updated_at
CREATE TRIGGER touch_estoque_fornecedores BEFORE UPDATE ON public.estoque_fornecedores
  FOR EACH ROW EXECUTE FUNCTION public.touch_app_settings_updated_at();
CREATE TRIGGER touch_estoque_insumos BEFORE UPDATE ON public.estoque_insumos
  FOR EACH ROW EXECUTE FUNCTION public.touch_app_settings_updated_at();
CREATE TRIGGER touch_estoque_lotes BEFORE UPDATE ON public.estoque_lotes
  FOR EACH ROW EXECUTE FUNCTION public.touch_app_settings_updated_at();

-- trigger: ao inserir movimentação, atualizar quantidade_atual do lote (e status)
CREATE OR REPLACE FUNCTION public.estoque_aplicar_movimentacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_delta numeric(12,3);
  v_qtd numeric(12,3);
BEGIN
  IF NEW.lote_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_delta := CASE NEW.tipo
    WHEN 'entrada' THEN NEW.quantidade
    WHEN 'saida'   THEN -NEW.quantidade
    WHEN 'descarte' THEN -NEW.quantidade
    WHEN 'ajuste'  THEN NEW.quantidade  -- pode ser negativo, controle no front
    ELSE 0
  END;

  UPDATE public.estoque_lotes
     SET quantidade_atual = GREATEST(0, quantidade_atual + v_delta),
         updated_at = now()
   WHERE id = NEW.lote_id
   RETURNING quantidade_atual INTO v_qtd;

  IF v_qtd <= 0 AND NEW.tipo IN ('saida','descarte','ajuste') THEN
    UPDATE public.estoque_lotes
       SET status = 'esgotado'
     WHERE id = NEW.lote_id AND status = 'ativo';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_aplicar_movimentacao
AFTER INSERT ON public.estoque_movimentacoes
FOR EACH ROW EXECUTE FUNCTION public.estoque_aplicar_movimentacao();

-- function: marcar lotes vencidos
CREATE OR REPLACE FUNCTION public.estoque_marcar_lotes_vencidos()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.estoque_lotes
     SET status = 'vencido'
   WHERE status = 'ativo'
     AND data_validade < CURRENT_DATE;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;