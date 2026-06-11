CREATE OR REPLACE FUNCTION public.seed_tenant_default_lists(p_tenant uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_id integer;
  v_lab_nome text;
  v_unid_id text;
BEGIN
  -- Convênio Particular --------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM public.convenios WHERE tenant_id=p_tenant AND lower(nome)='particular') THEN
    IF NOT EXISTS (SELECT 1 FROM public.convenios WHERE id = 0) THEN
      v_next_id := 0;
    ELSE
      SELECT COALESCE(MAX(id),0)+1 INTO v_next_id FROM public.convenios;
    END IF;
    INSERT INTO public.convenios(id,tenant_id,nome,registro_ans,tipo,tabela,dias_retorno,ativo,libera_fluxo_sem_pagamento,prazo_faturamento_dias)
    VALUES (v_next_id,p_tenant,'Particular','','Saúde','Própria',0,true,false,30);
  END IF;

  -- Unidade Sede padrão --------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM public.unidades WHERE tenant_id=p_tenant) THEN
    SELECT nome INTO v_lab_nome FROM public.tenants WHERE id=p_tenant;
    v_unid_id := 'und-' || substr(p_tenant::text,1,6);
    -- garante unicidade do id global
    IF EXISTS (SELECT 1 FROM public.unidades WHERE id=v_unid_id) THEN
      v_unid_id := v_unid_id || '-' || substr(md5(random()::text),1,4);
    END IF;
    INSERT INTO public.unidades(id,nome,tipo,padrao,ativo,tenant_id)
    VALUES (v_unid_id, COALESCE(v_lab_nome,'Laboratório') || ' - Sede', 'SEDE', true, true, p_tenant);
  END IF;

  -- Modelos de impressão padrão (3 comprovantes) ------------------------------
  INSERT INTO public.documento_templates(tenant_id,tipo,nome,descricao,conteudo,placeholders_usados,config,ativo,padrao,criado_por)
  SELECT p_tenant,'comprovante_pagamento','Recibo de Pagamento (padrão do sistema)',
    'Modelo padrão usado automaticamente quando nenhum customizado é definido.',
    '', '[]'::jsonb, '{}'::jsonb, true, false, 'sistema'
  WHERE NOT EXISTS (SELECT 1 FROM public.documento_templates WHERE tenant_id=p_tenant AND tipo='comprovante_pagamento');

  INSERT INTO public.documento_templates(tenant_id,tipo,nome,descricao,conteudo,placeholders_usados,config,ativo,padrao,criado_por)
  SELECT p_tenant,'comprovante_atendimento','Comprovante de Atendimento (padrão do sistema)',
    'Modelo padrão usado automaticamente quando nenhum customizado é definido.',
    '', '[]'::jsonb, '{}'::jsonb, true, false, 'sistema'
  WHERE NOT EXISTS (SELECT 1 FROM public.documento_templates WHERE tenant_id=p_tenant AND tipo='comprovante_atendimento');

  INSERT INTO public.documento_templates(tenant_id,tipo,nome,descricao,conteudo,placeholders_usados,config,ativo,padrao,criado_por)
  SELECT p_tenant,'declaracao_comparecimento','Declaração de Comparecimento (padrão do sistema)',
    'Modelo padrão usado automaticamente quando nenhum customizado é definido.',
    '', '[]'::jsonb, '{}'::jsonb, true, false, 'sistema'
  WHERE NOT EXISTS (SELECT 1 FROM public.documento_templates WHERE tenant_id=p_tenant AND tipo='declaracao_comparecimento');

  -- Listas padrão (motivos + financeiro) --------------------------------------
  INSERT INTO public.motivos_cancelamento (tenant_id, nome, sistema, ordem) VALUES
    (p_tenant,'Paciente desistiu do atendimento',true,1),
    (p_tenant,'Paciente não compareceu',true,2),
    (p_tenant,'Cadastro incorreto do paciente',true,3),
    (p_tenant,'Cadastro incorreto do exame',true,4),
    (p_tenant,'Convênio não autorizado',true,5),
    (p_tenant,'Atendimento em duplicidade',true,6),
    (p_tenant,'Solicitação médica inválida ou ilegível',true,7),
    (p_tenant,'Outro (descrever)',true,99)
  ON CONFLICT (tenant_id, nome) DO NOTHING;

  INSERT INTO public.recoletas_motivos (tenant_id, nome, sistema, ordem) VALUES
    (p_tenant,'Amostra hemolisada',true,1),(p_tenant,'Amostra lipêmica',true,2),
    (p_tenant,'Amostra ictérica',true,3),(p_tenant,'Amostra coagulada',true,4),
    (p_tenant,'Amostra contaminada',true,5),(p_tenant,'Amostra insuficiente (quantidade)',true,6),
    (p_tenant,'Amostra inadequada (qualidade geral)',true,7),(p_tenant,'Centrifugação inadequada',true,8),
    (p_tenant,'Anticoagulante incorreto',true,9),(p_tenant,'Coletor ou tubo incorreto para o exame',true,10),
    (p_tenant,'Técnica de coleta inadequada',true,11),(p_tenant,'Acondicionamento ou transporte inadequado',true,12),
    (p_tenant,'Prazo de estabilidade da amostra vencido',true,13),(p_tenant,'Jejum ou preparo do paciente inadequado',true,14),
    (p_tenant,'Amostra identificada incorretamente',true,15),(p_tenant,'Troca de material entre pacientes',true,16),
    (p_tenant,'Exame cadastrado incorretamente',true,17),(p_tenant,'Dados do paciente divergentes',true,18),
    (p_tenant,'Amostra extraviada',true,19),(p_tenant,'Amostra rejeitada por laboratório de apoio',true,20),
    (p_tenant,'Falha técnica ou de equipamento',true,21),(p_tenant,'Repetição para confirmação de resultado alterado',true,22),
    (p_tenant,'Outro (descrever)',true,99)
  ON CONFLICT (tenant_id, nome) DO NOTHING;

  INSERT INTO public.financeiro_tipos_despesa (tenant_id, nome, sistema) VALUES
    (p_tenant,'Água',true),(p_tenant,'Aluguel',true),(p_tenant,'Combustível',true),
    (p_tenant,'Encargos sociais',true),(p_tenant,'Energia elétrica',true),(p_tenant,'Impostos',true),
    (p_tenant,'Internet/Telefone',true),(p_tenant,'Manutenção de equipamentos',true),(p_tenant,'Marketing',true),
    (p_tenant,'Material de escritório',true),(p_tenant,'Material de limpeza',true),(p_tenant,'Material laboratorial',true),
    (p_tenant,'Outros',true),(p_tenant,'Reagentes',true),(p_tenant,'Salários',true)
  ON CONFLICT (tenant_id, nome) DO NOTHING;

  INSERT INTO public.financeiro_destinos_pagamento (tenant_id, nome, sistema) VALUES
    (p_tenant,'Banco',true),(p_tenant,'Concessionária',true),(p_tenant,'Fornecedor',true),
    (p_tenant,'Funcionário',true),(p_tenant,'Governo',true),(p_tenant,'Outros',true),
    (p_tenant,'Prestador de serviço',true)
  ON CONFLICT (tenant_id, nome) DO NOTHING;

  INSERT INTO public.financeiro_formas_pagamento (tenant_id, nome, sistema) VALUES
    (p_tenant,'Dinheiro',true),(p_tenant,'PIX',true),(p_tenant,'Cartão de Débito',true),
    (p_tenant,'Cartão de Crédito',true),(p_tenant,'Transferência bancária',true),(p_tenant,'Boleto',true)
  ON CONFLICT (tenant_id, nome) DO NOTHING;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.seed_tenant_default_lists(uuid) FROM anon, authenticated;

-- Backfill todos os tenants existentes
DO $$
DECLARE t_id uuid;
BEGIN
  FOR t_id IN SELECT id FROM public.tenants LOOP
    PERFORM public.seed_tenant_default_lists(t_id);
  END LOOP;
END $$;