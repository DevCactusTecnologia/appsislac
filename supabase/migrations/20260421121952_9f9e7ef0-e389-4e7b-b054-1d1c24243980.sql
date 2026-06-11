-- ════════════════════════════════════════════════════════════════════
-- Templates de Documentos (Comprovantes, Cabeçalho, Rodapé)
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.documento_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tipo            text NOT NULL CHECK (tipo IN (
                    'comprovante_pagamento',
                    'comprovante_atendimento',
                    'declaracao_comparecimento',
                    'cabecalho',
                    'rodape'
                  )),
  nome            text NOT NULL,
  descricao       text NOT NULL DEFAULT '',
  conteudo        text NOT NULL DEFAULT '',
  placeholders_usados jsonb NOT NULL DEFAULT '[]'::jsonb,
  config          jsonb NOT NULL DEFAULT '{}'::jsonb,
  ativo           boolean NOT NULL DEFAULT true,
  padrao          boolean NOT NULL DEFAULT false,
  criado_por      text NOT NULL DEFAULT '',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documento_templates_tenant_tipo
  ON public.documento_templates (tenant_id, tipo);

CREATE INDEX IF NOT EXISTS idx_documento_templates_padrao
  ON public.documento_templates (tenant_id, tipo) WHERE padrao = true;

ALTER TABLE public.documento_templates ENABLE ROW LEVEL SECURITY;

-- ─── RLS ────────────────────────────────────────────────────────────
CREATE POLICY "doc_templates_select_tenant"
  ON public.documento_templates FOR SELECT
  USING (
    tenant_id = public.current_tenant_id()
    OR public.is_super_admin(auth.uid())
  );

CREATE POLICY "doc_templates_insert_tenant"
  ON public.documento_templates FOR INSERT
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    OR public.is_super_admin(auth.uid())
  );

CREATE POLICY "doc_templates_update_tenant"
  ON public.documento_templates FOR UPDATE
  USING (
    tenant_id = public.current_tenant_id()
    OR public.is_super_admin(auth.uid())
  );

CREATE POLICY "doc_templates_delete_tenant"
  ON public.documento_templates FOR DELETE
  USING (
    tenant_id = public.current_tenant_id()
    OR public.is_super_admin(auth.uid())
  );

-- ─── Trigger: garantir um único "padrão" por (tenant, tipo) ─────────
CREATE OR REPLACE FUNCTION public.documento_templates_unico_padrao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.padrao = true THEN
    UPDATE public.documento_templates
       SET padrao = false
     WHERE tenant_id = NEW.tenant_id
       AND tipo      = NEW.tipo
       AND id <> NEW.id
       AND padrao = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_doc_templates_unico_padrao ON public.documento_templates;
CREATE TRIGGER trg_doc_templates_unico_padrao
  BEFORE INSERT OR UPDATE OF padrao ON public.documento_templates
  FOR EACH ROW EXECUTE FUNCTION public.documento_templates_unico_padrao();

-- ─── Trigger: updated_at ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_documento_templates_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_doc_templates_updated_at ON public.documento_templates;
CREATE TRIGGER trg_doc_templates_updated_at
  BEFORE UPDATE ON public.documento_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_documento_templates_updated_at();

-- ════════════════════════════════════════════════════════════════════
-- Bucket privado para o logo (e outros assets) do tenant
-- ════════════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public)
  VALUES ('tenant-assets', 'tenant-assets', false)
  ON CONFLICT (id) DO NOTHING;

-- Estrutura esperada: <tenant_id>/<arquivo>
-- Ex.: 00000000-0000-0000-0000-000000000001/logo.png

CREATE POLICY "tenant_assets_select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'tenant-assets'
    AND (
      (storage.foldername(name))[1] = public.current_tenant_id()::text
      OR public.is_super_admin(auth.uid())
    )
  );

CREATE POLICY "tenant_assets_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'tenant-assets'
    AND (
      (storage.foldername(name))[1] = public.current_tenant_id()::text
      OR public.is_super_admin(auth.uid())
    )
  );

CREATE POLICY "tenant_assets_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'tenant-assets'
    AND (
      (storage.foldername(name))[1] = public.current_tenant_id()::text
      OR public.is_super_admin(auth.uid())
    )
  );

CREATE POLICY "tenant_assets_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'tenant-assets'
    AND (
      (storage.foldername(name))[1] = public.current_tenant_id()::text
      OR public.is_super_admin(auth.uid())
    )
  );