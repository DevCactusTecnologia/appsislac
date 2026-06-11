
-- 1) Harden current_tenant_id(): no anon fallback, no demo fallback
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  uid uuid := auth.uid();
  tid uuid;
BEGIN
  IF uid IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT tenant_id INTO tid FROM public.profiles WHERE user_id = uid LIMIT 1;
  RETURN tid; -- NULL when profile not found (no demo fallback)
END;
$function$;

-- 2) Restrict policies that targeted anon via current_tenant_id() to authenticated only.
DROP POLICY IF EXISTS tpi_public_read ON public.tabela_preco_itens;
CREATE POLICY tpi_public_read ON public.tabela_preco_itens
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS tsp_public_read ON public.tenant_settings_public;
CREATE POLICY tsp_public_read ON public.tenant_settings_public
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS unidades_public_read ON public.unidades;
CREATE POLICY unidades_public_read ON public.unidades
  FOR SELECT TO authenticated
  USING (ativo = true AND tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS ep_public_read_active ON public.exames_publicos;
CREATE POLICY ep_public_read_active ON public.exames_publicos
  FOR SELECT TO authenticated
  USING (ativo = true AND tenant_id = public.current_tenant_id());

-- 3) Tenant billing — anon must never read
DROP POLICY IF EXISTS "Tenant vê próprio billing" ON public.tenant_subscriptions_billing;
CREATE POLICY "Tenant vê próprio billing" ON public.tenant_subscriptions_billing
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()));
