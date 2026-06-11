-- 1. Trigger: ao inserir profile de usuário operacional (não super_admin),
--    garantir row em user_roles com role 'user' como baseline.
CREATE OR REPLACE FUNCTION public.ensure_default_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Super admins não pertencem a tenants — não recebem role default
  IF public.is_super_admin(NEW.user_id) THEN
    RETURN NEW;
  END IF;

  -- Se já tem qualquer role, não faz nada
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.user_id) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.user_id, 'user'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_ensure_default_role ON public.profiles;
CREATE TRIGGER trg_profiles_ensure_default_role
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.ensure_default_user_role();

-- 2. Backfill: usuários operacionais existentes sem nenhuma role
INSERT INTO public.user_roles (user_id, role)
SELECT p.user_id, 'user'::app_role
  FROM public.profiles p
 WHERE NOT public.is_super_admin(p.user_id)
   AND NOT EXISTS (
     SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.user_id
   )
ON CONFLICT (user_id, role) DO NOTHING;

-- 3. Função de integridade: lista perfis com inconsistências dentro do tenant
--    do caller. Apenas admins do tenant ou super_admin podem invocar.
CREATE OR REPLACE FUNCTION public.tenant_users_integrity()
RETURNS TABLE (
  user_id     uuid,
  email       text,
  nome        text,
  tenant_id   uuid,
  has_role    boolean,
  has_tenant  boolean,
  issue       text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_super_admin(auth.uid())
          OR public.has_role(auth.uid(), 'admin'::app_role)) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.user_id,
    p.email,
    p.nome,
    p.tenant_id,
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.user_id) AS has_role,
    (p.tenant_id IS NOT NULL) AS has_tenant,
    CASE
      WHEN p.tenant_id IS NULL
        THEN 'Sem tenant vinculado'
      WHEN NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.user_id)
        THEN 'Sem role em user_roles'
      ELSE NULL
    END AS issue
  FROM public.profiles p
  WHERE NOT public.is_super_admin(p.user_id)
    AND (
      public.is_super_admin(auth.uid())
      OR p.tenant_id = public.current_tenant_id()
    )
    AND (
      p.tenant_id IS NULL
      OR NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.user_id)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.tenant_users_integrity() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tenant_users_integrity() TO authenticated;