
-- Catálogo de planos de assinatura (gerenciado pelo Super Admin)
CREATE TABLE public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  nome text NOT NULL,
  descricao text,
  preco_mensal_cents integer NOT NULL DEFAULT 0,
  preco_anual_cents integer,
  moeda text NOT NULL DEFAULT 'BRL',
  limite_atendimentos_mes integer,
  limite_usuarios integer,
  limite_unidades integer,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  is_public boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.subscription_plans TO anon;
GRANT SELECT ON public.subscription_plans TO authenticated;
GRANT ALL ON public.subscription_plans TO service_role;

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- Leitura pública apenas para planos ativos e públicos
CREATE POLICY "Planos públicos visíveis a todos"
ON public.subscription_plans FOR SELECT
USING (is_active = true AND is_public = true);

-- Super admins veem todos e gerenciam
CREATE POLICY "Super admins gerenciam planos"
ON public.subscription_plans FOR ALL
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER update_subscription_plans_updated_at
BEFORE UPDATE ON public.subscription_plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Garante apenas um plano default
CREATE UNIQUE INDEX subscription_plans_single_default
ON public.subscription_plans (is_default) WHERE is_default = true;

-- Estado de billing por tenant
CREATE TABLE public.tenant_subscriptions_billing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_code text NOT NULL REFERENCES public.subscription_plans(code),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('trial','active','past_due','canceled','paused')),
  billing_cycle text NOT NULL DEFAULT 'free' CHECK (billing_cycle IN ('monthly','yearly','free')),
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  mrr_cents integer NOT NULL DEFAULT 0,
  canceled_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_subscriptions_billing TO authenticated;
GRANT ALL ON public.tenant_subscriptions_billing TO service_role;

ALTER TABLE public.tenant_subscriptions_billing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins gerenciam billing"
ON public.tenant_subscriptions_billing FOR ALL
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Tenant vê próprio billing"
ON public.tenant_subscriptions_billing FOR SELECT
USING (tenant_id = public.current_tenant_id());

CREATE TRIGGER update_tenant_subscriptions_billing_updated_at
BEFORE UPDATE ON public.tenant_subscriptions_billing
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Log de mudanças de plano (histórico)
CREATE TABLE public.subscription_changes_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  from_plan_code text,
  to_plan_code text,
  from_status text,
  to_status text,
  action text NOT NULL,
  changed_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.subscription_changes_log TO authenticated;
GRANT ALL ON public.subscription_changes_log TO service_role;

ALTER TABLE public.subscription_changes_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins veem todo histórico"
ON public.subscription_changes_log FOR SELECT
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins inserem histórico"
ON public.subscription_changes_log FOR INSERT
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE INDEX idx_subscription_changes_log_tenant ON public.subscription_changes_log(tenant_id, created_at DESC);

-- Seed do plano padrão "Grátis"
INSERT INTO public.subscription_plans (code, nome, descricao, preco_mensal_cents, moeda, features, is_active, is_public, is_default, sort_order)
VALUES (
  'gratis',
  'Grátis',
  'Plano inicial para começar a usar o SISLAC sem custos.',
  0,
  'BRL',
  '["Atendimentos ilimitados","Cadastro de pacientes","Resultados e laudos","Suporte por e-mail"]'::jsonb,
  true,
  true,
  true,
  0
);

-- Cria billing automaticamente para tenants existentes (plano Grátis)
INSERT INTO public.tenant_subscriptions_billing (tenant_id, plan_code, status, billing_cycle, mrr_cents)
SELECT id, 'gratis', 'active', 'free', 0
FROM public.tenants
ON CONFLICT (tenant_id) DO NOTHING;

-- Trigger para criar billing ao criar tenant
CREATE OR REPLACE FUNCTION public.ensure_tenant_billing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_code text;
BEGIN
  SELECT code INTO default_code FROM public.subscription_plans WHERE is_default = true LIMIT 1;
  IF default_code IS NULL THEN
    default_code := 'gratis';
  END IF;
  INSERT INTO public.tenant_subscriptions_billing (tenant_id, plan_code, status, billing_cycle, mrr_cents)
  VALUES (NEW.id, default_code, 'active', 'free', 0)
  ON CONFLICT (tenant_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER ensure_tenant_billing_after_insert
AFTER INSERT ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.ensure_tenant_billing();
