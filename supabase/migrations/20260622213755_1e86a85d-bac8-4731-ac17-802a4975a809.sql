
-- =====================================================================
-- SOROTECA 2.0 — FASE 2: ESTRUTURA FÍSICA
-- =====================================================================

-- ---------- 1) locais_armazenamento ----------
CREATE TABLE public.locais_armazenamento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'geladeira',
  temperatura_min NUMERIC(5,2),
  temperatura_max NUMERIC(5,2),
  observacao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT locais_armazenamento_tipo_chk
    CHECK (tipo IN ('geladeira','freezer','armario','sala','outro')),
  CONSTRAINT locais_armazenamento_tenant_nome_uk UNIQUE (tenant_id, nome)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.locais_armazenamento TO authenticated;
GRANT ALL ON public.locais_armazenamento TO service_role;

ALTER TABLE public.locais_armazenamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "locais_select_tenant" ON public.locais_armazenamento
FOR SELECT TO authenticated
USING (tenant_id = public.current_tenant_id() OR public.is_super_admin());

CREATE POLICY "locais_insert_tenant" ON public.locais_armazenamento
FOR INSERT TO authenticated
WITH CHECK (
  (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(), 'gerenciar_soroteca'))
  OR public.is_super_admin()
);

CREATE POLICY "locais_update_tenant" ON public.locais_armazenamento
FOR UPDATE TO authenticated
USING (tenant_id = public.current_tenant_id() OR public.is_super_admin())
WITH CHECK (
  (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(), 'gerenciar_soroteca'))
  OR public.is_super_admin()
);

CREATE POLICY "locais_delete_tenant" ON public.locais_armazenamento
FOR DELETE TO authenticated
USING (
  (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(), 'gerenciar_soroteca'))
  OR public.is_super_admin()
);

CREATE INDEX idx_locais_tenant_ativo
  ON public.locais_armazenamento(tenant_id, ativo);

-- ---------- 2) galerias ----------
CREATE TABLE public.galerias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  local_id UUID NOT NULL REFERENCES public.locais_armazenamento(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT galerias_local_nome_uk UNIQUE (local_id, nome)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.galerias TO authenticated;
GRANT ALL ON public.galerias TO service_role;

ALTER TABLE public.galerias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "galerias_select_tenant" ON public.galerias
FOR SELECT TO authenticated
USING (tenant_id = public.current_tenant_id() OR public.is_super_admin());

CREATE POLICY "galerias_insert_tenant" ON public.galerias
FOR INSERT TO authenticated
WITH CHECK (
  (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(), 'gerenciar_soroteca'))
  OR public.is_super_admin()
);

CREATE POLICY "galerias_update_tenant" ON public.galerias
FOR UPDATE TO authenticated
USING (tenant_id = public.current_tenant_id() OR public.is_super_admin())
WITH CHECK (
  (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(), 'gerenciar_soroteca'))
  OR public.is_super_admin()
);

CREATE POLICY "galerias_delete_tenant" ON public.galerias
FOR DELETE TO authenticated
USING (
  (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(), 'gerenciar_soroteca'))
  OR public.is_super_admin()
);

CREATE INDEX idx_galerias_tenant_local
  ON public.galerias(tenant_id, local_id);

-- ---------- 3) posicoes_galeria ----------
CREATE TABLE public.posicoes_galeria (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  galeria_id UUID NOT NULL REFERENCES public.galerias(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT posicoes_galeria_codigo_uk UNIQUE (galeria_id, codigo)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.posicoes_galeria TO authenticated;
GRANT ALL ON public.posicoes_galeria TO service_role;

ALTER TABLE public.posicoes_galeria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "posicoes_select_tenant" ON public.posicoes_galeria
FOR SELECT TO authenticated
USING (tenant_id = public.current_tenant_id() OR public.is_super_admin());

CREATE POLICY "posicoes_insert_tenant" ON public.posicoes_galeria
FOR INSERT TO authenticated
WITH CHECK (
  (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(), 'gerenciar_soroteca'))
  OR public.is_super_admin()
);

CREATE POLICY "posicoes_update_tenant" ON public.posicoes_galeria
FOR UPDATE TO authenticated
USING (tenant_id = public.current_tenant_id() OR public.is_super_admin())
WITH CHECK (
  (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(), 'gerenciar_soroteca'))
  OR public.is_super_admin()
);

CREATE POLICY "posicoes_delete_tenant" ON public.posicoes_galeria
FOR DELETE TO authenticated
USING (
  (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(), 'gerenciar_soroteca'))
  OR public.is_super_admin()
);

CREATE INDEX idx_posicoes_tenant_galeria
  ON public.posicoes_galeria(tenant_id, galeria_id);

-- ---------- 4) amostra_alocacoes ----------
CREATE TABLE public.amostra_alocacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  amostra_id UUID NOT NULL REFERENCES public.amostras(id) ON DELETE CASCADE,
  posicao_id UUID NOT NULL REFERENCES public.posicoes_galeria(id) ON DELETE RESTRICT,
  alocada_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  retirada_em TIMESTAMPTZ,
  motivo_retirada TEXT,
  usuario_id UUID,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.amostra_alocacoes TO authenticated;
GRANT ALL ON public.amostra_alocacoes TO service_role;

ALTER TABLE public.amostra_alocacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alocacoes_select_tenant" ON public.amostra_alocacoes
FOR SELECT TO authenticated
USING (tenant_id = public.current_tenant_id() OR public.is_super_admin());

CREATE POLICY "alocacoes_insert_tenant" ON public.amostra_alocacoes
FOR INSERT TO authenticated
WITH CHECK (
  (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(), 'armazenar_amostra'))
  OR public.is_super_admin()
);

CREATE POLICY "alocacoes_update_tenant" ON public.amostra_alocacoes
FOR UPDATE TO authenticated
USING (tenant_id = public.current_tenant_id() OR public.is_super_admin())
WITH CHECK (
  (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(), 'armazenar_amostra'))
  OR public.is_super_admin()
);

CREATE POLICY "alocacoes_delete_super_admin" ON public.amostra_alocacoes
FOR DELETE TO authenticated
USING (public.is_super_admin());

CREATE UNIQUE INDEX uniq_posicao_ativa
  ON public.amostra_alocacoes(posicao_id)
  WHERE retirada_em IS NULL;

CREATE UNIQUE INDEX uniq_amostra_alocacao_ativa
  ON public.amostra_alocacoes(amostra_id)
  WHERE retirada_em IS NULL;

CREATE INDEX idx_alocacoes_tenant_amostra
  ON public.amostra_alocacoes(tenant_id, amostra_id);

CREATE INDEX idx_alocacoes_tenant_posicao
  ON public.amostra_alocacoes(tenant_id, posicao_id);

-- ---------- 5) Triggers updated_at ----------
CREATE TRIGGER trg_locais_updated_at
  BEFORE UPDATE ON public.locais_armazenamento
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_galerias_updated_at
  BEFORE UPDATE ON public.galerias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_posicoes_updated_at
  BEFORE UPDATE ON public.posicoes_galeria
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_alocacoes_updated_at
  BEFORE UPDATE ON public.amostra_alocacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- 6) Trigger: sincronizar amostras.localizacao ----------
CREATE OR REPLACE FUNCTION public.sync_amostra_localizacao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_texto TEXT;
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.retirada_em IS NULL AND OLD.retirada_em IS NOT NULL) THEN
    SELECT l.nome || ' > ' || g.nome || ' > ' || p.codigo
      INTO v_texto
      FROM public.posicoes_galeria p
      JOIN public.galerias g ON g.id = p.galeria_id
      JOIN public.locais_armazenamento l ON l.id = g.local_id
     WHERE p.id = NEW.posicao_id;
    UPDATE public.amostras SET localizacao = COALESCE(v_texto, '') WHERE id = NEW.amostra_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.retirada_em IS NOT NULL AND OLD.retirada_em IS NULL THEN
    UPDATE public.amostras SET localizacao = '' WHERE id = NEW.amostra_id
      AND NOT EXISTS (
        SELECT 1 FROM public.amostra_alocacoes a
         WHERE a.amostra_id = NEW.amostra_id AND a.retirada_em IS NULL AND a.id <> NEW.id
      );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_amostra_localizacao
  AFTER INSERT OR UPDATE ON public.amostra_alocacoes
  FOR EACH ROW EXECUTE FUNCTION public.sync_amostra_localizacao();
