-- Restore 4 legacy dictionary tables, this time disabling the forwarding trigger
-- during seed (rows already exist in select_options from C.1; we link them by legacy_id afterwards).

CREATE TABLE IF NOT EXISTS public.financeiro_tipos_despesa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  sistema boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT financeiro_tipos_despesa_unique_nome UNIQUE (tenant_id, nome)
);
CREATE INDEX IF NOT EXISTS idx_financeiro_tipos_despesa_tenant ON public.financeiro_tipos_despesa(tenant_id);

CREATE TABLE IF NOT EXISTS public.financeiro_destinos_pagamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  sistema boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT financeiro_destinos_pagamento_unique_nome UNIQUE (tenant_id, nome)
);
CREATE INDEX IF NOT EXISTS idx_financeiro_destinos_pagamento_tenant ON public.financeiro_destinos_pagamento(tenant_id);

CREATE TABLE IF NOT EXISTS public.financeiro_formas_pagamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  sistema boolean NOT NULL DEFAULT false,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT financeiro_formas_pagamento_unique_nome UNIQUE (tenant_id, nome)
);
CREATE INDEX IF NOT EXISTS idx_financeiro_formas_pagamento_tenant ON public.financeiro_formas_pagamento(tenant_id);

CREATE TABLE IF NOT EXISTS public.motivos_cancelamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  sistema boolean NOT NULL DEFAULT false,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT motivos_cancelamento_tenant_id_nome_key UNIQUE (tenant_id, nome)
);
CREATE INDEX IF NOT EXISTS idx_motivos_cancelamento_tenant ON public.motivos_cancelamento(tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_tipos_despesa TO authenticated;
GRANT ALL ON public.financeiro_tipos_despesa TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_destinos_pagamento TO authenticated;
GRANT ALL ON public.financeiro_destinos_pagamento TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_formas_pagamento TO authenticated;
GRANT ALL ON public.financeiro_formas_pagamento TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.motivos_cancelamento TO authenticated;
GRANT ALL ON public.motivos_cancelamento TO service_role;

ALTER TABLE public.financeiro_tipos_despesa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_destinos_pagamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_formas_pagamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.motivos_cancelamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY fintipdesp_select ON public.financeiro_tipos_despesa FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin());
CREATE POLICY fintipdesp_insert ON public.financeiro_tipos_despesa FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.is_super_admin());
CREATE POLICY fintipdesp_update ON public.financeiro_tipos_despesa FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin())
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.is_super_admin());
CREATE POLICY fintipdesp_delete ON public.financeiro_tipos_despesa FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin());

CREATE POLICY findestpag_select ON public.financeiro_destinos_pagamento FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin());
CREATE POLICY findestpag_insert ON public.financeiro_destinos_pagamento FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.is_super_admin());
CREATE POLICY findestpag_update ON public.financeiro_destinos_pagamento FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin())
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.is_super_admin());
CREATE POLICY findestpag_delete ON public.financeiro_destinos_pagamento FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin());

CREATE POLICY finformpag_select ON public.financeiro_formas_pagamento FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin());
CREATE POLICY finformpag_insert ON public.financeiro_formas_pagamento FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.is_super_admin());
CREATE POLICY finformpag_update ON public.financeiro_formas_pagamento FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin())
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.is_super_admin());
CREATE POLICY finformpag_delete ON public.financeiro_formas_pagamento FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin());

CREATE POLICY motcanc_select ON public.motivos_cancelamento FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin());
CREATE POLICY motcanc_insert ON public.motivos_cancelamento FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.is_super_admin());
CREATE POLICY motcanc_update ON public.motivos_cancelamento FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin())
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.is_super_admin());
CREATE POLICY motcanc_delete ON public.motivos_cancelamento FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin());

CREATE OR REPLACE FUNCTION public.touch_financeiro_listas_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE OR REPLACE FUNCTION public.protect_financeiro_listas_sistema()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.sistema = true THEN
    RAISE EXCEPTION 'Itens do sistema nao podem ser excluidos';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.sistema = true AND NEW.nome <> OLD.nome THEN
    RAISE EXCEPTION 'Itens do sistema nao podem ser renomeados';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_touch_financeiro_tipos_despesa BEFORE UPDATE ON public.financeiro_tipos_despesa
  FOR EACH ROW EXECUTE FUNCTION public.touch_financeiro_listas_updated_at();
CREATE TRIGGER trg_touch_financeiro_destinos_pagamento BEFORE UPDATE ON public.financeiro_destinos_pagamento
  FOR EACH ROW EXECUTE FUNCTION public.touch_financeiro_listas_updated_at();
CREATE TRIGGER trg_touch_financeiro_formas_pagamento BEFORE UPDATE ON public.financeiro_formas_pagamento
  FOR EACH ROW EXECUTE FUNCTION public.touch_financeiro_listas_updated_at();
CREATE TRIGGER trg_touch_motivos_cancelamento BEFORE UPDATE ON public.motivos_cancelamento
  FOR EACH ROW EXECUTE FUNCTION public.touch_financeiro_listas_updated_at();

CREATE TRIGGER trg_protect_financeiro_tipos_despesa BEFORE UPDATE OR DELETE ON public.financeiro_tipos_despesa
  FOR EACH ROW EXECUTE FUNCTION public.protect_financeiro_listas_sistema();
CREATE TRIGGER trg_protect_financeiro_destinos_pagamento BEFORE UPDATE OR DELETE ON public.financeiro_destinos_pagamento
  FOR EACH ROW EXECUTE FUNCTION public.protect_financeiro_listas_sistema();
CREATE TRIGGER trg_protect_financeiro_formas_pagamento BEFORE UPDATE OR DELETE ON public.financeiro_formas_pagamento
  FOR EACH ROW EXECUTE FUNCTION public.protect_financeiro_listas_sistema();
CREATE TRIGGER trg_protect_motivos_cancelamento BEFORE UPDATE OR DELETE ON public.motivos_cancelamento
  FOR EACH ROW EXECUTE FUNCTION public.protect_financeiro_listas_sistema();

-- Forwarding triggers (created DISABLED until seed completes)
CREATE TRIGGER trg_fwd_motivos_cancelamento
  AFTER INSERT OR UPDATE OR DELETE ON public.motivos_cancelamento
  FOR EACH ROW EXECUTE FUNCTION public.fwd_legacy_dict_to_select_options('motivo_cancelamento');
CREATE TRIGGER trg_fwd_financeiro_formas_pagamento
  AFTER INSERT OR UPDATE OR DELETE ON public.financeiro_formas_pagamento
  FOR EACH ROW EXECUTE FUNCTION public.fwd_legacy_dict_to_select_options('financeiro_forma_pagamento');
CREATE TRIGGER trg_fwd_financeiro_destinos_pagamento
  AFTER INSERT OR UPDATE OR DELETE ON public.financeiro_destinos_pagamento
  FOR EACH ROW EXECUTE FUNCTION public.fwd_legacy_dict_to_select_options('financeiro_destino_pagamento');
CREATE TRIGGER trg_fwd_financeiro_tipos_despesa
  AFTER INSERT OR UPDATE OR DELETE ON public.financeiro_tipos_despesa
  FOR EACH ROW EXECUTE FUNCTION public.fwd_legacy_dict_to_select_options('financeiro_tipo_despesa');

ALTER TABLE public.motivos_cancelamento DISABLE TRIGGER trg_fwd_motivos_cancelamento;
ALTER TABLE public.financeiro_formas_pagamento DISABLE TRIGGER trg_fwd_financeiro_formas_pagamento;
ALTER TABLE public.financeiro_destinos_pagamento DISABLE TRIGGER trg_fwd_financeiro_destinos_pagamento;
ALTER TABLE public.financeiro_tipos_despesa DISABLE TRIGGER trg_fwd_financeiro_tipos_despesa;

-- ============ SEED DATA (tenant 00000000-0000-0000-0000-000000000001 only) ============
INSERT INTO public.financeiro_destinos_pagamento (id, tenant_id, nome, ativo, sistema, created_at, updated_at) VALUES
 ('268fe072-c9fb-4a1b-9a13-79cb9877f446','00000000-0000-0000-0000-000000000001','Banco',TRUE,TRUE,'2026-06-09 20:12:06.248294+00','2026-06-09 20:12:06.248294+00'),
 ('4ab7212d-1852-40f9-bea0-ca5c071d6470','00000000-0000-0000-0000-000000000001','Concessionária',TRUE,TRUE,'2026-06-09 20:12:06.248294+00','2026-06-09 20:12:06.248294+00'),
 ('57b3e45b-9689-4f96-a65e-58f8528d61ca','00000000-0000-0000-0000-000000000001','Fornecedor',TRUE,TRUE,'2026-06-09 20:12:06.248294+00','2026-06-09 20:12:06.248294+00'),
 ('40ef77e9-a3e5-4375-bdbf-65d5e802d2d2','00000000-0000-0000-0000-000000000001','Funcionário',TRUE,TRUE,'2026-06-09 20:12:06.248294+00','2026-06-09 20:12:06.248294+00'),
 ('a35e2550-9838-4bbb-a421-c89acccaa90e','00000000-0000-0000-0000-000000000001','Governo',TRUE,TRUE,'2026-06-09 20:12:06.248294+00','2026-06-09 20:12:06.248294+00'),
 ('f35819d2-e214-490d-9d64-c9371d804865','00000000-0000-0000-0000-000000000001','Outros',TRUE,TRUE,'2026-06-09 20:12:06.248294+00','2026-06-09 20:12:06.248294+00'),
 ('b94dd286-be1b-40b5-b424-0ca7d1153456','00000000-0000-0000-0000-000000000001','Prestador de serviço',TRUE,TRUE,'2026-06-09 20:12:06.248294+00','2026-06-09 20:12:06.248294+00')
ON CONFLICT (tenant_id, nome) DO NOTHING;

INSERT INTO public.financeiro_formas_pagamento (id, tenant_id, nome, ativo, sistema, ordem, created_at, updated_at) VALUES
 ('9cf4bfbb-df82-4faf-a219-feef57a0f31b','00000000-0000-0000-0000-000000000001','Dinheiro',TRUE,TRUE,0,'2026-06-09 20:12:06.248294+00','2026-06-09 20:12:06.248294+00'),
 ('f757b1f9-d2fc-47fa-a285-12017a6126b2','00000000-0000-0000-0000-000000000001','PIX',TRUE,TRUE,0,'2026-06-09 20:12:06.248294+00','2026-06-09 20:12:06.248294+00'),
 ('71c7f16d-d306-451a-a408-eda6fbcd3472','00000000-0000-0000-0000-000000000001','Cartão de Débito',TRUE,TRUE,0,'2026-06-09 20:12:06.248294+00','2026-06-09 20:12:06.248294+00'),
 ('ce4ff519-4b80-4c3c-bc21-a622d7fa83bc','00000000-0000-0000-0000-000000000001','Cartão de Crédito',TRUE,TRUE,0,'2026-06-09 20:12:06.248294+00','2026-06-09 20:12:06.248294+00'),
 ('7a802ee2-43ce-4ef3-b484-203905acc2ba','00000000-0000-0000-0000-000000000001','Transferência bancária',TRUE,TRUE,0,'2026-06-09 20:12:06.248294+00','2026-06-09 20:12:06.248294+00'),
 ('42b4ada7-e4ef-404b-aca4-74e1fe873381','00000000-0000-0000-0000-000000000001','Boleto',TRUE,TRUE,0,'2026-06-09 20:12:06.248294+00','2026-06-09 20:12:06.248294+00'),
 ('9a97c99d-9aa9-44e0-9337-b9c07a918fb6','00000000-0000-0000-0000-000000000001','Transferência',TRUE,TRUE,6,'2026-04-19 00:15:02.871228+00','2026-04-19 00:15:02.871228+00')
ON CONFLICT (tenant_id, nome) DO NOTHING;

INSERT INTO public.motivos_cancelamento (id, tenant_id, nome, ativo, sistema, ordem, created_at, updated_at) VALUES
 ('4ca3d49f-442b-4df6-8985-8d494d2b7300','00000000-0000-0000-0000-000000000001','Paciente desistiu do atendimento',TRUE,TRUE,1,'2026-06-09 20:12:06.248294+00','2026-06-09 20:12:06.248294+00'),
 ('9200d489-0c4d-43b8-be0a-d66e7046e2a4','00000000-0000-0000-0000-000000000001','Paciente não compareceu',TRUE,TRUE,2,'2026-06-09 20:12:06.248294+00','2026-06-09 20:12:06.248294+00'),
 ('27e7866a-5322-453e-a6ea-106dbe983181','00000000-0000-0000-0000-000000000001','Cadastro incorreto do paciente',TRUE,TRUE,3,'2026-06-09 20:12:06.248294+00','2026-06-09 20:12:06.248294+00'),
 ('d7a5235f-84ed-4473-8617-274cd6d67293','00000000-0000-0000-0000-000000000001','Cadastro incorreto do exame',TRUE,TRUE,4,'2026-06-09 20:12:06.248294+00','2026-06-09 20:12:06.248294+00'),
 ('4a2700e8-8cc0-4540-9e52-dfaef5e9b6dc','00000000-0000-0000-0000-000000000001','Convênio não autorizado',TRUE,TRUE,5,'2026-06-09 20:12:06.248294+00','2026-06-09 20:12:06.248294+00'),
 ('3acfb8ba-dd52-4e20-bdb8-b3c3f95bea1a','00000000-0000-0000-0000-000000000001','Atendimento em duplicidade',TRUE,TRUE,6,'2026-06-09 20:12:06.248294+00','2026-06-09 20:12:06.248294+00'),
 ('5ee498fa-4bce-4d25-93bc-277e4d803399','00000000-0000-0000-0000-000000000001','Solicitação médica inválida ou ilegível',TRUE,TRUE,7,'2026-06-09 20:12:06.248294+00','2026-06-09 20:12:06.248294+00'),
 ('af07e7a9-ec6a-45a5-ab37-c95b4fd8c13c','00000000-0000-0000-0000-000000000001','Outro (descrever)',TRUE,TRUE,99,'2026-06-09 20:12:06.248294+00','2026-06-09 20:12:06.248294+00')
ON CONFLICT (tenant_id, nome) DO NOTHING;

INSERT INTO public.financeiro_tipos_despesa (id, tenant_id, nome, ativo, sistema, created_at, updated_at) VALUES
 ('29fef373-c2e3-44ab-9c54-08d20cffaaaa','00000000-0000-0000-0000-000000000001','Água',TRUE,TRUE,'2026-06-09 20:12:06.248294+00','2026-06-09 20:12:06.248294+00'),
 ('1b48f39c-19fd-4d51-b97b-5ee0edaf13e7','00000000-0000-0000-0000-000000000001','Aluguel',TRUE,TRUE,'2026-06-09 20:12:06.248294+00','2026-06-09 20:12:06.248294+00'),
 ('2b7012d5-eee1-4876-9907-0a826f8b7e12','00000000-0000-0000-0000-000000000001','Combustível',TRUE,TRUE,'2026-06-09 20:12:06.248294+00','2026-06-09 20:12:06.248294+00'),
 ('3b7012d5-eee1-4876-9907-0a826f8b7e13','00000000-0000-0000-0000-000000000001','Encargos sociais',TRUE,TRUE,'2026-06-09 20:12:06.248294+00','2026-06-09 20:12:06.248294+00'),
 ('4b7012d5-eee1-4876-9907-0a826f8b7e14','00000000-0000-0000-0000-000000000001','Energia elétrica',TRUE,TRUE,'2026-06-09 20:12:06.248294+00','2026-06-09 20:12:06.248294+00'),
 ('5b7012d5-eee1-4876-9907-0a826f8b7e15','00000000-0000-0000-0000-000000000001','Impostos',TRUE,TRUE,'2026-06-09 20:12:06.248294+00','2026-06-09 20:12:06.248294+00'),
 ('6b7012d5-eee1-4876-9907-0a826f8b7e16','00000000-0000-0000-0000-000000000001','Internet/Telefone',TRUE,TRUE,'2026-06-09 20:12:06.248294+00','2026-06-09 20:12:06.248294+00'),
 ('7b7012d5-eee1-4876-9907-0a826f8b7e17','00000000-0000-0000-0000-000000000001','Manutenção de equipamentos',TRUE,TRUE,'2026-06-09 20:12:06.248294+00','2026-06-09 20:12:06.248294+00'),
 ('8b7012d5-eee1-4876-9907-0a826f8b7e18','00000000-0000-0000-0000-000000000001','Marketing',TRUE,TRUE,'2026-06-09 20:12:06.248294+00','2026-06-09 20:12:06.248294+00'),
 ('9b7012d5-eee1-4876-9907-0a826f8b7e19','00000000-0000-0000-0000-000000000001','Material de escritório',TRUE,TRUE,'2026-06-09 20:12:06.248294+00','2026-06-09 20:12:06.248294+00'),
 ('ab7012d5-eee1-4876-9907-0a826f8b7e1a','00000000-0000-0000-0000-000000000001','Material de limpeza',TRUE,TRUE,'2026-06-09 20:12:06.248294+00','2026-06-09 20:12:06.248294+00'),
 ('bb7012d5-eee1-4876-9907-0a826f8b7e1b','00000000-0000-0000-0000-000000000001','Material laboratorial',TRUE,TRUE,'2026-06-09 20:12:06.248294+00','2026-06-09 20:12:06.248294+00'),
 ('cb7012d5-eee1-4876-9907-0a826f8b7e1c','00000000-0000-0000-0000-000000000001','Outros',TRUE,TRUE,'2026-06-09 20:12:06.248294+00','2026-06-09 20:12:06.248294+00'),
 ('db7012d5-eee1-4876-9907-0a826f8b7e1d','00000000-0000-0000-0000-000000000001','Reagentes',TRUE,TRUE,'2026-06-09 20:12:06.248294+00','2026-06-09 20:12:06.248294+00'),
 ('eb7012d5-eee1-4876-9907-0a826f8b7e1e','00000000-0000-0000-0000-000000000001','Salários',TRUE,TRUE,'2026-06-09 20:12:06.248294+00','2026-06-09 20:12:06.248294+00')
ON CONFLICT (tenant_id, nome) DO NOTHING;

-- Link existing select_options rows to the new legacy ids (by tenant + categoria + lower(label))
UPDATE public.select_options so
   SET legacy_id = src.id
  FROM public.financeiro_destinos_pagamento src
 WHERE so.categoria = 'financeiro_destino_pagamento'
   AND so.tenant_id = src.tenant_id
   AND lower(so.label) = lower(src.nome)
   AND (so.legacy_id IS NULL OR so.legacy_id <> src.id);

UPDATE public.select_options so
   SET legacy_id = src.id
  FROM public.financeiro_formas_pagamento src
 WHERE so.categoria = 'financeiro_forma_pagamento'
   AND so.tenant_id = src.tenant_id
   AND lower(so.label) = lower(src.nome)
   AND (so.legacy_id IS NULL OR so.legacy_id <> src.id);

UPDATE public.select_options so
   SET legacy_id = src.id
  FROM public.financeiro_tipos_despesa src
 WHERE so.categoria = 'financeiro_tipo_despesa'
   AND so.tenant_id = src.tenant_id
   AND lower(so.label) = lower(src.nome)
   AND (so.legacy_id IS NULL OR so.legacy_id <> src.id);

UPDATE public.select_options so
   SET legacy_id = src.id
  FROM public.motivos_cancelamento src
 WHERE so.categoria = 'motivo_cancelamento'
   AND so.tenant_id = src.tenant_id
   AND lower(so.label) = lower(src.nome)
   AND (so.legacy_id IS NULL OR so.legacy_id <> src.id);

-- Re-enable forwarding triggers
ALTER TABLE public.motivos_cancelamento ENABLE TRIGGER trg_fwd_motivos_cancelamento;
ALTER TABLE public.financeiro_formas_pagamento ENABLE TRIGGER trg_fwd_financeiro_formas_pagamento;
ALTER TABLE public.financeiro_destinos_pagamento ENABLE TRIGGER trg_fwd_financeiro_destinos_pagamento;
ALTER TABLE public.financeiro_tipos_despesa ENABLE TRIGGER trg_fwd_financeiro_tipos_despesa;
