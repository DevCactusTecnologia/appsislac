-- 1. inscricoes
DROP POLICY IF EXISTS "Public insert"                  ON public.inscricoes;
DROP POLICY IF EXISTS "Public select their own by ID"  ON public.inscricoes;
DROP POLICY IF EXISTS "Public update their own by ID"  ON public.inscricoes;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.inscricoes FROM anon;

-- 2. tenant_payment_gateways
DROP POLICY IF EXISTS "Users can manage their tenant payment gateways" ON public.tenant_payment_gateways;

CREATE POLICY "payment_gateways_select" ON public.tenant_payment_gateways
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (tenant_id = public.current_tenant_id()
        AND (public.has_role(auth.uid(),'admin'::public.app_role)
             OR public.has_role(auth.uid(),'manager'::public.app_role)))
  );

CREATE POLICY "payment_gateways_insert" ON public.tenant_payment_gateways
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(),'admin'::public.app_role))
  );

CREATE POLICY "payment_gateways_update" ON public.tenant_payment_gateways
  FOR UPDATE TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(),'admin'::public.app_role))
  )
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(),'admin'::public.app_role))
  );

CREATE POLICY "payment_gateways_delete" ON public.tenant_payment_gateways
  FOR DELETE TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(),'admin'::public.app_role))
  );

-- 3. user_roles — bloquear escalada para super_admin
DROP POLICY IF EXISTS "user_roles_manage" ON public.user_roles;
CREATE POLICY "user_roles_manage" ON public.user_roles
  FOR ALL TO authenticated
  USING (
    public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'admin'::public.app_role)
  )
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR (public.has_role(auth.uid(),'admin'::public.app_role)
        AND role <> 'super_admin'::public.app_role)
  );

-- 4. tenant_subscriptions.admin_senha_hash
ALTER TABLE public.tenant_subscriptions DROP COLUMN IF EXISTS admin_senha_hash;

-- 5. search_path em funções legadas
ALTER FUNCTION public.update_updated_at_column()        SET search_path = public, extensions;
ALTER FUNCTION public.handle_tenant_identifiers()       SET search_path = public, extensions;
ALTER FUNCTION public.handle_default_payment_gateway()  SET search_path = public, extensions;

-- 6. EXECUTE: revoga público/anon, mantém authenticated/service_role,
--    re-concede anon só para RPCs intencionalmente públicas.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
GRANT  EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO   authenticated;
GRANT  EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO   service_role;

GRANT EXECUTE ON FUNCTION public.get_published_tenant_page(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.lookup_paciente_publico(uuid, text)    TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT  EXECUTE ON FUNCTIONS TO   authenticated;