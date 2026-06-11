-- RBAC por coluna em atendimento_exames.
-- Visibility is UX. Authorization is security.
-- A RLS atual deixa passar qualquer das 4 permissões (registrar_coleta, analisar_amostra,
-- liberar_resultado, editar_atendimento) para qualquer coluna. Este trigger fecha esse
-- vazamento: cada transição de estado / coluna sensível exige a permissão correspondente.
--
-- Bypass: super_admin (plataforma). Admin do tenant possui todas as 4 permissões via
-- has_permission(), portanto passa naturalmente.

CREATE OR REPLACE FUNCTION public.atendimento_exames_rbac_check()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Sem sessão autenticada' USING ERRCODE = '42501';
  END IF;

  IF is_super_admin(uid) THEN RETURN NEW; END IF;

  -- COLETA: data_coleta alterada OU status passando para 'coletado'
  IF (NEW.data_coleta IS DISTINCT FROM OLD.data_coleta)
     OR (NEW.status = 'coletado' AND OLD.status IS DISTINCT FROM 'coletado') THEN
    IF NOT has_permission(uid, 'registrar_coleta')
       AND NOT has_permission(uid, 'editar_atendimento') THEN
      RAISE EXCEPTION 'Sem permissão (registrar_coleta)' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- ANÁLISE: data_analise, resultados, status indo para 'em_analise'
  IF (NEW.data_analise IS DISTINCT FROM OLD.data_analise)
     OR (NEW.resultados IS DISTINCT FROM OLD.resultados)
     OR (NEW.status = 'em_analise' AND OLD.status IS DISTINCT FROM 'em_analise') THEN
    IF NOT has_permission(uid, 'analisar_amostra')
       AND NOT has_permission(uid, 'editar_atendimento') THEN
      RAISE EXCEPTION 'Sem permissão (analisar_amostra)' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- LIBERAÇÃO: data_liberacao alterada OU status passando para 'finalizado'.
  -- Nota: alterar apenas o campo `analista` (pré-atribuição via /mapa) NÃO é liberação;
  -- continua coberto pela RLS (editar_atendimento / analisar_amostra / liberar_resultado).
  IF (NEW.data_liberacao IS DISTINCT FROM OLD.data_liberacao)
     OR (NEW.status = 'finalizado' AND OLD.status IS DISTINCT FROM 'finalizado') THEN
    IF NOT has_permission(uid, 'liberar_resultado')
       AND NOT has_permission(uid, 'editar_atendimento') THEN
      RAISE EXCEPTION 'Sem permissão (liberar_resultado)' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- CANCELAMENTO de exame individual
  IF NEW.status = 'cancelado' AND OLD.status IS DISTINCT FROM 'cancelado' THEN
    IF NOT has_permission(uid, 'cancelar_atendimento')
       AND NOT has_permission(uid, 'editar_atendimento') THEN
      RAISE EXCEPTION 'Sem permissão (cancelar_atendimento)' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS atendimento_exames_rbac_check_trg ON public.atendimento_exames;
CREATE TRIGGER atendimento_exames_rbac_check_trg
  BEFORE UPDATE ON public.atendimento_exames
  FOR EACH ROW
  EXECUTE FUNCTION public.atendimento_exames_rbac_check();