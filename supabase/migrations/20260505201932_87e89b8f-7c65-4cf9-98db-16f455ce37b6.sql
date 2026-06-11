CREATE OR REPLACE FUNCTION public.solicitacao_publica_validate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
  v_phone text;
  v_items_count int;
BEGIN
  IF length(coalesce(NEW.nome, '')) < 2 OR length(NEW.nome) > 120 THEN
    RAISE EXCEPTION 'nome inválido';
  END IF;

  v_phone := regexp_replace(coalesce(NEW.telefone, ''), '\D', '', 'g');
  IF length(v_phone) < 10 OR length(v_phone) > 15 THEN
    RAISE EXCEPTION 'telefone inválido';
  END IF;
  NEW.telefone := v_phone;

  IF NEW.cpf IS NOT NULL AND length(regexp_replace(NEW.cpf, '\D', '', 'g')) NOT IN (0, 11) THEN
    RAISE EXCEPTION 'cpf inválido';
  END IF;

  IF jsonb_typeof(NEW.exames) <> 'array' THEN
    RAISE EXCEPTION 'exames deve ser uma lista';
  END IF;
  v_items_count := jsonb_array_length(NEW.exames);
  IF v_items_count < 1 OR v_items_count > 30 THEN
    RAISE EXCEPTION 'quantidade de exames fora do limite (1 a 30)';
  END IF;

  IF length(coalesce(NEW.observacao, '')) > 1000 THEN
    RAISE EXCEPTION 'observação muito longa';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.solicitacoes_publicas
  WHERE tenant_id = NEW.tenant_id
    AND telefone = NEW.telefone
    AND created_at > now() - interval '60 seconds';
  IF v_count > 0 THEN
    RAISE EXCEPTION 'aguarde antes de enviar novamente';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_settings_public
    WHERE tenant_id = NEW.tenant_id AND permitir_reserva = true
  ) THEN
    RAISE EXCEPTION 'tenant não aceita reservas públicas';
  END IF;

  IF NEW.status IS NULL OR NEW.status NOT IN ('NOVO','EM_CONTATO','CONVERTIDO','DESCARTADO') THEN
    NEW.status := 'NOVO';
  END IF;
  NEW.origem := COALESCE(NEW.origem, 'landing');
  NEW.created_at := now();
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;