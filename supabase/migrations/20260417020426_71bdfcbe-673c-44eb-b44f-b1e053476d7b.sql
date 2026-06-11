
-- =========================================================================
-- FASE 2: Hardening de app_settings
-- - Schema validation (CHECK + trigger) for pdf_retention_days
-- - app_role enum + user_roles + has_role() (security definer)
-- - RLS de escrita preparada para admin (auth real) sem quebrar service role
-- - Auditoria automática via trigger
-- =========================================================================

-- 1) Validação de schema do JSON value -----------------------------------
-- Usamos um trigger (não CHECK) porque a regra depende da chave e queremos
-- mensagens de erro claras + extensibilidade futura para outras chaves.
CREATE OR REPLACE FUNCTION public.validate_app_setting()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.key = 'pdf_retention_days' THEN
    -- Aceita number ou string numérica; normaliza para número
    IF jsonb_typeof(NEW.value) NOT IN ('number', 'string') THEN
      RAISE EXCEPTION 'pdf_retention_days must be a number, got %', jsonb_typeof(NEW.value)
        USING ERRCODE = '22023';
    END IF;
    IF NOT ((NEW.value)::text)::numeric IN (7, 30, 60, 90) THEN
      RAISE EXCEPTION 'pdf_retention_days must be one of 7, 30, 60, 90 (got %)', NEW.value
        USING ERRCODE = '22023';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_app_setting_trigger ON public.app_settings;
CREATE TRIGGER validate_app_setting_trigger
BEFORE INSERT OR UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION public.validate_app_setting();

-- 2) app_role enum + user_roles ------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'user');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  role        public.app_role NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3) has_role(): security definer, evita recursão em RLS -----------------
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Políticas para user_roles
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4) RLS de escrita em app_settings restrita a admin ---------------------
-- A leitura pública já existe e foi mantida (necessária para o frontend
-- ler a retenção atual). Escritas via edge function continuam funcionando
-- porque service_role bypassa RLS.
DROP POLICY IF EXISTS "Admins can insert app_settings" ON public.app_settings;
CREATE POLICY "Admins can insert app_settings"
ON public.app_settings
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update app_settings" ON public.app_settings;
CREATE POLICY "Admins can update app_settings"
ON public.app_settings
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete app_settings" ON public.app_settings;
CREATE POLICY "Admins can delete app_settings"
ON public.app_settings
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 5) Auditoria de mudanças -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_settings_audit (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key          TEXT NOT NULL,
  old_value    JSONB,
  new_value    JSONB,
  operation    TEXT NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE')),
  changed_by   UUID,
  changed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_settings_audit_key_changed_at
  ON public.app_settings_audit(key, changed_at DESC);

ALTER TABLE public.app_settings_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read audit" ON public.app_settings_audit;
CREATE POLICY "Admins can read audit"
ON public.app_settings_audit
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Sem políticas de INSERT/UPDATE/DELETE para usuários: somente o trigger
-- (security definer) e service_role conseguem escrever.

CREATE OR REPLACE FUNCTION public.audit_app_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.app_settings_audit(key, old_value, new_value, operation, changed_by)
    VALUES (NEW.key, NULL, NEW.value, 'INSERT', auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Só registra se o valor mudou de fato
    IF OLD.value IS DISTINCT FROM NEW.value THEN
      INSERT INTO public.app_settings_audit(key, old_value, new_value, operation, changed_by)
      VALUES (NEW.key, OLD.value, NEW.value, 'UPDATE', auth.uid());
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.app_settings_audit(key, old_value, new_value, operation, changed_by)
    VALUES (OLD.key, OLD.value, NULL, 'DELETE', auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS audit_app_settings_trigger ON public.app_settings;
CREATE TRIGGER audit_app_settings_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION public.audit_app_settings();
