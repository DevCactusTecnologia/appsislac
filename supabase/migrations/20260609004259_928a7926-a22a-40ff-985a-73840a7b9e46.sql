CREATE TYPE public.inscricao_status AS ENUM ('Nova', 'Confirmada', 'Em contato', 'Qualificada', 'Implantação', 'Convertida', 'Descartada');

CREATE TABLE public.inscricoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  nome_responsavel TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  nome_laboratorio TEXT NOT NULL,
  cidade TEXT NOT NULL,
  estado TEXT NOT NULL,
  quantidade_unidades TEXT NOT NULL,
  whatsapp_confirmado BOOLEAN DEFAULT false,
  status public.inscricao_status DEFAULT 'Nova',
  observacoes TEXT,
  codigo_validacao TEXT,
  codigo_expira_em TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.inscricoes ENABLE ROW LEVEL SECURITY;

-- Permissions
GRANT ALL ON public.inscricoes TO service_role;
GRANT INSERT, SELECT, UPDATE ON public.inscricoes TO anon;
GRANT ALL ON public.inscricoes TO authenticated;

-- Policies
CREATE POLICY "Public insert" ON public.inscricoes FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Public select their own by ID" ON public.inscricoes FOR SELECT TO anon USING (true);
CREATE POLICY "Public update their own by ID" ON public.inscricoes FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- Security for Super Admin
CREATE POLICY "Super Admin manage" ON public.inscricoes FOR ALL TO authenticated 
USING ( EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'super_admin') )
WITH CHECK ( EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'super_admin') );
