-- Função utilitária local para atualizar updated_at
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- TENANTS
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS dominio_custom TEXT,
  ADD COLUMN IF NOT EXISTS dominio_verificado BOOLEAN NOT NULL DEFAULT false;

UPDATE public.tenants
SET slug = regexp_replace(
  lower(translate(nome,
    'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
    'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
  )),
  '[^a-z0-9]+', '-', 'g'
)
WHERE slug IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS tenants_slug_uidx ON public.tenants (slug) WHERE slug IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS tenants_dominio_custom_uidx ON public.tenants (dominio_custom) WHERE dominio_custom IS NOT NULL;

-- TENANT_PAGES
CREATE TABLE IF NOT EXISTS public.tenant_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  slug TEXT NOT NULL DEFAULT 'home',
  titulo TEXT NOT NULL DEFAULT '',
  conteudo JSONB NOT NULL DEFAULT '[]'::jsonb,
  publicado BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS tenant_pages_tenant_idx ON public.tenant_pages (tenant_id);
CREATE INDEX IF NOT EXISTS tenant_pages_slug_idx ON public.tenant_pages (slug);

DROP TRIGGER IF EXISTS tenant_pages_updated_at ON public.tenant_pages;
CREATE TRIGGER tenant_pages_updated_at
  BEFORE UPDATE ON public.tenant_pages
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.tenant_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tpages_select_public ON public.tenant_pages;
CREATE POLICY tpages_select_public
  ON public.tenant_pages FOR SELECT TO anon, authenticated
  USING (
    publicado = true
    OR is_super_admin(auth.uid())
    OR (tenant_id = current_tenant_id() AND has_role(auth.uid(), 'admin'::app_role))
  );

DROP POLICY IF EXISTS tpages_insert_admin ON public.tenant_pages;
CREATE POLICY tpages_insert_admin
  ON public.tenant_pages FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_tenant_id() AND has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS tpages_update_admin ON public.tenant_pages;
CREATE POLICY tpages_update_admin
  ON public.tenant_pages FOR UPDATE TO authenticated
  USING (tenant_id = current_tenant_id() AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (tenant_id = current_tenant_id() AND has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS tpages_delete_admin ON public.tenant_pages;
CREATE POLICY tpages_delete_admin
  ON public.tenant_pages FOR DELETE TO authenticated
  USING (tenant_id = current_tenant_id() AND has_role(auth.uid(), 'admin'::app_role));

-- View pública de tenants (apenas dados de roteamento)
CREATE OR REPLACE VIEW public.tenant_public
WITH (security_invoker=on) AS
  SELECT id, nome, slug, dominio_custom, dominio_verificado
  FROM public.tenants
  WHERE slug IS NOT NULL;

GRANT SELECT ON public.tenant_public TO anon, authenticated;

-- STORAGE: bucket de imagens das landings
INSERT INTO storage.buckets (id, name, public)
VALUES ('tenant-site', 'tenant-site', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "tenant-site public read" ON storage.objects;
CREATE POLICY "tenant-site public read"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'tenant-site');

DROP POLICY IF EXISTS "tenant-site admin write" ON storage.objects;
CREATE POLICY "tenant-site admin write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'tenant-site'
    AND has_role(auth.uid(), 'admin'::app_role)
    AND (storage.foldername(name))[1] = current_tenant_id()::text
  );

DROP POLICY IF EXISTS "tenant-site admin update" ON storage.objects;
CREATE POLICY "tenant-site admin update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'tenant-site'
    AND has_role(auth.uid(), 'admin'::app_role)
    AND (storage.foldername(name))[1] = current_tenant_id()::text
  );

DROP POLICY IF EXISTS "tenant-site admin delete" ON storage.objects;
CREATE POLICY "tenant-site admin delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'tenant-site'
    AND has_role(auth.uid(), 'admin'::app_role)
    AND (storage.foldername(name))[1] = current_tenant_id()::text
  );