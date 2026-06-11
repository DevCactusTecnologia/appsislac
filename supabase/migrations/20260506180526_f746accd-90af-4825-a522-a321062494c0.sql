
-- 1) Tornar CNPJ obrigatório nos tenants (raiz do path no S3)
UPDATE public.tenants SET cnpj = COALESCE(NULLIF(regexp_replace(cnpj, '\D', '', 'g'), ''), lpad(replace(id::text, '-', ''), 14, '0')) WHERE cnpj IS NULL OR trim(cnpj) = '';
ALTER TABLE public.tenants ALTER COLUMN cnpj SET NOT NULL;

-- Função utilitária: limpa CNPJ (somente dígitos)
CREATE OR REPLACE FUNCTION public.cnpj_digits(_cnpj text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(COALESCE(_cnpj, ''), '\D', '', 'g')
$$;

-- 2) Trilha de auditoria de objetos no storage (S3 ou Supabase)
CREATE TABLE IF NOT EXISTS public.storage_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid,
  paciente_id bigint,
  paciente_ref text,           -- CPF ou ID amigável usado no path
  category text NOT NULL,      -- comprovantes | documentos | laudos | _globais
  backend text NOT NULL,       -- 's3' | 'supabase'
  bucket text NOT NULL,
  object_key text NOT NULL,
  action text NOT NULL,        -- 'upload' | 'sign_read' | 'delete'
  size_bytes bigint,
  content_type text,
  request_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS storage_audit_tenant_idx ON public.storage_audit (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS storage_audit_paciente_idx ON public.storage_audit (tenant_id, paciente_id, created_at DESC);
CREATE INDEX IF NOT EXISTS storage_audit_object_idx ON public.storage_audit (tenant_id, object_key);

ALTER TABLE public.storage_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS storage_audit_select ON public.storage_audit;
DROP POLICY IF EXISTS storage_audit_insert ON public.storage_audit;
DROP POLICY IF EXISTS storage_audit_super ON public.storage_audit;

CREATE POLICY storage_audit_select ON public.storage_audit
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(), 'admin'))
  );

CREATE POLICY storage_audit_insert ON public.storage_audit
  FOR INSERT TO authenticated
  WITH CHECK (false); -- somente service role (edge functions) grava
