CREATE OR REPLACE FUNCTION public.atendimento_exames_rbac_check()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  -- Super admin bypass
  IF public.is_super_admin() THEN
    RETURN NEW;
  END IF;

  -- registrar_coleta: data_coleta or status -> coletado
  IF (NEW.data_coleta IS DISTINCT FROM OLD.data_coleta)
     OR (NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'coletado') THEN
    IF NOT public.has_permission(uid, 'registrar_coleta') THEN
      RAISE EXCEPTION 'RBAC: missing permission registrar_coleta'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- analisar_amostra: data_analise, resultados, or status -> em_analise
  IF (NEW.data_analise IS DISTINCT FROM OLD.data_analise)
     OR (NEW.resultados IS DISTINCT FROM OLD.resultados)
     OR (NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'em_analise') THEN
    IF NOT public.has_permission(uid, 'analisar_amostra') THEN
      RAISE EXCEPTION 'RBAC: missing permission analisar_amostra'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- liberar_resultado: data_liberacao or status -> finalizado
  IF (NEW.data_liberacao IS DISTINCT FROM OLD.data_liberacao)
     OR (NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'finalizado') THEN
    IF NOT public.has_permission(uid, 'liberar_resultado') THEN
      RAISE EXCEPTION 'RBAC: missing permission liberar_resultado'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- cancelar_atendimento: status -> cancelado
  IF (NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'cancelado') THEN
    IF NOT public.has_permission(uid, 'cancelar_atendimento') THEN
      RAISE EXCEPTION 'RBAC: missing permission cancelar_atendimento'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;