-- ============================================================
-- RDC 978/2025 — Rastreabilidade do Material Biológico
-- ============================================================

-- 1. Comunicação de valores críticos
CREATE TABLE public.criticos_comunicacoes (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  atendimento_id BIGINT NOT NULL REFERENCES public.atendimentos(id) ON DELETE CASCADE,
  atendimento_exame_id BIGINT NOT NULL REFERENCES public.atendimento_exames(id) ON DELETE CASCADE,
  protocolo TEXT NOT NULL DEFAULT '',
  paciente_nome TEXT NOT NULL DEFAULT '',
  exame_nome TEXT NOT NULL DEFAULT '',
  parametro TEXT NOT NULL DEFAULT '',
  valor TEXT NOT NULL DEFAULT '',
  faixa_critica TEXT NOT NULL DEFAULT '',
  canal TEXT NOT NULL CHECK (canal IN ('telefone','email','whatsapp','presencial','outro')),
  destinatario_nome TEXT NOT NULL,
  destinatario_contato TEXT NOT NULL DEFAULT '',
  observacao TEXT NOT NULL DEFAULT '',
  comunicado_por_email TEXT NOT NULL DEFAULT '',
  comunicado_por UUID,
  comunicado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_criticos_comunicacoes_atendimento ON public.criticos_comunicacoes(atendimento_id);
CREATE INDEX idx_criticos_comunicacoes_tenant_data ON public.criticos_comunicacoes(tenant_id, comunicado_em DESC);

ALTER TABLE public.criticos_comunicacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "criticos_select_tenant" ON public.criticos_comunicacoes FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "criticos_insert_tenant" ON public.criticos_comunicacoes FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

-- 2. Entrega de resultado
CREATE TABLE public.resultados_entregas (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  atendimento_id BIGINT NOT NULL REFERENCES public.atendimentos(id) ON DELETE CASCADE,
  atendimento_exame_id BIGINT REFERENCES public.atendimento_exames(id) ON DELETE CASCADE,
  protocolo TEXT NOT NULL DEFAULT '',
  paciente_nome TEXT NOT NULL DEFAULT '',
  canal TEXT NOT NULL CHECK (canal IN ('presencial','email','whatsapp','portal','impresso','outro')),
  destinatario_nome TEXT NOT NULL DEFAULT '',
  destinatario_contato TEXT NOT NULL DEFAULT '',
  observacao TEXT NOT NULL DEFAULT '',
  entregue_por_email TEXT NOT NULL DEFAULT '',
  entregue_por UUID,
  entregue_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_resultados_entregas_atendimento ON public.resultados_entregas(atendimento_id);
CREATE INDEX idx_resultados_entregas_tenant_data ON public.resultados_entregas(tenant_id, entregue_em DESC);

ALTER TABLE public.resultados_entregas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "entregas_select_tenant" ON public.resultados_entregas FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "entregas_insert_tenant" ON public.resultados_entregas FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

-- 3. Confirmação de identidade do paciente na coleta
CREATE TABLE public.identidade_confirmacoes (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  atendimento_id BIGINT NOT NULL REFERENCES public.atendimentos(id) ON DELETE CASCADE,
  protocolo TEXT NOT NULL DEFAULT '',
  paciente_nome TEXT NOT NULL DEFAULT '',
  identificadores JSONB NOT NULL DEFAULT '[]'::jsonb,
  observacao TEXT NOT NULL DEFAULT '',
  confirmado_por_email TEXT NOT NULL DEFAULT '',
  confirmado_por UUID,
  confirmado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_identidade_atendimento ON public.identidade_confirmacoes(atendimento_id);

ALTER TABLE public.identidade_confirmacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "identidade_select_tenant" ON public.identidade_confirmacoes FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "identidade_insert_tenant" ON public.identidade_confirmacoes FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

-- 4. Orientações pré-analíticas entregues
CREATE TABLE public.orientacoes_entregues (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  atendimento_id BIGINT NOT NULL REFERENCES public.atendimentos(id) ON DELETE CASCADE,
  protocolo TEXT NOT NULL DEFAULT '',
  paciente_nome TEXT NOT NULL DEFAULT '',
  exames JSONB NOT NULL DEFAULT '[]'::jsonb,
  itens_orientados JSONB NOT NULL DEFAULT '[]'::jsonb,
  canal TEXT NOT NULL DEFAULT 'presencial' CHECK (canal IN ('presencial','impresso','email','whatsapp','outro')),
  observacao TEXT NOT NULL DEFAULT '',
  entregue_por_email TEXT NOT NULL DEFAULT '',
  entregue_por UUID,
  entregue_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_orientacoes_atendimento ON public.orientacoes_entregues(atendimento_id);

ALTER TABLE public.orientacoes_entregues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orientacoes_select_tenant" ON public.orientacoes_entregues FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "orientacoes_insert_tenant" ON public.orientacoes_entregues FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

-- 5. Cadeia de custódia: transporte entre unidades / labs apoio
CREATE TABLE public.transporte_remessas (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  codigo TEXT NOT NULL,
  origem_tipo TEXT NOT NULL CHECK (origem_tipo IN ('unidade','externo')),
  origem_id TEXT NOT NULL DEFAULT '',
  origem_nome TEXT NOT NULL,
  destino_tipo TEXT NOT NULL CHECK (destino_tipo IN ('unidade','lab_apoio','externo')),
  destino_id TEXT NOT NULL DEFAULT '',
  destino_nome TEXT NOT NULL,
  amostras JSONB NOT NULL DEFAULT '[]'::jsonb,
  qtd_amostras INTEGER NOT NULL DEFAULT 0,
  temperatura TEXT NOT NULL DEFAULT '',
  condicoes TEXT NOT NULL DEFAULT '',
  observacao TEXT NOT NULL DEFAULT '',
  responsavel_envio TEXT NOT NULL DEFAULT '',
  enviado_por_email TEXT NOT NULL DEFAULT '',
  enviado_por UUID,
  enviado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  responsavel_recebimento TEXT NOT NULL DEFAULT '',
  recebido_por_email TEXT NOT NULL DEFAULT '',
  recebido_por UUID,
  recebido_em TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'em_transito' CHECK (status IN ('em_transito','recebido','divergente','cancelado')),
  observacao_recebimento TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_transporte_tenant_status ON public.transporte_remessas(tenant_id, status, enviado_em DESC);

CREATE OR REPLACE FUNCTION public.touch_transporte_remessas_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER trg_transporte_updated_at BEFORE UPDATE ON public.transporte_remessas
  FOR EACH ROW EXECUTE FUNCTION public.touch_transporte_remessas_updated_at();

ALTER TABLE public.transporte_remessas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transporte_select_tenant" ON public.transporte_remessas FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "transporte_insert_tenant" ON public.transporte_remessas FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "transporte_update_tenant" ON public.transporte_remessas FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id());

-- 6. Versionamento de POPs (Procedimentos Operacionais Padrão) por exame
CREATE TABLE public.exame_pops (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  exame_id UUID NOT NULL REFERENCES public.exames_catalogo(id) ON DELETE CASCADE,
  versao TEXT NOT NULL,
  metodologia TEXT NOT NULL DEFAULT '',
  conteudo TEXT NOT NULL DEFAULT '',
  vigente_de DATE NOT NULL DEFAULT CURRENT_DATE,
  vigente_ate DATE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  publicado_por_email TEXT NOT NULL DEFAULT '',
  publicado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, exame_id, versao)
);
CREATE INDEX idx_exame_pops_exame ON public.exame_pops(exame_id, vigente_de DESC);

CREATE OR REPLACE FUNCTION public.touch_exame_pops_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER trg_exame_pops_updated_at BEFORE UPDATE ON public.exame_pops
  FOR EACH ROW EXECUTE FUNCTION public.touch_exame_pops_updated_at();

ALTER TABLE public.exame_pops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pops_select_tenant" ON public.exame_pops FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "pops_insert_tenant" ON public.exame_pops FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "pops_update_tenant" ON public.exame_pops FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id());
CREATE POLICY "pops_delete_tenant" ON public.exame_pops FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id());

-- Snapshot da versão do POP no exame executado (referência ao registro vigente no momento da análise)
ALTER TABLE public.atendimento_exames
  ADD COLUMN IF NOT EXISTS pop_versao TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS pop_id BIGINT REFERENCES public.exame_pops(id);