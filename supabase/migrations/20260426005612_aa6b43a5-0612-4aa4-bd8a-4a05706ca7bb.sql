-- ============================================================
-- BLOCO 1 — STORAGE: remover policies frouxas no bucket `comprovantes`
-- e substituir por policies tenant-scoped (path `<tenant_id>/...`).
-- ============================================================

-- Remove policies antigas inseguras / redundantes
DROP POLICY IF EXISTS "Anyone can upload comprovantes" ON storage.objects;
DROP POLICY IF EXISTS "Public direct read for comprovantes" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated read comprovantes" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload comprovantes" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update comprovantes" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete comprovantes" ON storage.objects;

-- SELECT: qualquer usuário autenticado do tenant dono pode ler
CREATE POLICY "comprovantes_select_tenant"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'comprovantes'
  AND (storage.foldername(name))[1] = (public.current_tenant_id())::text
);

-- INSERT: apenas via service role (edge function `upload-pdf`).
-- Não criamos policy para `authenticated` em INSERT — uploads diretos do
-- client são bloqueados intencionalmente. Se algum dia precisar ser liberado,
-- uma policy explícita deverá ser adicionada com WITH CHECK escopado por tenant.

-- UPDATE: admin do tenant
CREATE POLICY "comprovantes_update_tenant_admin"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'comprovantes'
  AND (storage.foldername(name))[1] = (public.current_tenant_id())::text
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- DELETE: admin do tenant
CREATE POLICY "comprovantes_delete_tenant_admin"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'comprovantes'
  AND (storage.foldername(name))[1] = (public.current_tenant_id())::text
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- ============================================================
-- BLOCO 2 — solicitacoes_publicas: defesa em profundidade na policy de INSERT.
-- O trigger `solicitacao_publica_validate` já valida tenant + payload + rate-limit,
-- mas a policy de INSERT estava com WITH CHECK (true). Reforçamos:
--   - tenant_id deve apontar para um tenant existente
--   - tenant_id deve ter `permitir_reserva = true` em tenant_settings_public
--   - campos obrigatórios mínimos preenchidos
-- SELECT continua negado para anônimo (já estava — sem policy SELECT para `anon`).
-- ============================================================

DROP POLICY IF EXISTS solicpub_public_insert ON public.solicitacoes_publicas;

CREATE POLICY solicpub_public_insert_secure
ON public.solicitacoes_publicas
FOR INSERT
TO anon, authenticated
WITH CHECK (
  nome IS NOT NULL
  AND length(trim(nome)) >= 2
  AND telefone IS NOT NULL
  AND length(regexp_replace(telefone, '\D', '', 'g')) >= 10
  AND jsonb_typeof(exames) = 'array'
  AND jsonb_array_length(exames) BETWEEN 1 AND 30
  AND EXISTS (
    SELECT 1
    FROM public.tenant_settings_public tsp
    WHERE tsp.tenant_id = solicitacoes_publicas.tenant_id
      AND tsp.permitir_reserva = true
  )
);

-- Garante explicitamente que anon NÃO pode SELECT
-- (não existia policy SELECT para anon, mas reforçamos negativamente).
DROP POLICY IF EXISTS solicpub_deny_anon_select ON public.solicitacoes_publicas;
CREATE POLICY solicpub_deny_anon_select
ON public.solicitacoes_publicas
FOR SELECT
TO anon
USING (false);
