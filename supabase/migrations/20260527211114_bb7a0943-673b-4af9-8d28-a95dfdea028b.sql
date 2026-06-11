-- ─────────────────────────────────────────────────────────────────────
-- HUMAN TENANT CODE (lab_code) — código operacional humano por tenant
-- ─────────────────────────────────────────────────────────────────────

-- 1. Sequence para gerar LAB### determinístico
CREATE SEQUENCE IF NOT EXISTS public.tenant_lab_code_seq START 1;

-- 2. Função geradora (LAB + 3 dígitos, expande se passar de 999)
CREATE OR REPLACE FUNCTION public.generate_next_lab_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  candidate text;
  taken boolean;
BEGIN
  LOOP
    candidate := 'LAB' || lpad(nextval('public.tenant_lab_code_seq')::text, 3, '0');
    SELECT EXISTS(SELECT 1 FROM public.tenant_registry WHERE lab_code = candidate) INTO taken;
    IF NOT taken THEN
      RETURN candidate;
    END IF;
  END LOOP;
END;
$$;

-- 3. Coluna lab_code (inicialmente nullable para backfill)
ALTER TABLE public.tenant_registry
  ADD COLUMN IF NOT EXISTS lab_code text;

-- 4. Backfill determinístico — ordena por created_at e atribui LAB001..LABnnn
DO $$
DECLARE
  r record;
  i int := 0;
BEGIN
  FOR r IN
    SELECT tenant_id FROM public.tenant_registry
    WHERE lab_code IS NULL
    ORDER BY created_at NULLS LAST, tenant_id
  LOOP
    i := i + 1;
    UPDATE public.tenant_registry
      SET lab_code = 'LAB' || lpad(i::text, 3, '0')
      WHERE tenant_id = r.tenant_id;
  END LOOP;
  -- avança a sequence para depois do último usado
  IF i > 0 THEN
    PERFORM setval('public.tenant_lab_code_seq', i, true);
  END IF;
END $$;

-- 5. Constraints — formato + unicidade + obrigatório
ALTER TABLE public.tenant_registry
  ALTER COLUMN lab_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS tenant_registry_lab_code_key
  ON public.tenant_registry (lab_code);

ALTER TABLE public.tenant_registry
  DROP CONSTRAINT IF EXISTS tenant_registry_lab_code_format_chk;

ALTER TABLE public.tenant_registry
  ADD CONSTRAINT tenant_registry_lab_code_format_chk
  CHECK (lab_code ~ '^[A-Z0-9]{3,12}$');

-- 6. Trigger: auto-gera quando vazio + normaliza upper + bloqueia mudanças
CREATE OR REPLACE FUNCTION public.tenant_registry_lab_code_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.lab_code IS NULL OR btrim(NEW.lab_code) = '' THEN
      NEW.lab_code := public.generate_next_lab_code();
    ELSE
      NEW.lab_code := upper(regexp_replace(NEW.lab_code, '[^A-Za-z0-9]', '', 'g'));
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- imutável após criação
    IF NEW.lab_code IS DISTINCT FROM OLD.lab_code THEN
      RAISE EXCEPTION 'lab_code é imutável após a criação do laboratório';
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tenant_registry_lab_code_guard ON public.tenant_registry;
CREATE TRIGGER trg_tenant_registry_lab_code_guard
  BEFORE INSERT OR UPDATE ON public.tenant_registry
  FOR EACH ROW EXECUTE FUNCTION public.tenant_registry_lab_code_guard();