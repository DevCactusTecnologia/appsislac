-- =========================================
-- BLOCO 5a.2: Pacientes e Especialistas
-- =========================================

-- ===== PACIENTES =====
CREATE TABLE public.pacientes (
  id BIGSERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  cpf TEXT NOT NULL UNIQUE,
  data_nascimento DATE,
  sexo TEXT NOT NULL DEFAULT 'M',
  telefone TEXT NOT NULL DEFAULT '',
  celular TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  cep TEXT NOT NULL DEFAULT '',
  estado TEXT NOT NULL DEFAULT '',
  cidade TEXT NOT NULL DEFAULT '',
  bairro TEXT NOT NULL DEFAULT '',
  endereco TEXT NOT NULL DEFAULT '',
  numero TEXT NOT NULL DEFAULT '',
  complemento TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Ativo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pacientes_nome ON public.pacientes (nome);
CREATE INDEX idx_pacientes_cpf ON public.pacientes (cpf);
CREATE INDEX idx_pacientes_status ON public.pacientes (status);

ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Visualizar pacientes via permissao"
  ON public.pacientes FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'visualizar_pacientes'));

CREATE POLICY "Cadastrar pacientes via permissao"
  ON public.pacientes FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'cadastrar_paciente'));

CREATE POLICY "Editar pacientes via permissao"
  ON public.pacientes FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'editar_paciente'))
  WITH CHECK (public.has_permission(auth.uid(), 'editar_paciente'));

CREATE POLICY "Excluir pacientes admin"
  ON public.pacientes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER touch_pacientes_updated_at
  BEFORE UPDATE ON public.pacientes
  FOR EACH ROW EXECUTE FUNCTION public.touch_app_settings_updated_at();

-- ===== ESPECIALISTAS =====
CREATE TABLE public.especialistas (
  id BIGSERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  crm TEXT NOT NULL DEFAULT '',
  especialidade TEXT NOT NULL DEFAULT '',
  telefone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Ativo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_especialistas_nome ON public.especialistas (nome);
CREATE INDEX idx_especialistas_status ON public.especialistas (status);

ALTER TABLE public.especialistas ENABLE ROW LEVEL SECURITY;

-- Especialistas: leitura por qualquer authenticated (precisam aparecer em listas de "solicitante")
CREATE POLICY "Authenticated read especialistas"
  ON public.especialistas FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Cadastrar especialistas via permissao"
  ON public.especialistas FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'cadastrar_paciente') OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Editar especialistas via permissao"
  ON public.especialistas FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'editar_paciente') OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_permission(auth.uid(), 'editar_paciente') OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Excluir especialistas admin"
  ON public.especialistas FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER touch_especialistas_updated_at
  BEFORE UPDATE ON public.especialistas
  FOR EACH ROW EXECUTE FUNCTION public.touch_app_settings_updated_at();

-- ===== SEEDS =====
INSERT INTO public.pacientes (nome, cpf, data_nascimento, sexo, telefone, email, status) VALUES
  ('Maria Silva Santos', '12345678901', '1985-03-15', 'F', '(11) 98765-4321', 'maria.santos@email.com', 'Ativo'),
  ('João Pedro Oliveira', '23456789012', '1978-07-22', 'M', '(11) 97654-3210', 'joao.oliveira@email.com', 'Ativo'),
  ('Ana Carolina Souza', '34567890123', '1992-11-08', 'F', '(11) 96543-2109', 'ana.souza@email.com', 'Ativo'),
  ('Carlos Eduardo Lima', '45678901234', '1965-05-30', 'M', '(11) 95432-1098', 'carlos.lima@email.com', 'Inativo'),
  ('Beatriz Almeida Costa', '56789012345', '2000-01-12', 'F', '(11) 94321-0987', 'beatriz.costa@email.com', 'Ativo')
ON CONFLICT (cpf) DO NOTHING;

INSERT INTO public.especialistas (nome, crm, especialidade, telefone, email, status) VALUES
  ('Dr. Roberto Mendes', 'CRM/SP 123456', 'Clínico Geral', '(11) 3456-7890', 'roberto.mendes@clinica.com', 'Ativo'),
  ('Dra. Patrícia Souza', 'CRM/SP 234567', 'Cardiologia', '(11) 3567-8901', 'patricia.souza@clinica.com', 'Ativo'),
  ('Dr. Fernando Lima', 'CRM/SP 345678', 'Endocrinologia', '(11) 3678-9012', 'fernando.lima@clinica.com', 'Ativo'),
  ('Dra. Juliana Costa', 'CRM/SP 456789', 'Ginecologia', '(11) 3789-0123', 'juliana.costa@clinica.com', 'Ativo'),
  ('Dr. André Santos', 'CRM/SP 567890', 'Urologia', '(11) 3890-1234', 'andre.santos@clinica.com', 'Inativo'),
  ('Dra. Camila Ferreira', 'CRM/SP 678901', 'Pediatria', '(11) 3901-2345', 'camila.ferreira@clinica.com', 'Ativo');