
-- ============================================================================
-- Friendly IDs (immutable, per-tenant) for pacientes, especialistas, profiles
-- ============================================================================

-- Counter table: next sequence per (tenant, scope)
CREATE TABLE IF NOT EXISTS public.friendly_id_counters (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  scope text NOT NULL,
  next_value bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id, scope)
);

ALTER TABLE public.friendly_id_counters ENABLE ROW LEVEL SECURITY;
-- Internal table; only triggers (security definer) write to it.
DROP POLICY IF EXISTS "fic_no_access" ON public.friendly_id_counters;
CREATE POLICY "fic_no_access" ON public.friendly_id_counters FOR SELECT TO authenticated USING (false);

-- Function: atomically reserve next friendly id for (tenant, scope, prefix)
CREATE OR REPLACE FUNCTION public.next_friendly_id(_tenant_id uuid, _scope text, _prefix text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next bigint;
BEGIN
  INSERT INTO public.friendly_id_counters (tenant_id, scope, next_value)
  VALUES (_tenant_id, _scope, 2)
  ON CONFLICT (tenant_id, scope) DO UPDATE
    SET next_value = public.friendly_id_counters.next_value + 1
  RETURNING next_value - 1 INTO v_next;

  RETURN _prefix || '-' || lpad(v_next::text, 6, '0');
END;
$$;

-- ============================================================================
-- pacientes
-- ============================================================================
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS friendly_id text;

-- Backfill, ordered by created_at per tenant
WITH ranked AS (
  SELECT id, tenant_id,
         row_number() OVER (PARTITION BY tenant_id ORDER BY created_at, id) AS rn
  FROM public.pacientes
  WHERE friendly_id IS NULL
)
UPDATE public.pacientes p
SET friendly_id = 'PAC-' || lpad(r.rn::text, 6, '0')
FROM ranked r
WHERE p.id = r.id;

-- Seed counters from current max
INSERT INTO public.friendly_id_counters (tenant_id, scope, next_value)
SELECT tenant_id, 'paciente', COUNT(*) + 1
FROM public.pacientes
GROUP BY tenant_id
ON CONFLICT (tenant_id, scope) DO UPDATE SET next_value = EXCLUDED.next_value;

ALTER TABLE public.pacientes ALTER COLUMN friendly_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS pacientes_tenant_friendly_id_uidx
  ON public.pacientes (tenant_id, friendly_id);

CREATE OR REPLACE FUNCTION public.set_paciente_friendly_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.friendly_id IS NULL OR NEW.friendly_id = '' THEN
    NEW.friendly_id := public.next_friendly_id(NEW.tenant_id, 'paciente', 'PAC');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_paciente_friendly_id ON public.pacientes;
CREATE TRIGGER trg_paciente_friendly_id
  BEFORE INSERT ON public.pacientes
  FOR EACH ROW EXECUTE FUNCTION public.set_paciente_friendly_id();

-- Block updates to friendly_id (immutable)
CREATE OR REPLACE FUNCTION public.block_friendly_id_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.friendly_id IS DISTINCT FROM OLD.friendly_id THEN
    RAISE EXCEPTION 'friendly_id is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_paciente_friendly_id_immutable ON public.pacientes;
CREATE TRIGGER trg_paciente_friendly_id_immutable
  BEFORE UPDATE OF friendly_id ON public.pacientes
  FOR EACH ROW EXECUTE FUNCTION public.block_friendly_id_update();

-- ============================================================================
-- especialistas
-- ============================================================================
ALTER TABLE public.especialistas ADD COLUMN IF NOT EXISTS friendly_id text;

WITH ranked AS (
  SELECT id, tenant_id,
         row_number() OVER (PARTITION BY tenant_id ORDER BY created_at, id) AS rn
  FROM public.especialistas
  WHERE friendly_id IS NULL
)
UPDATE public.especialistas e
SET friendly_id = 'ESP-' || lpad(r.rn::text, 6, '0')
FROM ranked r
WHERE e.id = r.id;

INSERT INTO public.friendly_id_counters (tenant_id, scope, next_value)
SELECT tenant_id, 'especialista', COUNT(*) + 1
FROM public.especialistas
GROUP BY tenant_id
ON CONFLICT (tenant_id, scope) DO UPDATE SET next_value = EXCLUDED.next_value;

ALTER TABLE public.especialistas ALTER COLUMN friendly_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS especialistas_tenant_friendly_id_uidx
  ON public.especialistas (tenant_id, friendly_id);

CREATE OR REPLACE FUNCTION public.set_especialista_friendly_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.friendly_id IS NULL OR NEW.friendly_id = '' THEN
    NEW.friendly_id := public.next_friendly_id(NEW.tenant_id, 'especialista', 'ESP');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_especialista_friendly_id ON public.especialistas;
CREATE TRIGGER trg_especialista_friendly_id
  BEFORE INSERT ON public.especialistas
  FOR EACH ROW EXECUTE FUNCTION public.set_especialista_friendly_id();

DROP TRIGGER IF EXISTS trg_especialista_friendly_id_immutable ON public.especialistas;
CREATE TRIGGER trg_especialista_friendly_id_immutable
  BEFORE UPDATE OF friendly_id ON public.especialistas
  FOR EACH ROW EXECUTE FUNCTION public.block_friendly_id_update();

-- ============================================================================
-- profiles (usuários do tenant: admin / analista / recepcionista / financeiro)
-- ============================================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS friendly_id text;

WITH ranked AS (
  SELECT id, tenant_id,
         row_number() OVER (PARTITION BY tenant_id ORDER BY created_at, id) AS rn
  FROM public.profiles
  WHERE friendly_id IS NULL
)
UPDATE public.profiles p
SET friendly_id = 'USR-' || lpad(r.rn::text, 6, '0')
FROM ranked r
WHERE p.id = r.id;

INSERT INTO public.friendly_id_counters (tenant_id, scope, next_value)
SELECT tenant_id, 'profile', COUNT(*) + 1
FROM public.profiles
GROUP BY tenant_id
ON CONFLICT (tenant_id, scope) DO UPDATE SET next_value = EXCLUDED.next_value;

ALTER TABLE public.profiles ALTER COLUMN friendly_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_tenant_friendly_id_uidx
  ON public.profiles (tenant_id, friendly_id);

CREATE OR REPLACE FUNCTION public.set_profile_friendly_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.friendly_id IS NULL OR NEW.friendly_id = '' THEN
    NEW.friendly_id := public.next_friendly_id(NEW.tenant_id, 'profile', 'USR');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profile_friendly_id ON public.profiles;
CREATE TRIGGER trg_profile_friendly_id
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_profile_friendly_id();

DROP TRIGGER IF EXISTS trg_profile_friendly_id_immutable ON public.profiles;
CREATE TRIGGER trg_profile_friendly_id_immutable
  BEFORE UPDATE OF friendly_id ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.block_friendly_id_update();
