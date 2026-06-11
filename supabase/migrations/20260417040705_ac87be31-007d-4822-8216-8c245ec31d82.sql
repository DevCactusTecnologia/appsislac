-- Tabela de auditoria de atendimentos
CREATE TABLE public.atendimento_audit (
  id BIGSERIAL PRIMARY KEY,
  entidade TEXT NOT NULL CHECK (entidade IN ('atendimento','exame','pagamento')),
  operacao TEXT NOT NULL CHECK (operacao IN ('INSERT','UPDATE','DELETE')),
  acao TEXT NOT NULL DEFAULT '',
  atendimento_id BIGINT,
  registro_id BIGINT,
  protocolo TEXT NOT NULL DEFAULT '',
  paciente_nome TEXT NOT NULL DEFAULT '',
  exame_nome TEXT NOT NULL DEFAULT '',
  old_value JSONB,
  new_value JSONB,
  changed_by UUID,
  changed_by_email TEXT NOT NULL DEFAULT '',
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_atendimento_audit_atendimento_id ON public.atendimento_audit(atendimento_id);
CREATE INDEX idx_atendimento_audit_protocolo ON public.atendimento_audit(protocolo);
CREATE INDEX idx_atendimento_audit_changed_at ON public.atendimento_audit(changed_at DESC);

ALTER TABLE public.atendimento_audit ENABLE ROW LEVEL SECURITY;

-- Visualização: admin OU permissão 'auditoria'
CREATE POLICY "Visualizar auditoria via permissao"
  ON public.atendimento_audit
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'auditoria'));

-- Sem políticas de INSERT/UPDATE/DELETE — apenas triggers (SECURITY DEFINER) gravam

-- Helper: obter email do usuário atual
CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS TEXT
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE em TEXT;
BEGIN
  SELECT email INTO em FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
  RETURN COALESCE(em, '');
END;
$$;

-- Trigger: atendimentos
CREATE OR REPLACE FUNCTION public.audit_atendimentos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acao TEXT;
  v_email TEXT := public.current_user_email();
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_acao := 'Pedido realizado';
    INSERT INTO public.atendimento_audit(entidade, operacao, acao, atendimento_id, registro_id, protocolo, paciente_nome, new_value, changed_by, changed_by_email)
    VALUES ('atendimento','INSERT', v_acao, NEW.id, NEW.id, NEW.protocolo, NEW.paciente_nome, to_jsonb(NEW), auth.uid(), v_email);
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
    INSERT INTO public.atendimento_audit(entidade, operacao, acao, atendimento_id, registro_id, protocolo, paciente_nome, old_value, new_value, changed_by, changed_by_email)
    VALUES ('atendimento','UPDATE', v_acao, NEW.id, NEW.id, NEW.protocolo, NEW.paciente_nome, to_jsonb(OLD), to_jsonb(NEW), auth.uid(), v_email);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.atendimento_audit(entidade, operacao, acao, atendimento_id, registro_id, protocolo, paciente_nome, old_value, changed_by, changed_by_email)
    VALUES ('atendimento','DELETE', 'Atendimento removido', OLD.id, OLD.id, OLD.protocolo, OLD.paciente_nome, to_jsonb(OLD), auth.uid(), v_email);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_audit_atendimentos
  AFTER INSERT OR UPDATE OR DELETE ON public.atendimentos
  FOR EACH ROW EXECUTE FUNCTION public.audit_atendimentos();

-- Trigger: atendimento_exames
CREATE OR REPLACE FUNCTION public.audit_atendimento_exames()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acao TEXT;
  v_email TEXT := public.current_user_email();
  v_protocolo TEXT := '';
  v_paciente TEXT := '';
  v_at_id BIGINT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_at_id := OLD.atendimento_id;
  ELSE
    v_at_id := NEW.atendimento_id;
  END IF;

  SELECT protocolo, paciente_nome INTO v_protocolo, v_paciente
    FROM public.atendimentos WHERE id = v_at_id LIMIT 1;

  IF TG_OP = 'INSERT' THEN
    v_acao := 'Exame adicionado';
    INSERT INTO public.atendimento_audit(entidade, operacao, acao, atendimento_id, registro_id, protocolo, paciente_nome, exame_nome, new_value, changed_by, changed_by_email)
    VALUES ('exame','INSERT', v_acao, NEW.atendimento_id, NEW.id, COALESCE(v_protocolo,''), COALESCE(v_paciente,''), NEW.nome_exame, to_jsonb(NEW), auth.uid(), v_email);
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
    INSERT INTO public.atendimento_audit(entidade, operacao, acao, atendimento_id, registro_id, protocolo, paciente_nome, exame_nome, old_value, new_value, changed_by, changed_by_email)
    VALUES ('exame','UPDATE', v_acao, NEW.atendimento_id, NEW.id, COALESCE(v_protocolo,''), COALESCE(v_paciente,''), NEW.nome_exame, to_jsonb(OLD), to_jsonb(NEW), auth.uid(), v_email);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.atendimento_audit(entidade, operacao, acao, atendimento_id, registro_id, protocolo, paciente_nome, exame_nome, old_value, changed_by, changed_by_email)
    VALUES ('exame','DELETE', 'Exame removido', OLD.atendimento_id, OLD.id, COALESCE(v_protocolo,''), COALESCE(v_paciente,''), OLD.nome_exame, to_jsonb(OLD), auth.uid(), v_email);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_audit_atendimento_exames
  AFTER INSERT OR UPDATE OR DELETE ON public.atendimento_exames
  FOR EACH ROW EXECUTE FUNCTION public.audit_atendimento_exames();

-- Trigger: atendimento_pagamentos
CREATE OR REPLACE FUNCTION public.audit_atendimento_pagamentos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acao TEXT;
  v_email TEXT := public.current_user_email();
  v_protocolo TEXT := '';
  v_paciente TEXT := '';
  v_at_id BIGINT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_at_id := OLD.atendimento_id;
  ELSE
    v_at_id := NEW.atendimento_id;
  END IF;

  SELECT protocolo, paciente_nome INTO v_protocolo, v_paciente
    FROM public.atendimentos WHERE id = v_at_id LIMIT 1;

  IF TG_OP = 'INSERT' THEN
    v_acao := 'Pagamento registrado: ' || NEW.tipo || ' R$ ' || NEW.valor::TEXT;
    INSERT INTO public.atendimento_audit(entidade, operacao, acao, atendimento_id, registro_id, protocolo, paciente_nome, new_value, changed_by, changed_by_email)
    VALUES ('pagamento','INSERT', v_acao, NEW.atendimento_id, NEW.id, COALESCE(v_protocolo,''), COALESCE(v_paciente,''), to_jsonb(NEW), auth.uid(), v_email);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_acao := 'Pagamento atualizado';
    INSERT INTO public.atendimento_audit(entidade, operacao, acao, atendimento_id, registro_id, protocolo, paciente_nome, old_value, new_value, changed_by, changed_by_email)
    VALUES ('pagamento','UPDATE', v_acao, NEW.atendimento_id, NEW.id, COALESCE(v_protocolo,''), COALESCE(v_paciente,''), to_jsonb(OLD), to_jsonb(NEW), auth.uid(), v_email);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.atendimento_audit(entidade, operacao, acao, atendimento_id, registro_id, protocolo, paciente_nome, old_value, changed_by, changed_by_email)
    VALUES ('pagamento','DELETE', 'Pagamento removido', OLD.atendimento_id, OLD.id, COALESCE(v_protocolo,''), COALESCE(v_paciente,''), to_jsonb(OLD), auth.uid(), v_email);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_audit_atendimento_pagamentos
  AFTER INSERT OR UPDATE OR DELETE ON public.atendimento_pagamentos
  FOR EACH ROW EXECUTE FUNCTION public.audit_atendimento_pagamentos();