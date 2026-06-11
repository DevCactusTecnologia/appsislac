
-- =========================================================
-- 1) FUNÇÕES DE SEED ATUALIZADAS
-- =========================================================
CREATE OR REPLACE FUNCTION public.seed_default_motivos_cancelamento_for_tenant(_tenant_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _count integer := 0;
BEGIN
  INSERT INTO public.motivos_cancelamento (tenant_id, nome, sistema, ativo, ordem)
  VALUES
    (_tenant_id, 'Paciente desistiu do atendimento',           true, true, 1),
    (_tenant_id, 'Paciente não compareceu',                    true, true, 2),
    (_tenant_id, 'Cadastro incorreto do paciente',             true, true, 3),
    (_tenant_id, 'Cadastro incorreto do exame',                true, true, 4),
    (_tenant_id, 'Convênio não autorizado',                    true, true, 5),
    (_tenant_id, 'Atendimento em duplicidade',                 true, true, 6),
    (_tenant_id, 'Solicitação médica inválida ou ilegível',    true, true, 7),
    (_tenant_id, 'Outro (descrever)',                          true, true, 99)
  ON CONFLICT (tenant_id, nome) DO UPDATE
    SET sistema = true, ativo = true, ordem = EXCLUDED.ordem;
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;

CREATE OR REPLACE FUNCTION public.seed_default_recoletas_motivos_for_tenant(_tenant_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _count integer := 0;
BEGIN
  INSERT INTO public.recoletas_motivos (tenant_id, nome, sistema, ativo, ordem)
  VALUES
    (_tenant_id, 'Amostra hemolisada',                              true, true, 1),
    (_tenant_id, 'Amostra lipêmica',                                true, true, 2),
    (_tenant_id, 'Amostra ictérica',                                true, true, 3),
    (_tenant_id, 'Amostra coagulada',                               true, true, 4),
    (_tenant_id, 'Amostra contaminada',                             true, true, 5),
    (_tenant_id, 'Amostra insuficiente (quantidade)',               true, true, 6),
    (_tenant_id, 'Amostra inadequada (qualidade geral)',            true, true, 7),
    (_tenant_id, 'Centrifugação inadequada',                        true, true, 8),
    (_tenant_id, 'Anticoagulante incorreto',                        true, true, 9),
    (_tenant_id, 'Coletor ou tubo incorreto para o exame',          true, true, 10),
    (_tenant_id, 'Técnica de coleta inadequada',                    true, true, 11),
    (_tenant_id, 'Acondicionamento ou transporte inadequado',       true, true, 12),
    (_tenant_id, 'Prazo de estabilidade da amostra vencido',        true, true, 13),
    (_tenant_id, 'Jejum ou preparo do paciente inadequado',         true, true, 14),
    (_tenant_id, 'Amostra identificada incorretamente',             true, true, 15),
    (_tenant_id, 'Troca de material entre pacientes',               true, true, 16),
    (_tenant_id, 'Exame cadastrado incorretamente',                 true, true, 17),
    (_tenant_id, 'Dados do paciente divergentes',                   true, true, 18),
    (_tenant_id, 'Amostra extraviada',                              true, true, 19),
    (_tenant_id, 'Amostra rejeitada por laboratório de apoio',      true, true, 20),
    (_tenant_id, 'Falha técnica ou de equipamento',                 true, true, 21),
    (_tenant_id, 'Repetição para confirmação de resultado alterado',true, true, 22),
    (_tenant_id, 'Outro (descrever)',                               true, true, 99)
  ON CONFLICT (tenant_id, lower(nome)) DO UPDATE
    SET sistema = true, ativo = true, ordem = EXCLUDED.ordem;
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;

-- =========================================================
-- 2) DESABILITAR TRIGGERS DE PROTEÇÃO TEMPORARIAMENTE
-- =========================================================
ALTER TABLE public.motivos_cancelamento DISABLE TRIGGER protect_motivos_cancelamento_sistema;
ALTER TABLE public.recoletas_motivos    DISABLE TRIGGER trg_protect_recoletas_motivos_sistema;

-- 3) Limpar motivos sistema antigos que não estão na nova lista
DELETE FROM public.motivos_cancelamento
WHERE sistema = true
  AND nome NOT IN (
    'Paciente desistiu do atendimento',
    'Paciente não compareceu',
    'Cadastro incorreto do paciente',
    'Cadastro incorreto do exame',
    'Convênio não autorizado',
    'Atendimento em duplicidade',
    'Solicitação médica inválida ou ilegível',
    'Outro (descrever)'
  );

DELETE FROM public.recoletas_motivos
WHERE sistema = true
  AND lower(nome) NOT IN (
    lower('Amostra hemolisada'), lower('Amostra lipêmica'), lower('Amostra ictérica'),
    lower('Amostra coagulada'), lower('Amostra contaminada'),
    lower('Amostra insuficiente (quantidade)'), lower('Amostra inadequada (qualidade geral)'),
    lower('Centrifugação inadequada'), lower('Anticoagulante incorreto'),
    lower('Coletor ou tubo incorreto para o exame'), lower('Técnica de coleta inadequada'),
    lower('Acondicionamento ou transporte inadequado'),
    lower('Prazo de estabilidade da amostra vencido'),
    lower('Jejum ou preparo do paciente inadequado'),
    lower('Amostra identificada incorretamente'), lower('Troca de material entre pacientes'),
    lower('Exame cadastrado incorretamente'), lower('Dados do paciente divergentes'),
    lower('Amostra extraviada'), lower('Amostra rejeitada por laboratório de apoio'),
    lower('Falha técnica ou de equipamento'),
    lower('Repetição para confirmação de resultado alterado'),
    lower('Outro (descrever)')
  );

-- 4) Marcar motivos custom (não-sistema) antigos como inativos (preserva histórico)
UPDATE public.motivos_cancelamento SET ativo = false WHERE sistema = false;
UPDATE public.recoletas_motivos    SET ativo = false WHERE sistema = false;

-- 5) Aplicar nova lista em todos os tenants
DO $$
DECLARE v_tenant uuid;
BEGIN
  FOR v_tenant IN SELECT id FROM public.tenants LOOP
    PERFORM public.seed_default_motivos_cancelamento_for_tenant(v_tenant);
    PERFORM public.seed_default_recoletas_motivos_for_tenant(v_tenant);
  END LOOP;
END $$;

-- 6) Reabilitar triggers de proteção
ALTER TABLE public.motivos_cancelamento ENABLE TRIGGER protect_motivos_cancelamento_sistema;
ALTER TABLE public.recoletas_motivos    ENABLE TRIGGER trg_protect_recoletas_motivos_sistema;

-- =========================================================
-- 7) ENDURECER RLS — apenas super_admin pode alterar
-- =========================================================
DROP POLICY IF EXISTS motcanc_insert ON public.motivos_cancelamento;
DROP POLICY IF EXISTS motcanc_update ON public.motivos_cancelamento;
DROP POLICY IF EXISTS motcanc_delete ON public.motivos_cancelamento;

CREATE POLICY motcanc_insert ON public.motivos_cancelamento
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin(auth.uid()));
CREATE POLICY motcanc_update ON public.motivos_cancelamento
  FOR UPDATE TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));
CREATE POLICY motcanc_delete ON public.motivos_cancelamento
  FOR DELETE TO authenticated
  USING (is_super_admin(auth.uid()));

DROP POLICY IF EXISTS rcm_insert ON public.recoletas_motivos;
DROP POLICY IF EXISTS rcm_update ON public.recoletas_motivos;
DROP POLICY IF EXISTS rcm_delete ON public.recoletas_motivos;

CREATE POLICY rcm_insert ON public.recoletas_motivos
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin(auth.uid()));
CREATE POLICY rcm_update ON public.recoletas_motivos
  FOR UPDATE TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));
CREATE POLICY rcm_delete ON public.recoletas_motivos
  FOR DELETE TO authenticated
  USING (is_super_admin(auth.uid()));

-- =========================================================
-- 8) TRIGGER em tenants para semear listas em novos tenants
-- =========================================================
CREATE OR REPLACE FUNCTION public.seed_default_listas_globais_on_tenant_create()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.seed_default_motivos_cancelamento_for_tenant(NEW.id);
  PERFORM public.seed_default_recoletas_motivos_for_tenant(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_listas_globais_after_tenant_insert ON public.tenants;
CREATE TRIGGER trg_seed_listas_globais_after_tenant_insert
  AFTER INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_default_listas_globais_on_tenant_create();
