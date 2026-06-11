
-- Status enum
DO $$ BEGIN
  CREATE TYPE public.subscription_status AS ENUM ('pendente','aprovado','reprovado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.blocklist_tipo AS ENUM ('cnpj','email','whatsapp');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Subscriptions
CREATE TABLE IF NOT EXISTS public.tenant_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_lab text NOT NULL,
  cnpj text NOT NULL,
  whatsapp text NOT NULL,
  admin_nome text NOT NULL,
  admin_email text NOT NULL,
  admin_senha_hash text NOT NULL,
  status public.subscription_status NOT NULL DEFAULT 'pendente',
  motivo_reprovacao text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  approved_tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  approved_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_status ON public.tenant_subscriptions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_cnpj ON public.tenant_subscriptions(cnpj);
CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_email ON public.tenant_subscriptions(lower(admin_email));

ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subs_super_admin_select" ON public.tenant_subscriptions;
CREATE POLICY "subs_super_admin_select" ON public.tenant_subscriptions
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "subs_super_admin_update" ON public.tenant_subscriptions;
CREATE POLICY "subs_super_admin_update" ON public.tenant_subscriptions
  FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "subs_super_admin_delete" ON public.tenant_subscriptions;
CREATE POLICY "subs_super_admin_delete" ON public.tenant_subscriptions
  FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- Sem policy de INSERT: signup público entra via edge function (service role)

DROP TRIGGER IF EXISTS trg_tenant_subscriptions_updated_at ON public.tenant_subscriptions;
CREATE TRIGGER trg_tenant_subscriptions_updated_at
  BEFORE UPDATE ON public.tenant_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Blocklist
CREATE TABLE IF NOT EXISTS public.tenant_blocklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo public.blocklist_tipo NOT NULL,
  valor text NOT NULL,
  motivo text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_blocklist_tipo_valor
  ON public.tenant_blocklist(tipo, lower(valor));

ALTER TABLE public.tenant_blocklist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "block_super_admin_select" ON public.tenant_blocklist;
CREATE POLICY "block_super_admin_select" ON public.tenant_blocklist
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "block_super_admin_insert" ON public.tenant_blocklist;
CREATE POLICY "block_super_admin_insert" ON public.tenant_blocklist
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "block_super_admin_delete" ON public.tenant_blocklist;
CREATE POLICY "block_super_admin_delete" ON public.tenant_blocklist
  FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));
