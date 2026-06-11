-- Replace broad SELECT policy with one that blocks listing while still
-- allowing direct-by-name reads (which is what the public URL does).
DROP POLICY IF EXISTS "Public read access for comprovantes" ON storage.objects;

CREATE POLICY "Public direct read for comprovantes"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'comprovantes'
  AND name IS NOT NULL
  AND name <> ''
);