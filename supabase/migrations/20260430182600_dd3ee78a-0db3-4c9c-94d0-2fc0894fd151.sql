-- Helper to keep updated_at fresh (storage.update_updated_at_column exists,
-- but no equivalent in public — create one scoped here).
CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- =========================================================
-- 1. comprovante_links — shortlinks for receipt PDFs
-- =========================================================
CREATE TABLE public.comprovante_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  codigo TEXT NOT NULL,
  url_assinada TEXT NOT NULL,
  atendimento_protocolo TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('pagamento', 'atendimento', 'comparecimento')),
  expira_em TIMESTAMPTZ NOT NULL,
  acessos INT NOT NULL DEFAULT 0,
  ultimo_acesso_em TIMESTAMPTZ,
  criado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_comprovante_links_codigo ON public.comprovante_links(codigo);
CREATE INDEX idx_comprovante_links_tenant ON public.comprovante_links(tenant_id);
CREATE INDEX idx_comprovante_links_protocolo ON public.comprovante_links(atendimento_protocolo);

ALTER TABLE public.comprovante_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant pode ver links do proprio lab"
  ON public.comprovante_links FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()));

CREATE POLICY "Tenant pode criar links do proprio lab"
  ON public.comprovante_links FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()));

CREATE POLICY "Tenant pode atualizar links do proprio lab"
  ON public.comprovante_links FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()));

CREATE POLICY "Tenant pode deletar links do proprio lab"
  ON public.comprovante_links FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()));

CREATE POLICY "Leitura publica por codigo"
  ON public.comprovante_links FOR SELECT TO anon
  USING (true);

CREATE TRIGGER trg_comprovante_links_updated_at
  BEFORE UPDATE ON public.comprovante_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- =========================================================
-- 2. tenant_whatsapp_config
-- =========================================================
CREATE TABLE public.tenant_whatsapp_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL UNIQUE,
  phone_number_id TEXT,
  waba_id TEXT,
  access_token TEXT,
  display_phone TEXT,
  webhook_verify_token TEXT,
  ativo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tenant_whatsapp_config_tenant ON public.tenant_whatsapp_config(tenant_id);

ALTER TABLE public.tenant_whatsapp_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin do tenant pode ver config whatsapp"
  ON public.tenant_whatsapp_config FOR SELECT TO authenticated
  USING (
    (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(), 'admin'))
    OR public.is_super_admin(auth.uid())
  );

CREATE POLICY "Admin do tenant pode criar config whatsapp"
  ON public.tenant_whatsapp_config FOR INSERT TO authenticated
  WITH CHECK (
    (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(), 'admin'))
    OR public.is_super_admin(auth.uid())
  );

CREATE POLICY "Admin do tenant pode atualizar config whatsapp"
  ON public.tenant_whatsapp_config FOR UPDATE TO authenticated
  USING (
    (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(), 'admin'))
    OR public.is_super_admin(auth.uid())
  );

CREATE POLICY "Admin do tenant pode deletar config whatsapp"
  ON public.tenant_whatsapp_config FOR DELETE TO authenticated
  USING (
    (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(), 'admin'))
    OR public.is_super_admin(auth.uid())
  );

CREATE TRIGGER trg_tenant_whatsapp_config_updated_at
  BEFORE UPDATE ON public.tenant_whatsapp_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- =========================================================
-- 3. whatsapp_mensagens
-- =========================================================
CREATE TABLE public.whatsapp_mensagens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  atendimento_protocolo TEXT,
  telefone_destino TEXT NOT NULL,
  tipo_documento TEXT,
  message_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
  erro TEXT,
  payload JSONB,
  enviado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_whatsapp_mensagens_tenant ON public.whatsapp_mensagens(tenant_id);
CREATE INDEX idx_whatsapp_mensagens_message_id ON public.whatsapp_mensagens(message_id);
CREATE INDEX idx_whatsapp_mensagens_protocolo ON public.whatsapp_mensagens(atendimento_protocolo);

ALTER TABLE public.whatsapp_mensagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant pode ver mensagens do proprio lab"
  ON public.whatsapp_mensagens FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()));

CREATE POLICY "Tenant pode registrar mensagens do proprio lab"
  ON public.whatsapp_mensagens FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()));

CREATE POLICY "Tenant pode atualizar mensagens do proprio lab"
  ON public.whatsapp_mensagens FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()));

CREATE POLICY "Tenant pode deletar mensagens do proprio lab"
  ON public.whatsapp_mensagens FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_whatsapp_mensagens_updated_at
  BEFORE UPDATE ON public.whatsapp_mensagens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();