ALTER TABLE public.tenant_settings_public
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS favicon_url TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('tenant-assets', 'tenant-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "tenant-assets public read" ON storage.objects;
CREATE POLICY "tenant-assets public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'tenant-assets');

DROP POLICY IF EXISTS "tenant-assets tenant admin insert" ON storage.objects;
CREATE POLICY "tenant-assets tenant admin insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'tenant-assets'
  AND (storage.foldername(name))[1] = public.current_tenant_id()::text
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.is_super_admin(auth.uid())
  )
);

DROP POLICY IF EXISTS "tenant-assets tenant admin update" ON storage.objects;
CREATE POLICY "tenant-assets tenant admin update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'tenant-assets'
  AND (storage.foldername(name))[1] = public.current_tenant_id()::text
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.is_super_admin(auth.uid())
  )
);

DROP POLICY IF EXISTS "tenant-assets tenant admin delete" ON storage.objects;
CREATE POLICY "tenant-assets tenant admin delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'tenant-assets'
  AND (storage.foldername(name))[1] = public.current_tenant_id()::text
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.is_super_admin(auth.uid())
  )
);