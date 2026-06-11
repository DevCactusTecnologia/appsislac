-- 1) Comprovantes bucket INSERT policy (tenant + admin scoped)
DROP POLICY IF EXISTS "comprovantes_insert_tenant_admin" ON storage.objects;
CREATE POLICY "comprovantes_insert_tenant_admin"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'comprovantes'
  AND (storage.foldername(name))[1] = (current_tenant_id())::text
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- 2) Remove provider_catalog_import_jobs from realtime publication (no client subscribers)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'provider_catalog_import_jobs'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.provider_catalog_import_jobs';
  END IF;
END$$;