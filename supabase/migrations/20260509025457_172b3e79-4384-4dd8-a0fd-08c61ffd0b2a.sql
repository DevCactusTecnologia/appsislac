
INSERT INTO storage.buckets (id, name, public)
VALUES ('provider-catalog-imports', 'provider-catalog-imports', false)
ON CONFLICT (id) DO NOTHING;

-- SELECT: tenant vê só seus arquivos
CREATE POLICY "pci_select" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'provider-catalog-imports'
  AND (
    public.is_super_admin(auth.uid())
    OR (storage.foldername(name))[1] = public.current_tenant_id()::text
  )
);

-- INSERT/UPDATE/DELETE: precisa permissão de integrações
CREATE POLICY "pci_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'provider-catalog-imports'
  AND public.has_permission(auth.uid(), 'integracoes.gerenciar')
  AND (
    public.is_super_admin(auth.uid())
    OR (storage.foldername(name))[1] = public.current_tenant_id()::text
  )
);

CREATE POLICY "pci_update" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'provider-catalog-imports'
  AND public.has_permission(auth.uid(), 'integracoes.gerenciar')
  AND (
    public.is_super_admin(auth.uid())
    OR (storage.foldername(name))[1] = public.current_tenant_id()::text
  )
);

CREATE POLICY "pci_delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'provider-catalog-imports'
  AND public.has_permission(auth.uid(), 'integracoes.gerenciar')
  AND (
    public.is_super_admin(auth.uid())
    OR (storage.foldername(name))[1] = public.current_tenant_id()::text
  )
);
