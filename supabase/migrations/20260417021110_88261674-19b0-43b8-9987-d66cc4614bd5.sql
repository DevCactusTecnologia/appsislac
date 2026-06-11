
-- Make bucket private
UPDATE storage.buckets SET public = false WHERE id = 'comprovantes';

-- Drop any prior public-read policy (defensive — ignore if absent)
DROP POLICY IF EXISTS "Public read comprovantes" ON storage.objects;
DROP POLICY IF EXISTS "Public can read comprovantes" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read comprovantes" ON storage.objects;

-- Authenticated users can read (signed URLs are still required at API level
-- when bucket is private, but this allows direct authenticated reads via SDK)
DROP POLICY IF EXISTS "Authenticated read comprovantes" ON storage.objects;
CREATE POLICY "Authenticated read comprovantes"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'comprovantes');

-- Only admins can directly write/update/delete (service_role bypasses RLS,
-- so edge functions continue to work)
DROP POLICY IF EXISTS "Admins can upload comprovantes" ON storage.objects;
CREATE POLICY "Admins can upload comprovantes"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'comprovantes'
  AND public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "Admins can update comprovantes" ON storage.objects;
CREATE POLICY "Admins can update comprovantes"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'comprovantes'
  AND public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "Admins can delete comprovantes" ON storage.objects;
CREATE POLICY "Admins can delete comprovantes"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'comprovantes'
  AND public.has_role(auth.uid(), 'admin')
);
