-- 1) Add new columns to atendimento_audit
ALTER TABLE public.atendimento_audit
  ADD COLUMN IF NOT EXISTS justificativa text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS pos_finalizacao boolean NOT NULL DEFAULT false;

-- 2) Helper RPC: set session-local justificativa GUC. Frontend calls this
--    BEFORE any sensitive INSERT/UPDATE/DELETE so triggers can capture it.
CREATE OR REPLACE FUNCTION public.set_audit_justificativa(_text text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- 'true' = is_local: cleared at end of transaction/session
  PERFORM set_config('app.audit_justificativa', COALESCE(_text, ''), true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_audit_justificativa(text) TO authenticated;

-- 3) Helper to read GUC safely
CREATE OR REPLACE FUNCTION public._get_audit_justificativa()
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE v text;
BEGIN
  BEGIN
    v := current_setting('app.audit_justificativa', true);
  EXCEPTION WHEN OTHERS THEN
    v := '';
  END;
  RETURN COALESCE(v, '');
END;
$$;

-- 4) Helper: detect "post-finalização" context for an atendimento by id.
--    Returns true if the related atendimento is currently 'Resultado Liberado'
--    or 'Cancelado' / 'Pedido cancelado'.
CREATE OR REPLACE FUNCTION public._is_post_finalizacao(_at_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.atendimentos
    WHERE id = _at_id
      AND lower(status_atendimento) IN ('resultado liberado','cancelado','pedido cancelado')
  );
$$;

-- 5) Replace audit triggers to capture justificativa + pos_finalizacao

CREATE OR REPLACE FUNCTION public.audit_atendimentos()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_acao TEXT;
  v_email TEXT := public.current_user_email();
  v_just  TEXT := public._get_audit_justificativa();
  v_post  BOOLEAN;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_acao := 'Pedido realizado';
    v_post := false; -- novo registro nunca é pós-finalização
    INSERT INTO public.atendimento_audit(entidade, operacao, acao, atendimento_id, registro_id, protocolo, paciente_nome, new_value, changed_by, changed_by_email, justificativa, pos_finalizacao)
    VALUES ('atendimento','INSERT', v_acao, NEW.id, NEW.id, NEW.protocolo, NEW.paciente_nome, to_jsonb(NEW), auth.uid(), v_email, v_just, v_post);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status_atendimento IS DISTINCT FROM OLD.status_atendimento THEN
      v_acao := 'Status alterado: ' || OLD.status_atendimento || ' → ' || NEW.status_atendimento;
    ELSIF NEW.status_pagamento IS DISTINCT FROM OLD.status_pagamento THEN
      v_acao := 'Pagamento: ' || OLD.status_pagamento || ' → ' || NEW.status_pagamento;
    ELSIF NEW.motivo_cancelamento IS DISTINCT FROM OLD.motivo_cancelamento AND NEW.motivo_cancelamento IS NOT NULL THEN
      v_acao := 'Atendimento cancelado: ' || NEW.motivo_cancelamento;
    ELSE
      v_acao := 'Atendimento atualizado';
    END IF;
    -- pós-finalização baseado no estado ANTERIOR (antes desta alteração)
    v_post := lower(COALESCE(OLD.status_atendimento,'')) IN ('resultado liberado','cancelado','pedido cancelado');
    INSERT INTO public.atendimento_audit(entidade, operacao, acao, atendimento_id, registro_id, protocolo, paciente_nome, old_value, new_value, changed_by, changed_by_email, justificativa, pos_finalizacao)
    VALUES ('atendimento','UPDATE', v_acao, NEW.id, NEW.id, NEW.protocolo, NEW.paciente_nome, to_jsonb(OLD), to_jsonb(NEW), auth.uid(), v_email, v_just, v_post);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    v_post := lower(COALESCE(OLD.status_atendimento,'')) IN ('resultado liberado','cancelado','pedido cancelado');
    INSERT INTO public.atendimento_audit(entidade, operacao, acao, atendimento_id, registro_id, protocolo, paciente_nome, old_value, changed_by, changed_by_email, justificativa, pos_finalizacao)
    VALUES ('atendimento','DELETE', 'Atendimento removido', OLD.id, OLD.id, OLD.protocolo, OLD.paciente_nome, to_jsonb(OLD), auth.uid(), v_email, v_just, v_post);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.audit_atendimento_exames()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_acao TEXT;
  v_email TEXT := public.current_user_email();
  v_just  TEXT := public._get_audit_justificativa();
  v_protocolo TEXT := '';
  v_paciente TEXT := '';
  v_at_id BIGINT;
  v_post BOOLEAN;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_at_id := OLD.atendimento_id;
  ELSE
    v_at_id := NEW.atendimento_id;
  END IF;

  SELECT protocolo, paciente_nome INTO v_protocolo, v_paciente
    FROM public.atendimentos WHERE id = v_at_id LIMIT 1;

  v_post := public._is_post_finalizacao(v_at_id);

  IF TG_OP = 'INSERT' THEN
    v_acao := 'Exame adicionado';
    INSERT INTO public.atendimento_audit(entidade, operacao, acao, atendimento_id, registro_id, protocolo, paciente_nome, exame_nome, new_value, changed_by, changed_by_email, justificativa, pos_finalizacao)
    VALUES ('exame','INSERT', v_acao, NEW.atendimento_id, NEW.id, COALESCE(v_protocolo,''), COALESCE(v_paciente,''), NEW.nome_exame, to_jsonb(NEW), auth.uid(), v_email, v_just, v_post);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      v_acao := CASE NEW.status
        WHEN 'coletado' THEN 'Amostra coletada'
        WHEN 'em_analise' THEN 'Em análise'
        WHEN 'finalizado' THEN 'Resultado liberado'
        WHEN 'cancelado' THEN COALESCE('Análise cancelada: ' || NEW.motivo_cancelamento, 'Análise cancelada')
        WHEN 'pendente' THEN 'Status revertido para pendente'
        ELSE 'Status alterado: ' || OLD.status || ' → ' || NEW.status
      END;
    ELSIF NEW.resultados IS DISTINCT FROM OLD.resultados THEN
      v_acao := 'Resultado salvo';
    ELSIF NEW.analista IS DISTINCT FROM OLD.analista THEN
      v_acao := 'Analista alterado: ' || COALESCE(OLD.analista,'—') || ' → ' || COALESCE(NEW.analista,'—');
    ELSIF NEW.coletor IS DISTINCT FROM OLD.coletor THEN
      v_acao := 'Coletor alterado: ' || COALESCE(OLD.coletor,'—') || ' → ' || COALESCE(NEW.coletor,'—');
    ELSE
      v_acao := 'Exame atualizado';
    END IF;
    INSERT INTO public.atendimento_audit(entidade, operacao, acao, atendimento_id, registro_id, protocolo, paciente_nome, exame_nome, old_value, new_value, changed_by, changed_by_email, justificativa, pos_finalizacao)
    VALUES ('exame','UPDATE', v_acao, NEW.atendimento_id, NEW.id, COALESCE(v_protocolo,''), COALESCE(v_paciente,''), NEW.nome_exame, to_jsonb(OLD), to_jsonb(NEW), auth.uid(), v_email, v_just, v_post);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.atendimento_audit(entidade, operacao, acao, atendimento_id, registro_id, protocolo, paciente_nome, exame_nome, old_value, changed_by, changed_by_email, justificativa, pos_finalizacao)
    VALUES ('exame','DELETE', 'Exame removido', OLD.atendimento_id, OLD.id, COALESCE(v_protocolo,''), COALESCE(v_paciente,''), OLD.nome_exame, to_jsonb(OLD), auth.uid(), v_email, v_just, v_post);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.audit_atendimento_pagamentos()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_acao TEXT;
  v_email TEXT := public.current_user_email();
  v_just  TEXT := public._get_audit_justificativa();
  v_protocolo TEXT := '';
  v_paciente TEXT := '';
  v_at_id BIGINT;
  v_post BOOLEAN;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_at_id := OLD.atendimento_id;
  ELSE
    v_at_id := NEW.atendimento_id;
  END IF;

  SELECT protocolo, paciente_nome INTO v_protocolo, v_paciente
    FROM public.atendimentos WHERE id = v_at_id LIMIT 1;

  v_post := public._is_post_finalizacao(v_at_id);

  IF TG_OP = 'INSERT' THEN
    v_acao := 'Pagamento registrado: ' || NEW.tipo || ' R$ ' || NEW.valor::TEXT;
    INSERT INTO public.atendimento_audit(entidade, operacao, acao, atendimento_id, registro_id, protocolo, paciente_nome, new_value, changed_by, changed_by_email, justificativa, pos_finalizacao)
    VALUES ('pagamento','INSERT', v_acao, NEW.atendimento_id, NEW.id, COALESCE(v_protocolo,''), COALESCE(v_paciente,''), to_jsonb(NEW), auth.uid(), v_email, v_just, v_post);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_acao := 'Pagamento atualizado';
    INSERT INTO public.atendimento_audit(entidade, operacao, acao, atendimento_id, registro_id, protocolo, paciente_nome, old_value, new_value, changed_by, changed_by_email, justificativa, pos_finalizacao)
    VALUES ('pagamento','UPDATE', v_acao, NEW.atendimento_id, NEW.id, COALESCE(v_protocolo,''), COALESCE(v_paciente,''), to_jsonb(OLD), to_jsonb(NEW), auth.uid(), v_email, v_just, v_post);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.atendimento_audit(entidade, operacao, acao, atendimento_id, registro_id, protocolo, paciente_nome, old_value, changed_by, changed_by_email, justificativa, pos_finalizacao)
    VALUES ('pagamento','DELETE', 'Pagamento removido', OLD.atendimento_id, OLD.id, COALESCE(v_protocolo,''), COALESCE(v_paciente,''), to_jsonb(OLD), auth.uid(), v_email, v_just, v_post);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;