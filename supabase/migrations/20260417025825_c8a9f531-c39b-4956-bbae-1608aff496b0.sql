
-- =========================================================================
-- BLOCO 5a.1 — Cadastros base
-- =========================================================================

-- ---------- UNIDADES ----------
CREATE TABLE public.unidades (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('SEDE','FILIAL','PONTO_DE_COLETA')),
  endereco TEXT NOT NULL DEFAULT '',
  cidade TEXT NOT NULL DEFAULT '',
  estado TEXT NOT NULL DEFAULT '',
  telefone TEXT NOT NULL DEFAULT '',
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  padrao BOOLEAN NOT NULL DEFAULT FALSE,
  sede_pai_id TEXT REFERENCES public.unidades(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read unidades" ON public.unidades
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert unidades" ON public.unidades
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update unidades" ON public.unidades
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete unidades" ON public.unidades
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Trigger: protege a sede padrão contra exclusão
CREATE OR REPLACE FUNCTION public.protect_default_unidade()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.padrao = TRUE THEN
    RAISE EXCEPTION 'Unidade padrão não pode ser excluída';
  END IF;
  RETURN OLD;
END; $$;

CREATE TRIGGER trg_protect_default_unidade
BEFORE DELETE ON public.unidades
FOR EACH ROW EXECUTE FUNCTION public.protect_default_unidade();

CREATE TRIGGER trg_unidades_updated_at
BEFORE UPDATE ON public.unidades
FOR EACH ROW EXECUTE FUNCTION public.touch_app_settings_updated_at();

-- ---------- CONVENIOS ----------
CREATE TABLE public.convenios (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  registro_ans TEXT NOT NULL DEFAULT '',
  tipo TEXT NOT NULL DEFAULT 'Saúde' CHECK (tipo IN ('Saúde','Odontológico','Ocupacional')),
  tabela TEXT NOT NULL DEFAULT 'Própria' CHECK (tabela IN ('CBHPM','TUSS','Própria')),
  dias_retorno INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.convenios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read convenios" ON public.convenios
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert convenios" ON public.convenios
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update convenios" ON public.convenios
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete convenios" ON public.convenios
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Trigger: Particular (id 0) é imutável e indestrutível
CREATE OR REPLACE FUNCTION public.protect_particular_convenio()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.id = 0 THEN
    RAISE EXCEPTION 'Convênio Particular não pode ser excluído';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.id = 0 THEN
    IF NEW.nome <> 'Particular' OR NEW.ativo = FALSE THEN
      RAISE EXCEPTION 'Convênio Particular não pode ser renomeado nem desativado';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_protect_particular
BEFORE UPDATE OR DELETE ON public.convenios
FOR EACH ROW EXECUTE FUNCTION public.protect_particular_convenio();

CREATE TRIGGER trg_convenios_updated_at
BEFORE UPDATE ON public.convenios
FOR EACH ROW EXECUTE FUNCTION public.touch_app_settings_updated_at();

-- ---------- LABS APOIO ----------
CREATE TABLE public.labs_apoio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cnpj TEXT NOT NULL DEFAULT '',
  telefone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  contato TEXT NOT NULL DEFAULT '',
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.labs_apoio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read labs_apoio" ON public.labs_apoio
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert labs_apoio" ON public.labs_apoio
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update labs_apoio" ON public.labs_apoio
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete labs_apoio" ON public.labs_apoio
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_labs_apoio_updated_at
BEFORE UPDATE ON public.labs_apoio
FOR EACH ROW EXECUTE FUNCTION public.touch_app_settings_updated_at();

-- ---------- EXAMES CATALOGO ----------
CREATE TABLE public.exames_catalogo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mnemonico TEXT NOT NULL,
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT '',
  analise TEXT NOT NULL DEFAULT 'INTERNA',
  codigo TEXT NOT NULL DEFAULT '',
  codigo_cbhpm TEXT NOT NULL DEFAULT '',
  codigo_tuss TEXT NOT NULL DEFAULT '',
  material TEXT NOT NULL DEFAULT '',
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  usado_em_atendimento BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_exames_catalogo_nome ON public.exames_catalogo(nome);
CREATE INDEX idx_exames_catalogo_mnemonico ON public.exames_catalogo(mnemonico);

ALTER TABLE public.exames_catalogo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read exames_catalogo" ON public.exames_catalogo
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert exames_catalogo" ON public.exames_catalogo
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update exames_catalogo" ON public.exames_catalogo
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete exames_catalogo" ON public.exames_catalogo
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_exames_catalogo_updated_at
BEFORE UPDATE ON public.exames_catalogo
FOR EACH ROW EXECUTE FUNCTION public.touch_app_settings_updated_at();

-- ---------- TABELA PRECO ITENS ----------
CREATE TABLE public.tabela_preco_itens (
  id BIGSERIAL PRIMARY KEY,
  tabela TEXT NOT NULL CHECK (tabela IN ('CBHPM','TUSS','Própria')),
  codigo_exame TEXT NOT NULL DEFAULT '',
  nome_exame TEXT NOT NULL,
  valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  porte TEXT NOT NULL DEFAULT '-',
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tabela_preco_tabela_nome ON public.tabela_preco_itens(tabela, nome_exame);

ALTER TABLE public.tabela_preco_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read tabela_preco" ON public.tabela_preco_itens
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert tabela_preco" ON public.tabela_preco_itens
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update tabela_preco" ON public.tabela_preco_itens
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete tabela_preco" ON public.tabela_preco_itens
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_tabela_preco_updated_at
BEFORE UPDATE ON public.tabela_preco_itens
FOR EACH ROW EXECUTE FUNCTION public.touch_app_settings_updated_at();

-- ---------- VALORES REFERENCIA ----------
CREATE TABLE public.valores_referencia (
  id BIGSERIAL PRIMARY KEY,
  exame_nome TEXT NOT NULL,
  parametro_nome TEXT NOT NULL DEFAULT '',
  sexo TEXT NOT NULL DEFAULT 'Ambos' CHECK (sexo IN ('Ambos','Masculino','Feminino')),
  idade_min TEXT NOT NULL DEFAULT '',
  idade_max TEXT NOT NULL DEFAULT '',
  unidade_idade TEXT NOT NULL DEFAULT 'Anos' CHECK (unidade_idade IN ('Anos','Meses','Dias')),
  valor_min TEXT NOT NULL DEFAULT '',
  valor_max TEXT NOT NULL DEFAULT '',
  unidade TEXT NOT NULL DEFAULT '',
  descricao TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_valores_referencia_exame ON public.valores_referencia(exame_nome, parametro_nome);

ALTER TABLE public.valores_referencia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read valores_referencia" ON public.valores_referencia
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert valores_referencia" ON public.valores_referencia
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update valores_referencia" ON public.valores_referencia
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete valores_referencia" ON public.valores_referencia
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_valores_referencia_updated_at
BEFORE UPDATE ON public.valores_referencia
FOR EACH ROW EXECUTE FUNCTION public.touch_app_settings_updated_at();

-- =========================================================================
-- SEEDS
-- =========================================================================

-- UNIDADES
INSERT INTO public.unidades (id, nome, tipo, endereco, cidade, estado, telefone, ativo, padrao, sede_pai_id) VALUES
  ('und-001','Laboratório Central','SEDE','Av. Principal, 1000, Centro','São Paulo','SP','(11) 3000-0001',TRUE,TRUE,NULL),
  ('und-002','Filial Zona Norte','FILIAL','Rua das Flores, 200, Santana','São Paulo','SP','(11) 3000-0002',TRUE,FALSE,NULL),
  ('und-003','Posto Coleta Shopping Center','PONTO_DE_COLETA','Shopping Center, Loja 15','São Paulo','SP','(11) 3000-0003',TRUE,FALSE,'und-001');

-- CONVENIOS
INSERT INTO public.convenios (id, nome, registro_ans, tipo, tabela, dias_retorno, ativo) VALUES
  (0,'Particular','','Saúde','Própria',0,TRUE),
  (1,'Unimed','301337','Saúde','CBHPM',30,TRUE),
  (2,'Bradesco Saúde','005711','Saúde','TUSS',45,TRUE),
  (3,'SulAmérica','006246','Saúde','CBHPM',30,TRUE),
  (4,'Amil','326305','Saúde','Própria',60,FALSE),
  (5,'Hapvida','368253','Saúde','TUSS',30,TRUE);

-- LABS APOIO
INSERT INTO public.labs_apoio (nome, cnpj, telefone, email, contato, ativo) VALUES
  ('LabExpert Diagnósticos','12.345.678/0001-90','(11) 3456-7890','contato@labexpert.com.br','Dr. Ricardo',TRUE),
  ('BioAnalytica','98.765.432/0001-10','(21) 2345-6789','apoio@bioanalytica.com.br','Dra. Camila',TRUE);

-- EXAMES CATALOGO
INSERT INTO public.exames_catalogo (mnemonico, nome, categoria, analise, codigo, codigo_cbhpm, codigo_tuss, material, ativo) VALUES
  ('HEMO','Hemograma Completo','HEMATOLOGIA','INTERNA','40301630','40301630','40301630','Sangue',TRUE),
  ('GLIC','Glicemia','BIOQUÍMICA','INTERNA','40302040','40302040','40302040','Sangue',TRUE),
  ('COLT','Colesterol Total','BIOQUÍMICA','INTERNA','40301508','40301508','40301508','Sangue',TRUE),
  ('HDL','Colesterol HDL','BIOQUÍMICA','INTERNA','40301516','40301516','40301516','Sangue',TRUE),
  ('LDL','Colesterol LDL','BIOQUÍMICA','INTERNA','40301524','40301524','40301524','Sangue',TRUE),
  ('TRIG','Triglicerídeos','BIOQUÍMICA','INTERNA','40302610','40302610','40302610','Sangue',TRUE),
  ('CREAT','Creatinina','BIOQUÍMICA','INTERNA','40301575','40301575','40301575','Sangue',TRUE),
  ('UREI','Ureia','BIOQUÍMICA','INTERNA','40302903','40302903','40302903','Sangue',TRUE),
  ('TSH','TSH','IMUNOLOGIA','INTERNA','40316521','40316521','40316521','Sangue',TRUE),
  ('T4L','T4 Livre','IMUNOLOGIA','INTERNA','40316564','40316564','40316564','Sangue',TRUE),
  ('TGO','TGO (AST)','BIOQUÍMICA','INTERNA','40302695','40302695','40302695','Sangue',TRUE),
  ('TGP','TGP (ALT)','BIOQUÍMICA','INTERNA','40302709','40302709','40302709','Sangue',TRUE),
  ('ACUR','Ácido Úrico','BIOQUÍMICA','INTERNA','40301150','40301150','40301150','Sangue',TRUE),
  ('PSA','PSA Total','IMUNOLOGIA','INTERNA','40316386','40316386','40316386','Sangue',TRUE);

-- TABELA PRECO ITENS
-- CBHPM
INSERT INTO public.tabela_preco_itens (tabela, codigo_exame, nome_exame, valor, porte, ativo) VALUES
  ('CBHPM','40301630','Hemograma Completo',17.54,'1C',TRUE),
  ('CBHPM','40302040','Glicemia',6.77,'1A',TRUE),
  ('CBHPM','40301508','Colesterol Total',8.12,'1B',TRUE),
  ('CBHPM','40301516','Colesterol HDL',10.16,'1B',TRUE),
  ('CBHPM','40301524','Colesterol LDL',10.16,'1B',TRUE),
  ('CBHPM','40302610','Triglicerídeos',8.12,'1B',TRUE),
  ('CBHPM','40301575','Creatinina',6.77,'1A',TRUE),
  ('CBHPM','40302903','Ureia',6.77,'1A',TRUE),
  ('CBHPM','40316521','TSH',25.39,'2A',TRUE),
  ('CBHPM','40316564','T4 Livre',25.39,'2A',TRUE),
  ('CBHPM','40302695','TGO (AST)',6.77,'1A',TRUE),
  ('CBHPM','40302709','TGP (ALT)',6.77,'1A',TRUE),
  ('CBHPM','40301150','Ácido Úrico',6.77,'1A',TRUE),
  ('CBHPM','40316386','PSA Total',25.39,'2A',TRUE),
-- TUSS
  ('TUSS','40301630','Hemograma Completo',15.65,'-',TRUE),
  ('TUSS','40302040','Glicemia',5.62,'-',TRUE),
  ('TUSS','40301508','Colesterol Total',7.85,'-',TRUE),
  ('TUSS','40301516','Colesterol HDL',9.90,'-',TRUE),
  ('TUSS','40301524','Colesterol LDL',9.90,'-',TRUE),
  ('TUSS','40302610','Triglicerídeos',7.85,'-',TRUE),
  ('TUSS','40301575','Creatinina',5.62,'-',TRUE),
  ('TUSS','40302903','Ureia',5.62,'-',TRUE),
  ('TUSS','40316521','TSH',22.50,'-',TRUE),
  ('TUSS','40316564','T4 Livre',22.50,'-',TRUE),
  ('TUSS','40302695','TGO (AST)',5.62,'-',TRUE),
  ('TUSS','40302709','TGP (ALT)',5.62,'-',TRUE),
  ('TUSS','40301150','Ácido Úrico',5.62,'-',TRUE),
  ('TUSS','40316386','PSA Total',22.50,'-',TRUE),
-- Própria
  ('Própria','LAB001','Hemograma Completo',35.00,'-',TRUE),
  ('Própria','LAB002','Glicemia',15.00,'-',TRUE),
  ('Própria','LAB003','Colesterol Total',20.00,'-',TRUE),
  ('Própria','LAB004','Colesterol HDL',25.00,'-',TRUE),
  ('Própria','LAB005','Colesterol LDL',25.00,'-',TRUE),
  ('Própria','LAB006','Triglicerídeos',20.00,'-',TRUE),
  ('Própria','LAB007','Creatinina',15.00,'-',TRUE),
  ('Própria','LAB008','Ureia',15.00,'-',TRUE),
  ('Própria','LAB009','TSH',45.00,'-',TRUE),
  ('Própria','LAB010','T4 Livre',45.00,'-',TRUE),
  ('Própria','LAB011','TGO (AST)',15.00,'-',TRUE),
  ('Própria','LAB012','TGP (ALT)',15.00,'-',TRUE),
  ('Própria','LAB013','Ácido Úrico',18.00,'-',TRUE),
  ('Própria','LAB014','PSA Total',50.00,'-',TRUE);
