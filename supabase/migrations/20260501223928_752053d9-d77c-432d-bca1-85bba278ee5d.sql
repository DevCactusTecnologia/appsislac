-- Wipe completo dos motivos antigos de recoleta + re-seed da lista global padronizada
-- Não há recoletas históricas referenciando motivo_id (verificado), portanto seguro.

-- 1. Dropar o trigger de proteção temporariamente
DROP TRIGGER IF EXISTS trg_protect_recoletas_motivos_sistema ON public.recoletas_motivos;

-- 2. Apagar TODOS os motivos de recoleta (de todos os tenants)
DELETE FROM public.recoletas_motivos;

-- 3. Re-seedar a lista global para todos os tenants existentes
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN SELECT id FROM public.tenants LOOP
    PERFORM public.seed_default_recoletas_motivos_for_tenant(t.id);
  END LOOP;
END $$;

-- 4. Recriar o trigger de proteção (impede usuários de apagar/editar motivos do sistema)
CREATE TRIGGER trg_protect_recoletas_motivos_sistema
BEFORE UPDATE OR DELETE ON public.recoletas_motivos
FOR EACH ROW
EXECUTE FUNCTION public.protect_recoletas_motivos_sistema();