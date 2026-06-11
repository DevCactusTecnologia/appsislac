-- ============================================================
-- Tabela genérica para opções de selects configuráveis
-- ============================================================
CREATE TABLE IF NOT EXISTS public.select_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL,
  valor TEXT NOT NULL,
  label TEXT NOT NULL,
  ordem INT NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  sistema BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unicidade: por tenant (ou global) + categoria + valor (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_select_options_global
  ON public.select_options (categoria, lower(valor))
  WHERE tenant_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_select_options_tenant
  ON public.select_options (tenant_id, categoria, lower(valor))
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_select_options_categoria
  ON public.select_options (categoria, ativo, ordem);

CREATE INDEX IF NOT EXISTS idx_select_options_tenant
  ON public.select_options (tenant_id, categoria);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.select_options ENABLE ROW LEVEL SECURITY;

-- SELECT: globais OU do tenant atual
CREATE POLICY "select_options_read"
  ON public.select_options FOR SELECT
  TO authenticated
  USING (
    tenant_id IS NULL
    OR tenant_id = public.current_tenant_id()
  );

-- INSERT: apenas no tenant do usuário (admins via has_permission, mas RLS aceita
-- qualquer authenticated; controle fino via permissão no frontend + UI restrita).
CREATE POLICY "select_options_insert_tenant"
  ON public.select_options FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IS NOT NULL
    AND tenant_id = public.current_tenant_id()
  );

-- UPDATE: somente registros do próprio tenant
CREATE POLICY "select_options_update_tenant"
  ON public.select_options FOR UPDATE
  TO authenticated
  USING (
    tenant_id IS NOT NULL
    AND tenant_id = public.current_tenant_id()
  )
  WITH CHECK (
    tenant_id IS NOT NULL
    AND tenant_id = public.current_tenant_id()
  );

-- DELETE: somente registros do próprio tenant
CREATE POLICY "select_options_delete_tenant"
  ON public.select_options FOR DELETE
  TO authenticated
  USING (
    tenant_id IS NOT NULL
    AND tenant_id = public.current_tenant_id()
  );

-- Super admin pode tudo (manutenção do seed global)
CREATE POLICY "select_options_super_admin_all"
  ON public.select_options FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- ============================================================
-- Triggers
-- ============================================================
CREATE OR REPLACE FUNCTION public.touch_select_options_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_select_options_touch ON public.select_options;
CREATE TRIGGER trg_select_options_touch
  BEFORE UPDATE ON public.select_options
  FOR EACH ROW EXECUTE FUNCTION public.touch_select_options_updated_at();

-- Proteção: itens marcados como sistema não podem ser renomeados nem excluídos
CREATE OR REPLACE FUNCTION public.protect_select_options_sistema()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.sistema = true THEN
    RAISE EXCEPTION 'Opções do sistema não podem ser excluídas';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.sistema = true THEN
    IF NEW.valor <> OLD.valor THEN
      RAISE EXCEPTION 'Valor (chave) de itens do sistema é imutável';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_select_options_protect ON public.select_options;
CREATE TRIGGER trg_select_options_protect
  BEFORE UPDATE OR DELETE ON public.select_options
  FOR EACH ROW EXECUTE FUNCTION public.protect_select_options_sistema();

-- ============================================================
-- Seed global: canais_comunicacao
-- (tenant_id = NULL → visível para todos)
-- ============================================================
INSERT INTO public.select_options (tenant_id, categoria, valor, label, ordem, sistema)
VALUES
  (NULL, 'canais_comunicacao', 'telefone',   'Telefone',           1, true),
  (NULL, 'canais_comunicacao', 'whatsapp',   'WhatsApp',           2, true),
  (NULL, 'canais_comunicacao', 'email',      'E-mail',             3, true),
  (NULL, 'canais_comunicacao', 'presencial', 'Presencial',         4, true),
  (NULL, 'canais_comunicacao', 'portal',     'Portal do paciente', 5, true),
  (NULL, 'canais_comunicacao', 'impresso',   'Impresso (retirado)',6, true),
  (NULL, 'canais_comunicacao', 'outro',      'Outro',              7, true)
ON CONFLICT DO NOTHING;