
-- Tabela de motivos de cancelamento (multi-tenant, com proteção de itens "sistema")
CREATE TABLE public.motivos_cancelamento (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  sistema boolean NOT NULL DEFAULT false,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, nome)
);

CREATE INDEX idx_motivos_cancelamento_tenant ON public.motivos_cancelamento(tenant_id);

-- RLS
ALTER TABLE public.motivos_cancelamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY motcanc_select ON public.motivos_cancelamento
  FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()) OR (tenant_id = current_tenant_id()));

CREATE POLICY motcanc_insert ON public.motivos_cancelamento
  FOR INSERT TO authenticated
  WITH CHECK ((tenant_id = current_tenant_id()) AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY motcanc_update ON public.motivos_cancelamento
  FOR UPDATE TO authenticated
  USING ((tenant_id = current_tenant_id()) AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK ((tenant_id = current_tenant_id()) AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY motcanc_delete ON public.motivos_cancelamento
  FOR DELETE TO authenticated
  USING ((tenant_id = current_tenant_id()) AND has_role(auth.uid(), 'admin'::app_role) AND sistema = false);

-- Trigger updated_at
CREATE TRIGGER touch_motivos_cancelamento_updated_at
  BEFORE UPDATE ON public.motivos_cancelamento
  FOR EACH ROW EXECUTE FUNCTION public.touch_financeiro_listas_updated_at();

-- Trigger de proteção de itens do sistema (não pode renomear nem excluir)
CREATE TRIGGER protect_motivos_cancelamento_sistema
  BEFORE UPDATE OR DELETE ON public.motivos_cancelamento
  FOR EACH ROW EXECUTE FUNCTION public.protect_financeiro_listas_sistema();

-- Seed: motivos padrão para todos os tenants existentes
INSERT INTO public.motivos_cancelamento (tenant_id, nome, sistema, ordem)
SELECT t.id, m.nome, true, m.ordem
FROM public.tenants t
CROSS JOIN (VALUES
  ('Paciente desistiu', 1),
  ('Cadastro errado', 2),
  ('Erro no atendimento', 3),
  ('Outro', 4)
) AS m(nome, ordem)
ON CONFLICT (tenant_id, nome) DO NOTHING;
