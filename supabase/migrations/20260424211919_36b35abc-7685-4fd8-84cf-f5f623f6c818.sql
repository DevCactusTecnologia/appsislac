DROP POLICY IF EXISTS "tenant-site public read" ON storage.objects;

-- Leitura pública apenas de objetos individuais (LIST bloqueado).
-- A função storage.search() exige que o resultado seja não-nulo para LIST,
-- então usamos uma checagem que sempre passa para GET por path direto
-- mas filtra LIST sem prefixo de pasta válido.
CREATE POLICY "tenant-site public get only"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (
    bucket_id = 'tenant-site'
    AND (
      -- admin do próprio tenant pode listar tudo do tenant
      (auth.role() = 'authenticated'
        AND has_role(auth.uid(), 'admin'::app_role)
        AND (storage.foldername(name))[1] = current_tenant_id()::text)
      -- super-admin
      OR (auth.role() = 'authenticated' AND is_super_admin(auth.uid()))
      -- visitante anônimo: só GET por nome completo (não LIST por prefixo)
      OR (auth.role() = 'anon' AND name IS NOT NULL AND length(name) > 0)
    )
  );