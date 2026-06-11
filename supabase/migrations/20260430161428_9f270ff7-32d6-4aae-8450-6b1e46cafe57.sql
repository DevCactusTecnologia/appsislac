CREATE OR REPLACE FUNCTION public.super_admin_tenants_metrics()
RETURNS TABLE (
  tenant_id uuid,
  usuarios bigint,
  atendimentos bigint,
  pacientes bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id AS tenant_id,
    COALESCE((SELECT COUNT(*) FROM public.profiles p WHERE p.tenant_id = t.id), 0) AS usuarios,
    COALESCE((SELECT COUNT(*) FROM public.atendimentos a WHERE a.tenant_id = t.id), 0) AS atendimentos,
    COALESCE((SELECT COUNT(*) FROM public.pacientes pa WHERE pa.tenant_id = t.id), 0) AS pacientes
  FROM public.tenants t
  WHERE public.is_super_admin(auth.uid());
$$;

REVOKE ALL ON FUNCTION public.super_admin_tenants_metrics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.super_admin_tenants_metrics() TO authenticated;