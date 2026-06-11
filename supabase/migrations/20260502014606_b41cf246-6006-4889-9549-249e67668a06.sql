-- Restringe policies de documento_templates ao role 'authenticated'
-- (estavam em 'public', causando 42501 quando anon tentava avaliar current_tenant_id)
DROP POLICY IF EXISTS doc_templates_select_tenant ON public.documento_templates;
DROP POLICY IF EXISTS doc_templates_insert_tenant ON public.documento_templates;
DROP POLICY IF EXISTS doc_templates_update_tenant ON public.documento_templates;
DROP POLICY IF EXISTS doc_templates_delete_tenant ON public.documento_templates;

CREATE POLICY doc_templates_select_tenant
  ON public.documento_templates
  FOR SELECT
  TO authenticated
  USING ((tenant_id = public.current_tenant_id()) OR public.is_super_admin(auth.uid()));

CREATE POLICY doc_templates_insert_tenant
  ON public.documento_templates
  FOR INSERT
  TO authenticated
  WITH CHECK ((tenant_id = public.current_tenant_id()) OR public.is_super_admin(auth.uid()));

CREATE POLICY doc_templates_update_tenant
  ON public.documento_templates
  FOR UPDATE
  TO authenticated
  USING ((tenant_id = public.current_tenant_id()) OR public.is_super_admin(auth.uid()))
  WITH CHECK ((tenant_id = public.current_tenant_id()) OR public.is_super_admin(auth.uid()));

CREATE POLICY doc_templates_delete_tenant
  ON public.documento_templates
  FOR DELETE
  TO authenticated
  USING ((tenant_id = public.current_tenant_id()) OR public.is_super_admin(auth.uid()));