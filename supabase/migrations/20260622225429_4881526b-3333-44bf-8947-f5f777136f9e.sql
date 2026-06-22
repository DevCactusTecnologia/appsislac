
-- Fase 6 — Empréstimos de Amostras (Soroteca)
-- Workflow: PENDENTE → APROVADO → RETIRADO → DEVOLVIDO
-- Alternativas: REJEITADO, CANCELADO

CREATE TYPE emprestimo_amostra_status AS ENUM (
  'PENDENTE',
  'APROVADO',
  'REJEITADO',
  'RETIRADO',
  'DEVOLVIDO',
  'CANCELADO'
);

CREATE TABLE public.amostra_emprestimos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  amostra_id uuid NOT NULL REFERENCES public.amostras(id) ON DELETE CASCADE,
  status emprestimo_amostra_status NOT NULL DEFAULT 'PENDENTE',

  -- Solicitação
  solicitante_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  solicitante_nome text NOT NULL,
  destinatario_nome text NOT NULL,
  motivo text NOT NULL,
  prazo_devolucao date,
  observacao_solicitacao text,
  solicitado_em timestamptz NOT NULL DEFAULT now(),

  -- Aprovação / Rejeição
  aprovador_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  aprovador_nome text,
  decidido_em timestamptz,
  motivo_rejeicao text,

  -- Retirada física
  retirado_em timestamptz,
  retirado_por_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  retirado_por_nome text,

  -- Devolução
  devolvido_em timestamptz,
  devolvido_por_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  devolvido_por_nome text,
  observacao_devolucao text,

  -- Cancelamento
  cancelado_em timestamptz,
  motivo_cancelamento text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Apenas 1 empréstimo ATIVO (não terminal) por amostra.
CREATE UNIQUE INDEX uniq_emprestimo_amostra_ativo
  ON public.amostra_emprestimos (amostra_id)
  WHERE status IN ('PENDENTE', 'APROVADO', 'RETIRADO');

CREATE INDEX idx_emprestimos_tenant_status
  ON public.amostra_emprestimos (tenant_id, status);

CREATE INDEX idx_emprestimos_amostra
  ON public.amostra_emprestimos (amostra_id);

CREATE INDEX idx_emprestimos_solicitado_em
  ON public.amostra_emprestimos (tenant_id, solicitado_em DESC);

-- Trigger updated_at
CREATE TRIGGER trg_amostra_emprestimos_updated_at
  BEFORE UPDATE ON public.amostra_emprestimos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- GRANTS (passo obrigatório)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.amostra_emprestimos TO authenticated;
GRANT ALL ON public.amostra_emprestimos TO service_role;

-- RLS
ALTER TABLE public.amostra_emprestimos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "emprestimos_select_tenant" ON public.amostra_emprestimos
  FOR SELECT
  USING ((tenant_id = current_tenant_id()) OR is_super_admin());

CREATE POLICY "emprestimos_insert_tenant" ON public.amostra_emprestimos
  FOR INSERT
  WITH CHECK (
    ((tenant_id = current_tenant_id()) AND has_permission(auth.uid(), 'armazenar_amostra'))
    OR is_super_admin()
  );

CREATE POLICY "emprestimos_update_tenant" ON public.amostra_emprestimos
  FOR UPDATE
  USING ((tenant_id = current_tenant_id()) OR is_super_admin())
  WITH CHECK (
    ((tenant_id = current_tenant_id()) AND has_permission(auth.uid(), 'armazenar_amostra'))
    OR is_super_admin()
  );

CREATE POLICY "emprestimos_delete_super_admin" ON public.amostra_emprestimos
  FOR DELETE
  USING (is_super_admin());

-- Função utilitária: amostra está com empréstimo ATIVO?
CREATE OR REPLACE FUNCTION public.amostra_em_emprestimo_ativo(_amostra_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.amostra_emprestimos
    WHERE amostra_id = _amostra_id
      AND status IN ('PENDENTE', 'APROVADO', 'RETIRADO')
  );
$$;
