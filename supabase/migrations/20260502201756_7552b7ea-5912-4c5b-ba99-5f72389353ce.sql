-- Garantir UNIQUE para suportar ON CONFLICT no seed
ALTER TABLE public.recoletas_motivos
  ADD CONSTRAINT recoletas_motivos_tenant_id_nome_key UNIQUE (tenant_id, nome);

-- =============================================================================
-- Função idempotente de seed
-- =============================================================================
CREATE OR REPLACE FUNCTION public.seed_tenant_default_lists(p_tenant uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Motivos de Cancelamento (atendimento) ------------------------------------
  INSERT INTO public.motivos_cancelamento (tenant_id, nome, sistema, ordem) VALUES
    (p_tenant, 'Paciente desistiu do atendimento',     true, 1),
    (p_tenant, 'Paciente não compareceu',              true, 2),
    (p_tenant, 'Cadastro incorreto do paciente',       true, 3),
    (p_tenant, 'Cadastro incorreto do exame',          true, 4),
    (p_tenant, 'Convênio não autorizado',              true, 5),
    (p_tenant, 'Atendimento em duplicidade',           true, 6),
    (p_tenant, 'Solicitação médica inválida ou ilegível', true, 7),
    (p_tenant, 'Outro (descrever)',                    true, 99)
  ON CONFLICT (tenant_id, nome) DO NOTHING;

  -- Motivos de Recoleta ------------------------------------------------------
  INSERT INTO public.recoletas_motivos (tenant_id, nome, sistema, ordem) VALUES
    (p_tenant, 'Amostra hemolisada',                                  true, 1),
    (p_tenant, 'Amostra lipêmica',                                    true, 2),
    (p_tenant, 'Amostra ictérica',                                    true, 3),
    (p_tenant, 'Amostra coagulada',                                   true, 4),
    (p_tenant, 'Amostra contaminada',                                 true, 5),
    (p_tenant, 'Amostra insuficiente (quantidade)',                   true, 6),
    (p_tenant, 'Amostra inadequada (qualidade geral)',                true, 7),
    (p_tenant, 'Centrifugação inadequada',                            true, 8),
    (p_tenant, 'Anticoagulante incorreto',                            true, 9),
    (p_tenant, 'Coletor ou tubo incorreto para o exame',              true, 10),
    (p_tenant, 'Técnica de coleta inadequada',                        true, 11),
    (p_tenant, 'Acondicionamento ou transporte inadequado',           true, 12),
    (p_tenant, 'Prazo de estabilidade da amostra vencido',            true, 13),
    (p_tenant, 'Jejum ou preparo do paciente inadequado',             true, 14),
    (p_tenant, 'Amostra identificada incorretamente',                 true, 15),
    (p_tenant, 'Troca de material entre pacientes',                   true, 16),
    (p_tenant, 'Exame cadastrado incorretamente',                     true, 17),
    (p_tenant, 'Dados do paciente divergentes',                       true, 18),
    (p_tenant, 'Amostra extraviada',                                  true, 19),
    (p_tenant, 'Amostra rejeitada por laboratório de apoio',          true, 20),
    (p_tenant, 'Falha técnica ou de equipamento',                     true, 21),
    (p_tenant, 'Repetição para confirmação de resultado alterado',    true, 22),
    (p_tenant, 'Outro (descrever)',                                   true, 99)
  ON CONFLICT (tenant_id, nome) DO NOTHING;

  -- Financeiro: Tipos de Despesa --------------------------------------------
  INSERT INTO public.financeiro_tipos_despesa (tenant_id, nome, sistema) VALUES
    (p_tenant, 'Água', true),
    (p_tenant, 'Aluguel', true),
    (p_tenant, 'Combustível', true),
    (p_tenant, 'Encargos sociais', true),
    (p_tenant, 'Energia elétrica', true),
    (p_tenant, 'Impostos', true),
    (p_tenant, 'Internet/Telefone', true),
    (p_tenant, 'Manutenção de equipamentos', true),
    (p_tenant, 'Marketing', true),
    (p_tenant, 'Material de escritório', true),
    (p_tenant, 'Material de limpeza', true),
    (p_tenant, 'Material laboratorial', true),
    (p_tenant, 'Outros', true),
    (p_tenant, 'Reagentes', true),
    (p_tenant, 'Salários', true)
  ON CONFLICT (tenant_id, nome) DO NOTHING;

  -- Financeiro: Destinos de Pagamento ---------------------------------------
  INSERT INTO public.financeiro_destinos_pagamento (tenant_id, nome, sistema) VALUES
    (p_tenant, 'Banco', true),
    (p_tenant, 'Concessionária', true),
    (p_tenant, 'Fornecedor', true),
    (p_tenant, 'Funcionário', true),
    (p_tenant, 'Governo', true),
    (p_tenant, 'Outros', true),
    (p_tenant, 'Prestador de serviço', true)
  ON CONFLICT (tenant_id, nome) DO NOTHING;

  -- Financeiro: Formas de Pagamento -----------------------------------------
  INSERT INTO public.financeiro_formas_pagamento (tenant_id, nome, sistema, ordem) VALUES
    (p_tenant, 'Dinheiro',           true, 1),
    (p_tenant, 'PIX',                true, 2),
    (p_tenant, 'Cartão de Débito',   true, 3),
    (p_tenant, 'Cartão de Crédito',  true, 4),
    (p_tenant, 'Boleto',             true, 5),
    (p_tenant, 'Transferência',      true, 6)
  ON CONFLICT (tenant_id, nome) DO NOTHING;
END;
$$;

-- =============================================================================
-- Trigger AFTER INSERT em tenants
-- =============================================================================
CREATE OR REPLACE FUNCTION public.trigger_seed_tenant_default_lists()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_tenant_default_lists(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_tenant_default_lists ON public.tenants;
CREATE TRIGGER trg_seed_tenant_default_lists
  AFTER INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_seed_tenant_default_lists();

-- =============================================================================
-- Backfill — todos os tenants atuais
-- =============================================================================
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT id FROM public.tenants LOOP
    PERFORM public.seed_tenant_default_lists(t.id);
  END LOOP;
END $$;