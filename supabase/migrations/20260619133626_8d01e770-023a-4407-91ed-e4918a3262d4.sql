
-- ============================================================
-- Financeiro V2 — Fase 8: Caixa Operacional (opcional)
-- ------------------------------------------------------------
-- Apenas estrutura. Default OFF: tenants atuais ficam exatamente
-- como hoje. Quando o flag `usar_caixa_operacional` for ativado
-- por um tenant, os recebimentos do dia poderão ser vinculados
-- à sessão aberta da unidade (UI nas fases seguintes).
-- ============================================================

-- 1) Tabela caixa_sessoes
CREATE TABLE IF NOT EXISTS public.caixa_sessoes (
  id              bigserial PRIMARY KEY,
  tenant_id       uuid NOT NULL,
  unidade_id      text NOT NULL REFERENCES public.unidades(id) ON DELETE RESTRICT,
  aberta_em       timestamptz NOT NULL DEFAULT now(),
  fechada_em      timestamptz NULL,
  responsavel_id  uuid NULL,                 -- auth.users.id (sem FK direta — Supabase gerencia auth)
  valor_abertura  numeric(14,2) NOT NULL DEFAULT 0,
  valor_fechamento numeric(14,2) NULL,
  observacoes     text NULL,
  status          text NOT NULL DEFAULT 'aberta'
    CHECK (status IN ('aberta','fechada','cancelada')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- 2) GRANTS (obrigatório no schema public)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.caixa_sessoes TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.caixa_sessoes_id_seq TO authenticated;
GRANT ALL ON public.caixa_sessoes TO service_role;
GRANT ALL ON SEQUENCE public.caixa_sessoes_id_seq TO service_role;

-- 3) Índices
CREATE INDEX IF NOT EXISTS idx_caixa_sessoes_tenant
  ON public.caixa_sessoes (tenant_id, status, aberta_em DESC);

-- Regra: no máximo UMA sessão "aberta" por (tenant, unidade)
CREATE UNIQUE INDEX IF NOT EXISTS uq_caixa_sessoes_aberta_por_unidade
  ON public.caixa_sessoes (tenant_id, unidade_id)
  WHERE status = 'aberta';

-- 4) RLS
ALTER TABLE public.caixa_sessoes ENABLE ROW LEVEL SECURITY;

-- SELECT: qualquer usuário do tenant que possa ver financeiro; super_admin vê tudo
CREATE POLICY "caixa_sessoes_select_tenant"
  ON public.caixa_sessoes
  FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (
      tenant_id = public.current_tenant_id()
      AND (
        public.has_permission(auth.uid(), 'visualizar_financeiro')
        OR public.has_permission(auth.uid(), 'gestao_financeira')
      )
    )
  );

-- INSERT: precisa gestao_financeira no tenant atual
CREATE POLICY "caixa_sessoes_insert_tenant"
  ON public.caixa_sessoes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR (
      tenant_id = public.current_tenant_id()
      AND public.has_permission(auth.uid(), 'gestao_financeira')
    )
  );

-- UPDATE: idem (fechar/cancelar sessão)
CREATE POLICY "caixa_sessoes_update_tenant"
  ON public.caixa_sessoes
  FOR UPDATE
  TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (
      tenant_id = public.current_tenant_id()
      AND public.has_permission(auth.uid(), 'gestao_financeira')
    )
  )
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR (
      tenant_id = public.current_tenant_id()
      AND public.has_permission(auth.uid(), 'gestao_financeira')
    )
  );

-- DELETE: bloqueado para usuários comuns; só super_admin (Fase 9 tratará estornos formais)
CREATE POLICY "caixa_sessoes_delete_super_admin"
  ON public.caixa_sessoes
  FOR DELETE
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- 5) updated_at trigger (reaproveita função padrão do projeto)
DROP TRIGGER IF EXISTS trg_caixa_sessoes_updated_at ON public.caixa_sessoes;
CREATE TRIGGER trg_caixa_sessoes_updated_at
  BEFORE UPDATE ON public.caixa_sessoes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 6) Flag por tenant em app_settings (default OFF — tenants atuais inalterados)
--    Não inserimos linhas: a leitura no app deve assumir `false` quando ausente.
COMMENT ON TABLE public.caixa_sessoes IS
  'Fase 8 — Caixa Operacional (opcional). Ativado por tenant via app_settings.usar_caixa_operacional=true.';

-- DOWN (rollback emergencial — referência)
-- DROP TABLE public.caixa_sessoes;
