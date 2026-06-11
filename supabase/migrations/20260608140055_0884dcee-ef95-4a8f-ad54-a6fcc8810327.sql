
-- 1. Alter units table to allow public read of active units
CREATE POLICY "unidades_public_read" ON public.unidades
FOR SELECT TO anon
USING (ativo = true);

-- 2. Alter tenants table to allow public read of basic tenant info by slug
CREATE POLICY "tenants_public_read_by_slug" ON public.tenants
FOR SELECT TO anon
USING (slug IS NOT NULL);

-- 3. exames_publicos already has ep_public_read_active: USING (ativo = true)
-- We need to ensure exames_catalogo and tabela_preco_itens also allow public read for this view to work with security_invoker = true
CREATE POLICY "exames_catalogo_public_read" ON public.exames_catalogo
FOR SELECT TO anon
USING (ativo = true);

CREATE POLICY "tabela_preco_itens_public_read" ON public.tabela_preco_itens
FOR SELECT TO anon
USING (ativo = true AND tabela = 'Própria');

-- 4. Convert views to security_invoker = true
-- Note: Views must be dropped and recreated to change WITH options in some PG versions, 
-- or we can try ALTER VIEW ... SET (security_invoker = true) if supported.
-- In Supabase/Postgres 15+, ALTER VIEW is preferred.

ALTER VIEW public.unidades_publicas SET (security_invoker = true);
ALTER VIEW public.tenant_public SET (security_invoker = true);
ALTER VIEW public.exames_publicos_view SET (security_invoker = true);
ALTER VIEW public.platform_health_aggregate SET (security_invoker = true);
ALTER VIEW public.financeiro_entradas SET (security_invoker = true);
ALTER VIEW public.provider_health_current SET (security_invoker = true);
