
CREATE OR REPLACE FUNCTION public.aplicar_expurgo_amostra()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'EXECUTADO' AND (OLD.status IS DISTINCT FROM 'EXECUTADO') THEN
    UPDATE public.amostras
      SET status = 'DESCARTADA',
          localizacao = ''
      WHERE id = NEW.amostra_id;

    UPDATE public.amostra_alocacoes
      SET retirada_em = COALESCE(retirada_em, now()),
          motivo_retirada = COALESCE(motivo_retirada, 'EXPURGO')
      WHERE amostra_id = NEW.amostra_id AND retirada_em IS NULL;

    UPDATE public.expurgo_lotes
      SET total_executados = total_executados + 1
      WHERE id = NEW.lote_id;
  END IF;

  IF NEW.status = 'PULADO' AND (OLD.status IS DISTINCT FROM 'PULADO') THEN
    UPDATE public.expurgo_lotes
      SET total_pulados = total_pulados + 1
      WHERE id = NEW.lote_id;
  END IF;

  RETURN NEW;
END;
$$;
