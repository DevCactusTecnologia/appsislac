-- Função que bloqueia mudanças em exames quando o atendimento está finalizado/cancelado
CREATE OR REPLACE FUNCTION public.guard_exames_when_atendimento_finalizado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_at_id BIGINT;
  v_status TEXT;
BEGIN
  -- Identifica o atendimento afetado conforme a operação
  IF TG_OP = 'DELETE' THEN
    v_at_id := OLD.atendimento_id;
  ELSE
    v_at_id := NEW.atendimento_id;
  END IF;

  SELECT status_atendimento INTO v_status
  FROM public.atendimentos
  WHERE id = v_at_id;

  -- Se atendimento não existe (caso raro: criação inicial) deixa passar
  IF v_status IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  -- Admin do tenant pode contornar (reservado para reabertura controlada futura)
  IF public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()) THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  -- Bloqueio: não permitir alterações clínicas em atendimentos finalizados/cancelados
  IF v_status IN ('Resultado Liberado', 'Cancelado') THEN
    RAISE EXCEPTION
      'Atendimento % — alterações em exames/resultados estão bloqueadas. Status atual: %. Crie um novo atendimento ou solicite reabertura ao administrador.',
      v_at_id, v_status
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- Recria o trigger garantindo idempotência
DROP TRIGGER IF EXISTS trg_guard_exames_finalizado ON public.atendimento_exames;

CREATE TRIGGER trg_guard_exames_finalizado
BEFORE INSERT OR UPDATE OR DELETE ON public.atendimento_exames
FOR EACH ROW
EXECUTE FUNCTION public.guard_exames_when_atendimento_finalizado();