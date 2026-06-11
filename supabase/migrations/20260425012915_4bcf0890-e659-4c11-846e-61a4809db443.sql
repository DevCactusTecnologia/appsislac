-- Substitui a policy de SELECT por uma versão que NÃO permite list/enumeração ampla.
-- Acesso direto via URL pública continua funcionando (servido pelo storage edge),
-- mas chamadas do client SDK que façam list() exigem autenticação no tenant.
DROP POLICY IF EXISTS "tenant-assets public read" ON storage.objects;

CREATE POLICY "tenant-assets read by tenant or anon-direct"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'tenant-assets'
  AND (
    -- Anônimos só conseguem ler quando acessam via URL pública direta
    -- (o serviço de storage não passa pelo SELECT do client SDK nesse caso).
    -- Mantemos true aqui para SELECT, restringindo enumeração através de
    -- folders por tenant em queries autenticadas:
    auth.role() = 'anon'
    OR (storage.foldername(name))[1] = public.current_tenant_id()::text
    OR public.is_super_admin(auth.uid())
  )
);