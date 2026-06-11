-- =========================================================
-- 5a.4 — FINANCEIRO: saídas, orçamentos, view de entradas
-- =========================================================

-- ----- FINANCEIRO_SAIDAS -----
CREATE TABLE public.financeiro_saidas (
  id BIGSERIAL PRIMARY KEY,
  protocolo TEXT NOT NULL UNIQUE,
  data TIMESTAMPTZ NOT NULL DEFAULT now(),
  descricao TEXT NOT NULL DEFAULT '',
  valor NUMERIC(10,2) NOT NULL DEFAULT 0,
  tipo_despesa TEXT NOT NULL DEFAULT '',
  destino_pagamento TEXT NOT NULL DEFAULT '',
  data_vencimento DATE,
  foi_pago BOOLEAN NOT NULL DEFAULT false,
  data_pagamento DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_financeiro_saidas_data ON public.financeiro_saidas(data);

ALTER TABLE public.financeiro_saidas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Visualizar saidas via permissao"
  ON public.financeiro_saidas FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'visualizar_financeiro'));

CREATE POLICY "Criar saidas via permissao"
  ON public.financeiro_saidas FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'gestao_financeira'));

CREATE POLICY "Editar saidas via permissao"
  ON public.financeiro_saidas FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'gestao_financeira'))
  WITH CHECK (public.has_permission(auth.uid(), 'gestao_financeira'));

CREATE POLICY "Excluir saidas admin"
  ON public.financeiro_saidas FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER touch_financeiro_saidas_updated_at
  BEFORE UPDATE ON public.financeiro_saidas
  FOR EACH ROW EXECUTE FUNCTION public.touch_app_settings_updated_at();

-- ----- ORCAMENTOS -----
CREATE TABLE public.orcamentos (
  id BIGSERIAL PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  data TIMESTAMPTZ NOT NULL DEFAULT now(),
  paciente_nome TEXT NOT NULL,
  paciente_cpf TEXT NOT NULL DEFAULT '',
  paciente_telefone TEXT NOT NULL DEFAULT '',
  convenio_nome TEXT NOT NULL DEFAULT 'Particular',
  solicitante TEXT NOT NULL DEFAULT '',
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  desconto NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  convertido BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orcamentos_data ON public.orcamentos(data);

ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Visualizar orcamentos via permissao"
  ON public.orcamentos FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'visualizar_orcamentos'));

CREATE POLICY "Criar orcamentos via permissao"
  ON public.orcamentos FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'criar_orcamento'));

CREATE POLICY "Editar orcamentos via permissao"
  ON public.orcamentos FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'criar_orcamento'))
  WITH CHECK (public.has_permission(auth.uid(), 'criar_orcamento'));

CREATE POLICY "Excluir orcamentos admin"
  ON public.orcamentos FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER touch_orcamentos_updated_at
  BEFORE UPDATE ON public.orcamentos
  FOR EACH ROW EXECUTE FUNCTION public.touch_app_settings_updated_at();

-- ----- ORCAMENTO_EXAMES -----
CREATE TABLE public.orcamento_exames (
  id BIGSERIAL PRIMARY KEY,
  orcamento_id BIGINT NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  nome_exame TEXT NOT NULL,
  ordem INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orcamento_exames_orcamento_id ON public.orcamento_exames(orcamento_id);

ALTER TABLE public.orcamento_exames ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Visualizar orcamento_exames via permissao"
  ON public.orcamento_exames FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'visualizar_orcamentos'));

CREATE POLICY "Criar orcamento_exames via permissao"
  ON public.orcamento_exames FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'criar_orcamento'));

CREATE POLICY "Editar orcamento_exames via permissao"
  ON public.orcamento_exames FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'criar_orcamento'))
  WITH CHECK (public.has_permission(auth.uid(), 'criar_orcamento'));

CREATE POLICY "Excluir orcamento_exames via permissao"
  ON public.orcamento_exames FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'criar_orcamento') OR public.has_role(auth.uid(), 'admin'));

-- ----- VIEW: financeiro_entradas (read-only, derivada) -----
-- Espelha o contrato em src/pages/Financeiro.tsx: cada pagamento de atendimento
-- vira uma "entrada" identificada pelo protocolo do atendimento.
CREATE VIEW public.financeiro_entradas
WITH (security_invoker = true)
AS
SELECT
  ap.id                       AS pagamento_id,
  a.id                        AS atendimento_id,
  a.protocolo                 AS protocolo,
  ap.data                     AS data,
  a.paciente_nome             AS cliente,
  a.convenio_nome             AS convenio,
  ap.tipo                     AS payment,
  ap.valor                    AS valor_total,
  ap.observacao               AS observacao,
  a.unidade_id                AS unidade_id,
  a.status_pagamento          AS status_pagamento
FROM public.atendimento_pagamentos ap
JOIN public.atendimentos a ON a.id = ap.atendimento_id;

COMMENT ON VIEW public.financeiro_entradas IS
  'Read-only: entradas financeiras derivadas dos pagamentos de atendimentos. Edição deve ocorrer no atendimento.';