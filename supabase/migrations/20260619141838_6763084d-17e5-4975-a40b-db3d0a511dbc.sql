-- ============================================================
-- Fase 10 — Auditoria financeira
-- ============================================================
-- Registra automaticamente todo INSERT/UPDATE/DELETE nas tabelas
-- financeiras críticas. Estrutural; nenhuma UI nesta fase.
--
-- DOWN (rollback emergencial):
--   DROP TRIGGER ... ON <cada_tabela>;
--   DROP FUNCTION public.financeiro_audit_trg();
--   DROP TABLE public.financeiro_audit;
-- ============================================================

-- 1) Tabela
CREATE TABLE IF NOT EXISTS public.financeiro_audit (
  id          BIGSERIAL PRIMARY KEY,
  tenant_id   UUID,                       -- pode vir NULL em raros casos legados; preferimos preservar
  entidade    TEXT NOT NULL,              -- 'atendimento_pagamentos' | 'financeiro_saidas' | 'convenio_faturas' | 'financeiro_estornos' | 'caixa_sessoes'
  entidade_id TEXT NOT NULL,              -- cast em TEXT para acomodar bigint/uuid
  acao        TEXT NOT NULL CHECK (acao IN ('insert','update','delete')),
  antes       JSONB,
  depois      JSONB,
  ator_id     UUID,                       -- auth.uid() quando disponível
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) GRANTs (obrigatório — Data API não concede defaults)
GRANT SELECT ON public.financeiro_audit TO authenticated;
GRANT ALL    ON public.financeiro_audit TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.financeiro_audit_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.financeiro_audit_id_seq TO service_role;

-- 3) Índices
CREATE INDEX IF NOT EXISTS idx_financeiro_audit_tenant_criado
  ON public.financeiro_audit (tenant_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_financeiro_audit_entidade
  ON public.financeiro_audit (tenant_id, entidade, entidade_id);

-- 4) RLS
ALTER TABLE public.financeiro_audit ENABLE ROW LEVEL SECURITY;

-- Leitura: super_admin OU mesmo tenant + permissão financeira
DROP POLICY IF EXISTS "financeiro_audit_select" ON public.financeiro_audit;
CREATE POLICY "financeiro_audit_select"
  ON public.financeiro_audit
  FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR (
      tenant_id = public.current_tenant_id()
      AND (
        public.has_permission(auth.uid(), 'visualizar_financeiro')
        OR public.has_permission(auth.uid(), 'gestao_financeira')
      )
    )
  );

-- Escrita direta: bloqueada para todos (apenas triggers SECURITY DEFINER inserem).
DROP POLICY IF EXISTS "financeiro_audit_no_insert" ON public.financeiro_audit;
CREATE POLICY "financeiro_audit_no_insert"
  ON public.financeiro_audit
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "financeiro_audit_no_update" ON public.financeiro_audit;
CREATE POLICY "financeiro_audit_no_update"
  ON public.financeiro_audit
  FOR UPDATE
  TO authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "financeiro_audit_no_delete" ON public.financeiro_audit;
CREATE POLICY "financeiro_audit_no_delete"
  ON public.financeiro_audit
  FOR DELETE
  TO authenticated
  USING (public.is_super_admin());

-- 5) Função de trigger genérica (SECURITY DEFINER → ignora RLS p/ inserir)
CREATE OR REPLACE FUNCTION public.financeiro_audit_trg()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant   UUID;
  v_id       TEXT;
  v_acao     TEXT;
  v_antes    JSONB;
  v_depois   JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_acao   := 'insert';
    v_antes  := NULL;
    v_depois := to_jsonb(NEW);
    v_id     := COALESCE((to_jsonb(NEW) ->> 'id'), '');
    v_tenant := NULLIF(to_jsonb(NEW) ->> 'tenant_id','')::uuid;
  ELSIF TG_OP = 'UPDATE' THEN
    v_acao   := 'update';
    v_antes  := to_jsonb(OLD);
    v_depois := to_jsonb(NEW);
    v_id     := COALESCE((to_jsonb(NEW) ->> 'id'), '');
    v_tenant := NULLIF(to_jsonb(NEW) ->> 'tenant_id','')::uuid;
    -- Se nada mudou de fato, evita ruído.
    IF v_antes IS NOT DISTINCT FROM v_depois THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_acao   := 'delete';
    v_antes  := to_jsonb(OLD);
    v_depois := NULL;
    v_id     := COALESCE((to_jsonb(OLD) ->> 'id'), '');
    v_tenant := NULLIF(to_jsonb(OLD) ->> 'tenant_id','')::uuid;
  END IF;

  INSERT INTO public.financeiro_audit (
    tenant_id, entidade, entidade_id, acao, antes, depois, ator_id
  ) VALUES (
    v_tenant, TG_TABLE_NAME, v_id, v_acao, v_antes, v_depois, auth.uid()
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- 6) Triggers AFTER em cada tabela auditada
DROP TRIGGER IF EXISTS trg_financeiro_audit ON public.atendimento_pagamentos;
CREATE TRIGGER trg_financeiro_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.atendimento_pagamentos
  FOR EACH ROW EXECUTE FUNCTION public.financeiro_audit_trg();

DROP TRIGGER IF EXISTS trg_financeiro_audit ON public.financeiro_saidas;
CREATE TRIGGER trg_financeiro_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.financeiro_saidas
  FOR EACH ROW EXECUTE FUNCTION public.financeiro_audit_trg();

DROP TRIGGER IF EXISTS trg_financeiro_audit ON public.convenio_faturas;
CREATE TRIGGER trg_financeiro_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.convenio_faturas
  FOR EACH ROW EXECUTE FUNCTION public.financeiro_audit_trg();

DROP TRIGGER IF EXISTS trg_financeiro_audit ON public.financeiro_estornos;
CREATE TRIGGER trg_financeiro_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.financeiro_estornos
  FOR EACH ROW EXECUTE FUNCTION public.financeiro_audit_trg();

DROP TRIGGER IF EXISTS trg_financeiro_audit ON public.caixa_sessoes;
CREATE TRIGGER trg_financeiro_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.caixa_sessoes
  FOR EACH ROW EXECUTE FUNCTION public.financeiro_audit_trg();

COMMENT ON TABLE public.financeiro_audit IS
  'Fase 10 — Auditoria financeira: snapshot antes/depois de pagamentos, saídas, faturas, estornos e sessões de caixa. Apenas triggers escrevem.';
