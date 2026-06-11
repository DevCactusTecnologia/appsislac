
-- ════════════════════════════════════════════════════════════════════════
-- ONDA 1 — Control Plane: tenant_registry (fonte de verdade global de
-- provisionamento e roteamento de banco por laboratório).
--
-- NÃO altera nenhum tenant existente. Todos ficam strategy='shared' e
-- continuam usando o banco compartilhado atual + RLS. Esta tabela é
-- aditiva e reversível com DROP TABLE.
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.tenant_registry (
  tenant_id              uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  slug                   text NOT NULL,
  laboratorio            text NOT NULL,
  database_strategy      text NOT NULL DEFAULT 'shared' CHECK (database_strategy IN ('shared','dedicated')),
  db_host                text,
  db_name                text,
  db_user                text,
  db_secret_ref          text,
  schema_version         text NOT NULL DEFAULT 'v0',
  runtime_status         text NOT NULL DEFAULT 'active'        CHECK (runtime_status IN ('active','suspended','failed')),
  provisioning_status    text NOT NULL DEFAULT 'active'        CHECK (provisioning_status IN ('pending','provisioning','validating','active','suspended','failed')),
  billing_status         text NOT NULL DEFAULT 'ok',
  storage_namespace      text,
  last_health_at         timestamptz,
  last_error             text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tenant_registry_slug_idx           ON public.tenant_registry(slug);
CREATE INDEX IF NOT EXISTS tenant_registry_runtime_status_idx ON public.tenant_registry(runtime_status);
CREATE INDEX IF NOT EXISTS tenant_registry_strategy_idx       ON public.tenant_registry(database_strategy);

-- Trigger updated_at
CREATE TRIGGER trg_tenant_registry_updated_at
BEFORE UPDATE ON public.tenant_registry
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ────────────────────────────────────────────────────────────────────────
-- RLS — control-plane é global; somente super_admin pode ler/escrever via
-- API pública. Edge functions de plataforma usam service-role (bypass).
-- ────────────────────────────────────────────────────────────────────────
ALTER TABLE public.tenant_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_registry super_admin select"
  ON public.tenant_registry FOR SELECT
  USING (public.is_super_admin());

CREATE POLICY "tenant_registry super_admin insert"
  ON public.tenant_registry FOR INSERT
  WITH CHECK (public.is_super_admin());

CREATE POLICY "tenant_registry super_admin update"
  ON public.tenant_registry FOR UPDATE
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "tenant_registry super_admin delete"
  ON public.tenant_registry FOR DELETE
  USING (public.is_super_admin());

-- ────────────────────────────────────────────────────────────────────────
-- Backfill — 1 linha por tenant existente, todos shared/active.
-- ────────────────────────────────────────────────────────────────────────
INSERT INTO public.tenant_registry (
  tenant_id, slug, laboratorio, database_strategy, schema_version,
  runtime_status, provisioning_status, storage_namespace
)
SELECT
  t.id,
  COALESCE(NULLIF(t.slug, ''), t.id::text),
  COALESCE(NULLIF(t.nome, ''), 'Laboratório'),
  COALESCE(t.database_strategy, 'shared'),
  'v0',
  CASE WHEN t.status = 'active' THEN 'active' ELSE 'suspended' END,
  'active',
  t.id::text
FROM public.tenants t
ON CONFLICT (tenant_id) DO NOTHING;

-- ────────────────────────────────────────────────────────────────────────
-- Trigger: ao criar novo tenant, auto-registrar no control-plane.
-- ────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tenant_registry_autoinsert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.tenant_registry (
    tenant_id, slug, laboratorio, database_strategy, schema_version,
    runtime_status, provisioning_status, storage_namespace
  ) VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.slug, ''), NEW.id::text),
    COALESCE(NULLIF(NEW.nome, ''), 'Laboratório'),
    COALESCE(NEW.database_strategy, 'shared'),
    'v0',
    'active',
    'active',
    NEW.id::text
  )
  ON CONFLICT (tenant_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tenant_registry_autoinsert
AFTER INSERT ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.tenant_registry_autoinsert();

COMMENT ON TABLE public.tenant_registry IS
  'Control-plane central (Onda 1). Fonte de verdade global de roteamento de banco, schema_version e estado de provisionamento por tenant. RLS: somente super_admin. Edge functions de plataforma usam service-role.';
