-- Hardening multi-tenant: remover super_admins do SELECT de profiles para admins de tenant.
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;

CREATE POLICY "profiles_select"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  is_super_admin(auth.uid())
  OR auth.uid() = user_id
  OR (
    tenant_id = current_tenant_id()
    AND has_role(auth.uid(), 'admin'::app_role)
    AND NOT is_super_admin(user_id)
  )
);