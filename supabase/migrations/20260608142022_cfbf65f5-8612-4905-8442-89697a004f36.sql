
-- =========================================================================
-- STORAGE SECURITY HARDENING (P0)
-- Remove acesso anônimo enumerável aos buckets tenant-assets e tenant-site.
-- URLs públicas via CDN continuam funcionando (buckets têm public=true).
-- =========================================================================

-- 1. tenant-assets: remove a policy que permitia anon SELECT sem path
DROP POLICY IF EXISTS "tenant-assets read by tenant or anon-direct" ON storage.objects;

-- Novo SELECT: somente authenticated, escopado por tenant (ou super_admin).
-- Leitura pública continua via /storage/v1/object/public/tenant-assets/...
CREATE POLICY "tenant-assets authenticated tenant read"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'tenant-assets'
    AND (
      is_super_admin(auth.uid())
      OR (storage.foldername(name))[1] = (current_tenant_id())::text
    )
  );

-- 2. tenant-site: substitui a policy que permitia anon ler qualquer name
DROP POLICY IF EXISTS "tenant-site public get only" ON storage.objects;

CREATE POLICY "tenant-site authenticated tenant read"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'tenant-site'
    AND (
      is_super_admin(auth.uid())
      OR (storage.foldername(name))[1] = (current_tenant_id())::text
    )
  );
