-- =========================================
-- BLOCO 5a.3: Atendimentos (núcleo operacional)
-- =========================================

-- ===== TABELA: atendimentos =====
CREATE TABLE public.atendimentos (
  id BIGSERIAL PRIMARY KEY,
  protocolo TEXT NOT NULL UNIQUE,
  data TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Snapshot do paciente (preserva histórico mesmo se paciente for editado)
  paciente_id BIGINT,
  paciente_nome TEXT NOT NULL,
  paciente_cpf TEXT NOT NULL,
  paciente_nascimento DATE,
  -- Vínculos operacionais
  solicitante TEXT NOT NULL DEFAULT '',
  convenio_id INTEGER NOT NULL DEFAULT 0,
  convenio_nome TEXT NOT NULL DEFAULT 'Particular',
  unidade_id TEXT NOT NULL DEFAULT 'und-001',
  -- Status DERIVADOS por trigger
  status_atendimento TEXT NOT NULL DEFAULT 'Pedido Realizado',
  status_pagamento TEXT NOT NULL DEFAULT 'Pagamento pendente',
  motivo_cancelamento TEXT,
  -- Auditoria
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_atendimentos_protocolo ON public.atendimentos (protocolo);
CREATE INDEX idx_atendimentos_cpf ON public.atendimentos (paciente_cpf);
CREATE INDEX idx_atendimentos_paciente_id ON public.atendimentos (paciente_id);
CREATE INDEX idx_atendimentos_unidade ON public.atendimentos (unidade_id);
CREATE INDEX idx_atendimentos_status_at ON public.atendimentos (status_atendimento);
CREATE INDEX idx_atendimentos_data ON public.atendimentos (data DESC);

-- ===== TABELA: atendimento_exames =====
CREATE TABLE public.atendimento_exames (
  id BIGSERIAL PRIMARY KEY,
  atendimento_id BIGINT NOT NULL REFERENCES public.atendimentos(id) ON DELETE CASCADE,
  -- Híbrido: nome sempre, FK opcional para catálogo
  exame_id UUID REFERENCES public.exames_catalogo(id) ON DELETE SET NULL,
  nome_exame TEXT NOT NULL,
  material TEXT NOT NULL DEFAULT '',
  -- Estados: pendente | coletado | em_analise | finalizado | cancelado
  status TEXT NOT NULL DEFAULT 'pendente',
  valor NUMERIC(10,2) NOT NULL DEFAULT 0,
  -- Operacionais
  analista TEXT NOT NULL DEFAULT '',
  coletor TEXT NOT NULL DEFAULT '',
  data_coleta TIMESTAMPTZ,
  data_analise TIMESTAMPTZ,
  data_liberacao TIMESTAMPTZ,
  -- Resultados (livre — JSON com parâmetros)
  resultados JSONB NOT NULL DEFAULT '{}'::jsonb,
  motivo_cancelamento TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (status IN ('pendente','coletado','em_analise','finalizado','cancelado'))
);

CREATE INDEX idx_at_exames_atendimento ON public.atendimento_exames (atendimento_id);
CREATE INDEX idx_at_exames_status ON public.atendimento_exames (status);
CREATE INDEX idx_at_exames_exame_id ON public.atendimento_exames (exame_id);

-- ===== TABELA: atendimento_pagamentos =====
CREATE TABLE public.atendimento_pagamentos (
  id BIGSERIAL PRIMARY KEY,
  atendimento_id BIGINT NOT NULL REFERENCES public.atendimentos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  valor NUMERIC(10,2) NOT NULL DEFAULT 0,
  data TIMESTAMPTZ NOT NULL DEFAULT now(),
  observacao TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_at_pagamentos_atendimento ON public.atendimento_pagamentos (atendimento_id);
CREATE INDEX idx_at_pagamentos_data ON public.atendimento_pagamentos (data DESC);

-- ===== TRIGGERS DE TIMESTAMP =====
CREATE TRIGGER touch_atendimentos_updated_at
  BEFORE UPDATE ON public.atendimentos
  FOR EACH ROW EXECUTE FUNCTION public.touch_app_settings_updated_at();

CREATE TRIGGER touch_atendimento_exames_updated_at
  BEFORE UPDATE ON public.atendimento_exames
  FOR EACH ROW EXECUTE FUNCTION public.touch_app_settings_updated_at();

CREATE TRIGGER touch_atendimento_pagamentos_updated_at
  BEFORE UPDATE ON public.atendimento_pagamentos
  FOR EACH ROW EXECUTE FUNCTION public.touch_app_settings_updated_at();

-- ===== FUNÇÃO: recalcular status do atendimento =====
CREATE OR REPLACE FUNCTION public.recompute_atendimento_status(_atendimento_id BIGINT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_exames INT;
  total_cancelados INT;
  total_finalizados INT;
  total_em_analise INT;
  total_coletados INT;
  ativos INT;
  novo_status_at TEXT;
  total_valor NUMERIC(10,2);
  total_pago NUMERIC(10,2);
  novo_status_pg TEXT;
BEGIN
  SELECT
    count(*),
    count(*) FILTER (WHERE status = 'cancelado'),
    count(*) FILTER (WHERE status = 'finalizado'),
    count(*) FILTER (WHERE status = 'em_analise'),
    count(*) FILTER (WHERE status = 'coletado')
  INTO total_exames, total_cancelados, total_finalizados, total_em_analise, total_coletados
  FROM public.atendimento_exames
  WHERE atendimento_id = _atendimento_id;

  ativos := total_exames - total_cancelados;

  -- Regra de derivação do status do atendimento
  IF total_exames = 0 THEN
    novo_status_at := 'Pedido Realizado';
  ELSIF total_cancelados = total_exames THEN
    novo_status_at := 'Cancelado';
  ELSIF total_finalizados = ativos THEN
    novo_status_at := 'Resultado Liberado';
  ELSIF (total_finalizados + total_em_analise) = ativos AND total_em_analise > 0 THEN
    novo_status_at := 'Amostra Analisada';
  ELSIF (total_finalizados + total_em_analise + total_coletados) > 0 THEN
    novo_status_at := 'Amostra Coletada';
  ELSE
    novo_status_at := 'Pedido Realizado';
  END IF;

  -- Cálculo do status de pagamento (sobre exames ATIVOS)
  SELECT COALESCE(SUM(valor), 0) INTO total_valor
  FROM public.atendimento_exames
  WHERE atendimento_id = _atendimento_id AND status <> 'cancelado';

  SELECT COALESCE(SUM(valor), 0) INTO total_pago
  FROM public.atendimento_pagamentos
  WHERE atendimento_id = _atendimento_id;

  IF total_cancelados = total_exames AND total_exames > 0 THEN
    novo_status_pg := 'Pagamento cancelado';
  ELSIF total_valor = 0 OR total_pago >= total_valor THEN
    novo_status_pg := 'Pagamento efetuado';
  ELSIF total_pago > 0 THEN
    novo_status_pg := 'Pagamento parcial';
  ELSE
    novo_status_pg := 'Pagamento pendente';
  END IF;

  UPDATE public.atendimentos
  SET status_atendimento = novo_status_at,
      status_pagamento = novo_status_pg
  WHERE id = _atendimento_id;
END;
$$;

-- ===== TRIGGERS: recalcular status quando exames/pagamentos mudam =====
CREATE OR REPLACE FUNCTION public.trg_recompute_on_exame_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_atendimento_status(OLD.atendimento_id);
    RETURN OLD;
  ELSE
    PERFORM public.recompute_atendimento_status(NEW.atendimento_id);
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER recompute_status_on_exame
  AFTER INSERT OR UPDATE OR DELETE ON public.atendimento_exames
  FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_on_exame_change();

CREATE OR REPLACE FUNCTION public.trg_recompute_on_pagamento_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_atendimento_status(OLD.atendimento_id);
    RETURN OLD;
  ELSE
    PERFORM public.recompute_atendimento_status(NEW.atendimento_id);
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER recompute_status_on_pagamento
  AFTER INSERT OR UPDATE OR DELETE ON public.atendimento_pagamentos
  FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_on_pagamento_change();

-- ===== RLS =====
ALTER TABLE public.atendimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atendimento_exames ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atendimento_pagamentos ENABLE ROW LEVEL SECURITY;

-- atendimentos
CREATE POLICY "Visualizar atendimentos via permissao"
  ON public.atendimentos FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'visualizar_atendimentos'));

CREATE POLICY "Criar atendimentos via permissao"
  ON public.atendimentos FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'criar_atendimento'));

CREATE POLICY "Editar atendimentos via permissao"
  ON public.atendimentos FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'editar_atendimento')
         OR public.has_permission(auth.uid(), 'cancelar_atendimento')
         OR public.has_permission(auth.uid(), 'analisar_amostra')
         OR public.has_permission(auth.uid(), 'liberar_resultado')
         OR public.has_permission(auth.uid(), 'registrar_coleta'))
  WITH CHECK (public.has_permission(auth.uid(), 'editar_atendimento')
              OR public.has_permission(auth.uid(), 'cancelar_atendimento')
              OR public.has_permission(auth.uid(), 'analisar_amostra')
              OR public.has_permission(auth.uid(), 'liberar_resultado')
              OR public.has_permission(auth.uid(), 'registrar_coleta'));

CREATE POLICY "Excluir atendimentos via permissao"
  ON public.atendimentos FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'cancelar_atendimento'));

-- atendimento_exames
CREATE POLICY "Visualizar exames via permissao"
  ON public.atendimento_exames FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'visualizar_atendimentos'));

CREATE POLICY "Criar exames via permissao"
  ON public.atendimento_exames FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'criar_atendimento')
              OR public.has_permission(auth.uid(), 'editar_atendimento'));

CREATE POLICY "Editar exames via permissao"
  ON public.atendimento_exames FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'editar_atendimento')
         OR public.has_permission(auth.uid(), 'registrar_coleta')
         OR public.has_permission(auth.uid(), 'analisar_amostra')
         OR public.has_permission(auth.uid(), 'liberar_resultado'))
  WITH CHECK (public.has_permission(auth.uid(), 'editar_atendimento')
              OR public.has_permission(auth.uid(), 'registrar_coleta')
              OR public.has_permission(auth.uid(), 'analisar_amostra')
              OR public.has_permission(auth.uid(), 'liberar_resultado'));

CREATE POLICY "Excluir exames via permissao"
  ON public.atendimento_exames FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'editar_atendimento')
         OR public.has_permission(auth.uid(), 'cancelar_atendimento'));

-- atendimento_pagamentos
CREATE POLICY "Visualizar pagamentos via permissao"
  ON public.atendimento_pagamentos FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'visualizar_atendimentos')
         OR public.has_permission(auth.uid(), 'visualizar_financeiro'));

CREATE POLICY "Criar pagamentos via permissao"
  ON public.atendimento_pagamentos FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'registrar_pagamento'));

CREATE POLICY "Editar pagamentos via permissao"
  ON public.atendimento_pagamentos FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'registrar_pagamento'))
  WITH CHECK (public.has_permission(auth.uid(), 'registrar_pagamento'));

CREATE POLICY "Excluir pagamentos admin"
  ON public.atendimento_pagamentos FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ===== SEED dos 18 atendimentos mock =====
-- Helper temporário: parsear "dd/MM/yyyy HH:mm:ss" → timestamptz
DO $seed$
DECLARE
  v_id BIGINT;
BEGIN
  -- ATD-2026-0001
  INSERT INTO atendimentos (protocolo, data, paciente_nome, paciente_cpf, paciente_nascimento, solicitante, convenio_nome, unidade_id)
  VALUES ('ATD-2026-0001', '2026-03-15 08:32:15-03', 'Maria Silva Santos', '12345678900', '1985-03-15', 'Dr. Ricardo Mendes', 'Unimed', 'und-001') RETURNING id INTO v_id;
  INSERT INTO atendimento_exames (atendimento_id, nome_exame, status, valor, ordem) VALUES
    (v_id, 'Hemograma Completo', 'pendente', 25.00, 1),
    (v_id, 'Glicemia', 'pendente', 20.00, 2);
  INSERT INTO atendimento_pagamentos (atendimento_id, tipo, valor, data) VALUES (v_id, 'Cartão de crédito', 45.00, '2026-03-15');

  -- ATD-2026-0002 (Pagamento pendente)
  INSERT INTO atendimentos (protocolo, data, paciente_nome, paciente_cpf, paciente_nascimento, solicitante, convenio_nome, unidade_id)
  VALUES ('ATD-2026-0002', '2026-03-15 09:15:42-03', 'João Pedro Oliveira', '98765432100', '1990-07-22', 'Dra. Camila Araújo', 'Particular', 'und-002') RETURNING id INTO v_id;
  INSERT INTO atendimento_exames (atendimento_id, nome_exame, status, valor, ordem) VALUES
    (v_id, 'Colesterol Total', 'pendente', 22.00, 1),
    (v_id, 'Triglicerídeos', 'pendente', 22.00, 2),
    (v_id, 'Colesterol HDL', 'pendente', 22.00, 3);

  -- ATD-2026-0003 (Amostra Coletada)
  INSERT INTO atendimentos (protocolo, data, paciente_nome, paciente_cpf, paciente_nascimento, solicitante, convenio_nome, unidade_id)
  VALUES ('ATD-2026-0003', '2026-03-14 14:08:33-03', 'Ana Carolina Ferreira', '45678912300', '1978-01-10', 'Dr. Ricardo Mendes', 'Bradesco Saúde', 'und-001') RETURNING id INTO v_id;
  INSERT INTO atendimento_exames (atendimento_id, nome_exame, status, valor, ordem, data_coleta) VALUES
    (v_id, 'TSH', 'coletado', 30.00, 1, '2026-03-14 14:30:00-03'),
    (v_id, 'T4 Livre', 'coletado', 30.00, 2, '2026-03-14 14:30:00-03');
  INSERT INTO atendimento_pagamentos (atendimento_id, tipo, valor, data) VALUES (v_id, 'Dinheiro', 60.00, '2026-03-14');

  -- ATD-2026-0004 (Amostra Analisada + parcial)
  INSERT INTO atendimentos (protocolo, data, paciente_nome, paciente_cpf, paciente_nascimento, solicitante, convenio_nome, unidade_id)
  VALUES ('ATD-2026-0004', '2026-03-13 10:45:07-03', 'Carlos Eduardo Lima', '32165498700', '1965-11-05', 'Dr. Felipe Andrade', 'SulAmérica', 'und-003') RETURNING id INTO v_id;
  INSERT INTO atendimento_exames (atendimento_id, nome_exame, status, valor, ordem, data_coleta, data_analise) VALUES
    (v_id, 'Creatinina', 'em_analise', 25.00, 1, '2026-03-13 11:00:00-03', '2026-03-13 12:00:00-03'),
    (v_id, 'Ureia', 'em_analise', 25.00, 2, '2026-03-13 11:00:00-03', '2026-03-13 12:00:00-03'),
    (v_id, 'Ácido Úrico', 'em_analise', 25.00, 3, '2026-03-13 11:00:00-03', '2026-03-13 12:00:00-03'),
    (v_id, 'PSA Total', 'em_analise', 40.00, 4, '2026-03-13 11:00:00-03', '2026-03-13 12:00:00-03');
  INSERT INTO atendimento_pagamentos (atendimento_id, tipo, valor, data) VALUES (v_id, 'PIX', 30.00, '2026-03-13');

  -- ATD-2026-0005 (Resultado Liberado)
  INSERT INTO atendimentos (protocolo, data, paciente_nome, paciente_cpf, paciente_nascimento, solicitante, convenio_nome, unidade_id)
  VALUES ('ATD-2026-0005', '2026-03-12 07:50:21-03', 'Beatriz Souza Mendes', '65432198700', '2000-06-28', 'Dra. Camila Araújo', 'Hapvida', 'und-002') RETURNING id INTO v_id;
  INSERT INTO atendimento_exames (atendimento_id, nome_exame, status, valor, ordem, data_coleta, data_analise, data_liberacao) VALUES
    (v_id, 'Hemograma Completo', 'finalizado', 25.00, 1, '2026-03-12 08:00:00-03', '2026-03-12 09:00:00-03', '2026-03-12 10:00:00-03'),
    (v_id, 'Glicemia', 'finalizado', 20.00, 2, '2026-03-12 08:00:00-03', '2026-03-12 09:00:00-03', '2026-03-12 10:00:00-03'),
    (v_id, 'TGO (AST)', 'finalizado', 20.00, 3, '2026-03-12 08:00:00-03', '2026-03-12 09:00:00-03', '2026-03-12 10:00:00-03'),
    (v_id, 'TGP (ALT)', 'finalizado', 20.00, 4, '2026-03-12 08:00:00-03', '2026-03-12 09:00:00-03', '2026-03-12 10:00:00-03');
  INSERT INTO atendimento_pagamentos (atendimento_id, tipo, valor, data) VALUES (v_id, 'Cartão de débito', 85.00, '2026-03-12');

  -- ATD-2026-0006 (Cancelado)
  INSERT INTO atendimentos (protocolo, data, paciente_nome, paciente_cpf, paciente_nascimento, solicitante, convenio_nome, unidade_id, motivo_cancelamento)
  VALUES ('ATD-2026-0006', '2026-03-11 16:22:58-03', 'Roberto Almeida Costa', '78912345600', '1972-09-14', 'Dr. Ricardo Mendes', 'Particular', 'und-001', 'Paciente não compareceu para coleta') RETURNING id INTO v_id;
  INSERT INTO atendimento_exames (atendimento_id, nome_exame, status, valor, ordem, motivo_cancelamento) VALUES
    (v_id, 'Hemograma Completo', 'cancelado', 25.00, 1, 'Paciente não compareceu para coleta');

  -- ATD-2026-0007 (parcial)
  INSERT INTO atendimentos (protocolo, data, paciente_nome, paciente_cpf, paciente_nascimento, solicitante, convenio_nome, unidade_id)
  VALUES ('ATD-2026-0007', '2026-03-15 11:03:44-03', 'Fernanda Rodrigues', '23456789000', '1995-12-03', 'Dr. Felipe Andrade', 'Unimed', 'und-001') RETURNING id INTO v_id;
  INSERT INTO atendimento_exames (atendimento_id, nome_exame, status, valor, ordem) VALUES
    (v_id, 'Colesterol Total', 'pendente', 22.00, 1),
    (v_id, 'Colesterol HDL', 'pendente', 22.00, 2),
    (v_id, 'Colesterol LDL', 'pendente', 22.00, 3),
    (v_id, 'Triglicerídeos', 'pendente', 22.00, 4);
  INSERT INTO atendimento_pagamentos (atendimento_id, tipo, valor, data) VALUES (v_id, 'PIX', 20.00, '2026-03-15');

  -- ATD-2026-0008 (Resultado Salvo == finalizado/em_analise misto - usaremos em_analise para 1 e finalizado p/ outros via status_atendimento)
  -- Para mapear "Resultado Salvo" da legacy: deixaremos todos finalizados e o status fica "Resultado Liberado". 
  -- Convertendo para "em_analise" parcial para refletir intermediário:
  INSERT INTO atendimentos (protocolo, data, paciente_nome, paciente_cpf, paciente_nascimento, solicitante, convenio_nome, unidade_id)
  VALUES ('ATD-2026-0008', '2026-03-13 13:37:19-03', 'Lucas Martins Pereira', '56789023400', '1988-04-19', 'Dra. Camila Araújo', 'Bradesco Saúde', 'und-002') RETURNING id INTO v_id;
  INSERT INTO atendimento_exames (atendimento_id, nome_exame, status, valor, ordem, data_coleta, data_analise) VALUES
    (v_id, 'TSH', 'em_analise', 30.00, 1, '2026-03-13 14:00:00-03', '2026-03-13 15:00:00-03'),
    (v_id, 'T4 Livre', 'em_analise', 30.00, 2, '2026-03-13 14:00:00-03', '2026-03-13 15:00:00-03'),
    (v_id, 'Glicemia', 'em_analise', 20.00, 3, '2026-03-13 14:00:00-03', '2026-03-13 15:00:00-03');
  INSERT INTO atendimento_pagamentos (atendimento_id, tipo, valor, data) VALUES (v_id, 'Dinheiro', 70.00, '2026-03-13');

  -- ATD-2026-0009 (Coletada + pendente)
  INSERT INTO atendimentos (protocolo, data, paciente_nome, paciente_cpf, paciente_nascimento, solicitante, convenio_nome, unidade_id)
  VALUES ('ATD-2026-0009', '2026-03-14 15:55:02-03', 'Maria Silva Santos', '12345678900', '1985-03-15', 'Dr. Felipe Andrade', 'Particular', 'und-003') RETURNING id INTO v_id;
  INSERT INTO atendimento_exames (atendimento_id, nome_exame, status, valor, ordem, data_coleta) VALUES
    (v_id, 'Creatinina', 'coletado', 25.00, 1, '2026-03-14 16:00:00-03'),
    (v_id, 'Ureia', 'coletado', 25.00, 2, '2026-03-14 16:00:00-03');

  -- ATD-2026-0010 (Cancelado mas pago — reembolso pendente; trigger marcará Pagamento cancelado)
  INSERT INTO atendimentos (protocolo, data, paciente_nome, paciente_cpf, paciente_nascimento, solicitante, convenio_nome, unidade_id, motivo_cancelamento)
  VALUES ('ATD-2026-0010', '2026-03-10 09:28:36-03', 'João Pedro Oliveira', '98765432100', '1990-07-22', 'Dr. Ricardo Mendes', 'Unimed', 'und-001', 'Amostra hemolisada — coleta invalidada') RETURNING id INTO v_id;
  INSERT INTO atendimento_exames (atendimento_id, nome_exame, status, valor, ordem, motivo_cancelamento) VALUES
    (v_id, 'Hemograma Completo', 'cancelado', 25.00, 1, 'Amostra hemolisada'),
    (v_id, 'TGO (AST)', 'cancelado', 20.00, 2, 'Amostra hemolisada');
  INSERT INTO atendimento_pagamentos (atendimento_id, tipo, valor, data) VALUES (v_id, 'Cartão de crédito', 40.00, '2026-03-10');

  -- ATD-2026-0011 a 0018: aniversariantes/atuais
  INSERT INTO atendimentos (protocolo, data, paciente_nome, paciente_cpf, paciente_nascimento, solicitante, convenio_nome, unidade_id)
  VALUES ('ATD-2026-0011', '2026-04-16 08:12:05-03', 'Patrícia Gomes Ribeiro', '11122233344', '1982-04-16', 'Dra. Camila Araújo', 'Unimed', 'und-001') RETURNING id INTO v_id;
  INSERT INTO atendimento_exames (atendimento_id, nome_exame, status, valor, ordem) VALUES
    (v_id, 'Hemograma Completo', 'pendente', 25.00, 1),
    (v_id, 'TSH', 'pendente', 30.00, 2),
    (v_id, 'Glicemia', 'pendente', 20.00, 3);
  INSERT INTO atendimento_pagamentos (atendimento_id, tipo, valor, data) VALUES (v_id, 'PIX', 95.00, '2026-04-16');

  INSERT INTO atendimentos (protocolo, data, paciente_nome, paciente_cpf, paciente_nascimento, solicitante, convenio_nome, unidade_id)
  VALUES ('ATD-2026-0012', '2026-04-16 09:48:21-03', 'Eduardo Nunes Vasconcelos', '22233344455', '1975-04-16', 'Dr. Ricardo Mendes', 'Bradesco Saúde', 'und-002') RETURNING id INTO v_id;
  INSERT INTO atendimento_exames (atendimento_id, nome_exame, status, valor, ordem, data_coleta) VALUES
    (v_id, 'PSA Total', 'coletado', 40.00, 1, '2026-04-16 10:00:00-03'),
    (v_id, 'Creatinina', 'coletado', 25.00, 2, '2026-04-16 10:00:00-03'),
    (v_id, 'Colesterol Total', 'coletado', 22.00, 3, '2026-04-16 10:00:00-03');
  INSERT INTO atendimento_pagamentos (atendimento_id, tipo, valor, data) VALUES (v_id, 'Cartão de débito', 120.00, '2026-04-16');

  INSERT INTO atendimentos (protocolo, data, paciente_nome, paciente_cpf, paciente_nascimento, solicitante, convenio_nome, unidade_id)
  VALUES ('ATD-2026-0013', '2026-04-15 14:33:18-03', 'Rafael Henrique Borges', '44455566677', '1991-02-07', 'Dr. Felipe Andrade', 'SulAmérica', 'und-001') RETURNING id INTO v_id;
  INSERT INTO atendimento_exames (atendimento_id, nome_exame, status, valor, ordem, data_coleta, data_analise) VALUES
    (v_id, 'Hemograma Completo', 'em_analise', 25.00, 1, '2026-04-15 15:00:00-03', '2026-04-15 16:00:00-03'),
    (v_id, 'Glicemia', 'em_analise', 20.00, 2, '2026-04-15 15:00:00-03', '2026-04-15 16:00:00-03');
  INSERT INTO atendimento_pagamentos (atendimento_id, tipo, valor, data) VALUES (v_id, 'PIX', 75.00, '2026-04-15');

  INSERT INTO atendimentos (protocolo, data, paciente_nome, paciente_cpf, paciente_nascimento, solicitante, convenio_nome, unidade_id)
  VALUES ('ATD-2026-0014', '2026-04-15 11:07:42-03', 'Juliana Castro Moreira', '55566677788', '1986-08-23', 'Dra. Camila Araújo', 'Hapvida', 'und-003') RETURNING id INTO v_id;
  INSERT INTO atendimento_exames (atendimento_id, nome_exame, status, valor, ordem, data_coleta, data_analise) VALUES
    (v_id, 'TSH', 'em_analise', 30.00, 1, '2026-04-15 11:30:00-03', '2026-04-15 12:30:00-03'),
    (v_id, 'T4 Livre', 'em_analise', 30.00, 2, '2026-04-15 11:30:00-03', '2026-04-15 12:30:00-03'),
    (v_id, 'Colesterol HDL', 'em_analise', 22.00, 3, '2026-04-15 11:30:00-03', '2026-04-15 12:30:00-03');
  INSERT INTO atendimento_pagamentos (atendimento_id, tipo, valor, data) VALUES (v_id, 'Cartão de crédito', 90.00, '2026-04-15');

  INSERT INTO atendimentos (protocolo, data, paciente_nome, paciente_cpf, paciente_nascimento, solicitante, convenio_nome, unidade_id)
  VALUES ('ATD-2026-0015', '2026-04-14 16:22:09-03', 'Gabriel Tavares Pinheiro', '66677788899', '2002-05-11', 'Dr. Ricardo Mendes', 'Particular', 'und-001') RETURNING id INTO v_id;
  INSERT INTO atendimento_exames (atendimento_id, nome_exame, status, valor, ordem, data_coleta, data_analise, data_liberacao) VALUES
    (v_id, 'Hemograma Completo', 'finalizado', 25.00, 1, '2026-04-14 16:30:00-03', '2026-04-14 17:30:00-03', '2026-04-14 18:00:00-03');
  INSERT INTO atendimento_pagamentos (atendimento_id, tipo, valor, data) VALUES (v_id, 'Dinheiro', 35.00, '2026-04-14');

  INSERT INTO atendimentos (protocolo, data, paciente_nome, paciente_cpf, paciente_nascimento, solicitante, convenio_nome, unidade_id)
  VALUES ('ATD-2026-0016', '2026-04-16 10:55:33-03', 'Larissa Mendonça Cunha', '77788899900', '1998-10-30', 'Dr. Felipe Andrade', 'Particular', 'und-002') RETURNING id INTO v_id;
  INSERT INTO atendimento_exames (atendimento_id, nome_exame, status, valor, ordem) VALUES
    (v_id, 'Glicemia', 'pendente', 20.00, 1),
    (v_id, 'Triglicerídeos', 'pendente', 22.00, 2),
    (v_id, 'Colesterol Total', 'pendente', 22.00, 3),
    (v_id, 'Colesterol HDL', 'pendente', 22.00, 4);

  INSERT INTO atendimentos (protocolo, data, paciente_nome, paciente_cpf, paciente_nascimento, solicitante, convenio_nome, unidade_id)
  VALUES ('ATD-2026-0017', '2026-04-15 13:18:50-03', 'Sophia Almeida Cardoso', '33344455566', '2018-04-16', 'Dra. Camila Araújo', 'Unimed', 'und-001') RETURNING id INTO v_id;
  INSERT INTO atendimento_exames (atendimento_id, nome_exame, status, valor, ordem, data_coleta) VALUES
    (v_id, 'Hemograma Completo', 'coletado', 25.00, 1, '2026-04-15 13:45:00-03'),
    (v_id, 'Parasitológico', 'coletado', 18.00, 2, '2026-04-15 13:45:00-03');
  INSERT INTO atendimento_pagamentos (atendimento_id, tipo, valor, data) VALUES (v_id, 'PIX', 25.00, '2026-04-15');

  INSERT INTO atendimentos (protocolo, data, paciente_nome, paciente_cpf, paciente_nascimento, solicitante, convenio_nome, unidade_id)
  VALUES ('ATD-2026-0018', '2026-04-13 09:40:00-03', 'Patrícia Gomes Ribeiro', '11122233344', '1982-04-16', 'Dra. Camila Araújo', 'Unimed', 'und-001') RETURNING id INTO v_id;
  INSERT INTO atendimento_exames (atendimento_id, nome_exame, status, valor, ordem, data_coleta, data_analise, data_liberacao) VALUES
    (v_id, 'Vitamina D', 'finalizado', 60.00, 1, '2026-04-13 10:00:00-03', '2026-04-13 11:00:00-03', '2026-04-13 12:00:00-03'),
    (v_id, 'Vitamina B12', 'finalizado', 50.00, 2, '2026-04-13 10:00:00-03', '2026-04-13 11:00:00-03', '2026-04-13 12:00:00-03');
  INSERT INTO atendimento_pagamentos (atendimento_id, tipo, valor, data) VALUES (v_id, 'Cartão de crédito', 110.00, '2026-04-13');

  -- Resolver paciente_id quando CPF bate com pacientes existentes
  UPDATE atendimentos a
  SET paciente_id = p.id
  FROM pacientes p
  WHERE p.cpf = a.paciente_cpf AND a.paciente_id IS NULL;
END $seed$;