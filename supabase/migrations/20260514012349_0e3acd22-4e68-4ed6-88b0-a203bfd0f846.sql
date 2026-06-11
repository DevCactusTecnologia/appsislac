-- Add no-arg overload of is_super_admin() that defaults to auth.uid().
-- Required by trigger atendimento_exames_rbac_check which calls public.is_super_admin().
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_super_admin(auth.uid());
$$;