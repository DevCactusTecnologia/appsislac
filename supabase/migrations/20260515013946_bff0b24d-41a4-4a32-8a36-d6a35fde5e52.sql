CREATE TABLE IF NOT EXISTS public.transporte_remessas (
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

CREATE INDEX IF NOT EXISTS idx_transporte_tenant_status ON public.transporte_remessas(tenant_id, status, enviado_em DESC);

CREATE OR REPLACE FUNCTION public.touch_transporte_remessas_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_transporte_updated_at ON public.transporte_remessas;
CREATE TRIGGER trg_transporte_updated_at BEFORE UPDATE ON public.transporte_remessas
  FOR EACH ROW EXECUTE FUNCTION public.touch_transporte_remessas_updated_at();

ALTER TABLE public.transporte_remessas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "transporte_select_tenant" ON public.transporte_remessas;
CREATE POLICY "transporte_select_tenant" ON public.transporte_remessas FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "transporte_insert_tenant" ON public.transporte_remessas;
CREATE POLICY "transporte_insert_tenant" ON public.transporte_remessas FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "transporte_update_tenant" ON public.transporte_remessas;
CREATE POLICY "transporte_update_tenant" ON public.transporte_remessas FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id());