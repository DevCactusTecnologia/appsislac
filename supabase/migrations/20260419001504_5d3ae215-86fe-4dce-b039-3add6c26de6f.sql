-- 3 tabelas separadas para listas personalizáveis do Financeiro
-- Cada uma com tenant_id, nome único por tenant, ativo, sistema (proteção)

-- ============ TIPOS DE DESPESA ============
CREATE TABLE public.financeiro_tipos_despesa (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  sistema boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT financeiro_tipos_despesa_unique_nome UNIQUE (tenant_id, nome)
);

CREATE INDEX idx_financeiro_tipos_despesa_tenant ON public.financeiro_tipos_despesa(tenant_id);

ALTER TABLE public.financeiro_tipos_despesa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fintipdesp_select" ON public.financeiro_tipos_despesa
  FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()) OR (tenant_id = current_tenant_id()));

CREATE POLICY "fintipdesp_insert" ON public.financeiro_tipos_despesa
  FOR INSERT TO authenticated
  WITH CHECK ((tenant_id = current_tenant_id()) AND has_permission(auth.uid(), 'gestao_financeira'));

CREATE POLICY "fintipdesp_update" ON public.financeiro_tipos_despesa
  FOR UPDATE TO authenticated
  USING ((tenant_id = current_tenant_id()) AND has_permission(auth.uid(), 'gestao_financeira'))
  WITH CHECK ((tenant_id = current_tenant_id()) AND has_permission(auth.uid(), 'gestao_financeira'));

CREATE POLICY "fintipdesp_delete" ON public.financeiro_tipos_despesa
  FOR DELETE TO authenticated
  USING ((tenant_id = current_tenant_id()) AND has_permission(auth.uid(), 'gestao_financeira') AND sistema = false);

-- ============ DESTINOS DE PAGAMENTO ============
CREATE TABLE public.financeiro_destinos_pagamento (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  sistema boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT financeiro_destinos_pagamento_unique_nome UNIQUE (tenant_id, nome)
);

CREATE INDEX idx_financeiro_destinos_pagamento_tenant ON public.financeiro_destinos_pagamento(tenant_id);

ALTER TABLE public.financeiro_destinos_pagamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "findestpag_select" ON public.financeiro_destinos_pagamento
  FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()) OR (tenant_id = current_tenant_id()));

CREATE POLICY "findestpag_insert" ON public.financeiro_destinos_pagamento
  FOR INSERT TO authenticated
  WITH CHECK ((tenant_id = current_tenant_id()) AND has_permission(auth.uid(), 'gestao_financeira'));

CREATE POLICY "findestpag_update" ON public.financeiro_destinos_pagamento
  FOR UPDATE TO authenticated
  USING ((tenant_id = current_tenant_id()) AND has_permission(auth.uid(), 'gestao_financeira'))
  WITH CHECK ((tenant_id = current_tenant_id()) AND has_permission(auth.uid(), 'gestao_financeira'));

CREATE POLICY "findestpag_delete" ON public.financeiro_destinos_pagamento
  FOR DELETE TO authenticated
  USING ((tenant_id = current_tenant_id()) AND has_permission(auth.uid(), 'gestao_financeira') AND sistema = false);

-- ============ FORMAS DE PAGAMENTO ============
CREATE TABLE public.financeiro_formas_pagamento (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  sistema boolean NOT NULL DEFAULT false,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT financeiro_formas_pagamento_unique_nome UNIQUE (tenant_id, nome)
);

CREATE INDEX idx_financeiro_formas_pagamento_tenant ON public.financeiro_formas_pagamento(tenant_id);

ALTER TABLE public.financeiro_formas_pagamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finformpag_select" ON public.financeiro_formas_pagamento
  FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()) OR (tenant_id = current_tenant_id()));

CREATE POLICY "finformpag_insert" ON public.financeiro_formas_pagamento
  FOR INSERT TO authenticated
  WITH CHECK ((tenant_id = current_tenant_id()) AND has_permission(auth.uid(), 'gestao_financeira'));

CREATE POLICY "finformpag_update" ON public.financeiro_formas_pagamento
  FOR UPDATE TO authenticated
  USING ((tenant_id = current_tenant_id()) AND has_permission(auth.uid(), 'gestao_financeira'))
  WITH CHECK ((tenant_id = current_tenant_id()) AND has_permission(auth.uid(), 'gestao_financeira'));

CREATE POLICY "finformpag_delete" ON public.financeiro_formas_pagamento
  FOR DELETE TO authenticated
  USING ((tenant_id = current_tenant_id()) AND has_permission(auth.uid(), 'gestao_financeira') AND sistema = false);

-- ============ TRIGGERS updated_at ============
CREATE OR REPLACE FUNCTION public.touch_financeiro_listas_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_touch_financeiro_tipos_despesa
  BEFORE UPDATE ON public.financeiro_tipos_despesa
  FOR EACH ROW EXECUTE FUNCTION public.touch_financeiro_listas_updated_at();

CREATE TRIGGER trg_touch_financeiro_destinos_pagamento
  BEFORE UPDATE ON public.financeiro_destinos_pagamento
  FOR EACH ROW EXECUTE FUNCTION public.touch_financeiro_listas_updated_at();

CREATE TRIGGER trg_touch_financeiro_formas_pagamento
  BEFORE UPDATE ON public.financeiro_formas_pagamento
  FOR EACH ROW EXECUTE FUNCTION public.touch_financeiro_listas_updated_at();

-- ============ SEED DEFAULTS PARA CADA TENANT EXISTENTE ============
-- Tipos de despesa padrão do sistema
INSERT INTO public.financeiro_tipos_despesa (tenant_id, nome, sistema)
SELECT t.id, n.nome, true
FROM public.tenants t
CROSS JOIN (VALUES
  ('Aluguel'), ('Energia elétrica'), ('Água'), ('Internet/Telefone'),
  ('Material de escritório'), ('Material de limpeza'), ('Material laboratorial'),
  ('Reagentes'), ('Salários'), ('Encargos sociais'), ('Impostos'),
  ('Manutenção de equipamentos'), ('Marketing'), ('Combustível'), ('Outros')
) AS n(nome)
ON CONFLICT (tenant_id, nome) DO NOTHING;

-- Destinos de pagamento padrão do sistema
INSERT INTO public.financeiro_destinos_pagamento (tenant_id, nome, sistema)
SELECT t.id, n.nome, true
FROM public.tenants t
CROSS JOIN (VALUES
  ('Fornecedor'), ('Funcionário'), ('Governo'), ('Banco'),
  ('Concessionária'), ('Prestador de serviço'), ('Outros')
) AS n(nome)
ON CONFLICT (tenant_id, nome) DO NOTHING;

-- Formas de pagamento padrão do sistema (as 6 atuais hardcoded)
INSERT INTO public.financeiro_formas_pagamento (tenant_id, nome, sistema, ordem)
SELECT t.id, n.nome, true, n.ordem
FROM public.tenants t
CROSS JOIN (VALUES
  ('Dinheiro', 1), ('PIX', 2), ('Cartão de Débito', 3),
  ('Cartão de Crédito', 4), ('Boleto', 5), ('Transferência', 6)
) AS n(nome, ordem)
ON CONFLICT (tenant_id, nome) DO NOTHING;

-- ============ MIGRAR DADOS de app_settings (custom lists antigas) ============
-- Tipos custom (não-sistema)
INSERT INTO public.financeiro_tipos_despesa (tenant_id, nome, sistema)
SELECT s.tenant_id, jsonb_array_elements_text(s.value), false
FROM public.app_settings s
WHERE s.key = 'financeiro:tipos_despesa_custom'
  AND jsonb_typeof(s.value) = 'array'
ON CONFLICT (tenant_id, nome) DO NOTHING;

-- Destinos custom (não-sistema)
INSERT INTO public.financeiro_destinos_pagamento (tenant_id, nome, sistema)
SELECT s.tenant_id, jsonb_array_elements_text(s.value), false
FROM public.app_settings s
WHERE s.key = 'financeiro:destinos_pagamento_custom'
  AND jsonb_typeof(s.value) = 'array'
ON CONFLICT (tenant_id, nome) DO NOTHING;

-- ============ TRIGGER de proteção: não permitir alterar sistema=true ============
CREATE OR REPLACE FUNCTION public.protect_financeiro_listas_sistema()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.sistema = true AND TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Itens do sistema não podem ser excluídos';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.sistema = true AND NEW.nome <> OLD.nome THEN
    RAISE EXCEPTION 'Itens do sistema não podem ser renomeados';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_protect_financeiro_tipos_despesa
  BEFORE UPDATE OR DELETE ON public.financeiro_tipos_despesa
  FOR EACH ROW EXECUTE FUNCTION public.protect_financeiro_listas_sistema();

CREATE TRIGGER trg_protect_financeiro_destinos_pagamento
  BEFORE UPDATE OR DELETE ON public.financeiro_destinos_pagamento
  FOR EACH ROW EXECUTE FUNCTION public.protect_financeiro_listas_sistema();

CREATE TRIGGER trg_protect_financeiro_formas_pagamento
  BEFORE UPDATE OR DELETE ON public.financeiro_formas_pagamento
  FOR EACH ROW EXECUTE FUNCTION public.protect_financeiro_listas_sistema();