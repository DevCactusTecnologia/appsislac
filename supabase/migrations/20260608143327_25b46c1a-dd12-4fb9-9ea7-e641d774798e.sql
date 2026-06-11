
-- ════════════════════════════════════════════════════════════════════
-- P0: CROSS-TENANT DATA LEAK HARDENING
-- Catalog / Pages / Tenants public policies — enforce tenant scope.
-- ════════════════════════════════════════════════════════════════════

-- 1) tabela_preco_itens: drop the redundant anon broad-read policy.
--    The `tpi_public_read` policy already enforces tenant_id = current_tenant_id().
DROP POLICY IF EXISTS tabela_preco_itens_public_read ON public.tabela_preco_itens;

-- 2) tenants: drop overly broad anon read. Public lookups go through the
--    `tenant_public` view, which exposes only whitelisted columns.
DROP POLICY IF EXISTS tenants_public_read_by_slug ON public.tenants;

-- 3) tenant_pages: the `publicado = true` branch had NO tenant scope, so any
--    anon caller could enumerate published pages of every tenant. Replace
--    with admin-only direct read; public access is served by a SECURITY
--    DEFINER RPC that requires an explicit tenant_id + slug.
DROP POLICY IF EXISTS tpages_select_public ON public.tenant_pages;

CREATE POLICY tpages_select_admin
  ON public.tenant_pages
  FOR SELECT
  TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR (tenant_id = current_tenant_id() AND has_role(auth.uid(), 'admin'::app_role))
  );

CREATE OR REPLACE FUNCTION public.get_published_tenant_page(
  p_tenant_id uuid,
  p_slug text
)
RETURNS TABLE(
  id uuid,
  tenant_id uuid,
  slug text,
  titulo text,
  conteudo jsonb,
  publicado boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tp.id, tp.tenant_id, tp.slug, tp.titulo, tp.conteudo, tp.publicado
  FROM public.tenant_pages tp
  JOIN public.tenant_public tpub ON tpub.id = tp.tenant_id
  WHERE tp.tenant_id = p_tenant_id
    AND tp.slug      = p_slug
    AND tp.publicado = true
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_published_tenant_page(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_published_tenant_page(uuid, text) TO anon, authenticated;

-- 4) exames_catalogo: drop the legacy public-read policy. The catalog is
--    purely operational; the public-facing vitrine uses `exames_publicos_view`.
--    Authenticated users keep tenant-scoped access via `excat_select`.
DROP POLICY IF EXISTS exames_catalogo_public_read ON public.exames_catalogo;
