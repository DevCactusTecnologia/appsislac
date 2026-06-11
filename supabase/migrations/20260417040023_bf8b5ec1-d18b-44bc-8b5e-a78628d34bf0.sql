-- Tabela: exame_parametros
CREATE TABLE public.exame_parametros (
  id BIGSERIAL PRIMARY KEY,
  exame_id UUID NOT NULL REFERENCES public.exames_catalogo(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'Texto',
  rotulo TEXT NOT NULL,
  chave TEXT NOT NULL,
  abreviacao TEXT NOT NULL DEFAULT '',
  qtd_caracteres TEXT NOT NULL DEFAULT '',
  chave_apoio TEXT NOT NULL DEFAULT '',
  exibir_anterior TEXT NOT NULL DEFAULT '',
  exibir_mapa TEXT NOT NULL DEFAULT '',
  obrigatorio TEXT NOT NULL DEFAULT '',
  valor_referencia TEXT NOT NULL DEFAULT '',
  visivel BOOLEAN NOT NULL DEFAULT TRUE,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_exame_parametros_exame_id ON public.exame_parametros(exame_id);

ALTER TABLE public.exame_parametros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Visualizar parametros autenticado"
  ON public.exame_parametros FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Criar parametros via permissao"
  ON public.exame_parametros FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'gestao_exames') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Editar parametros via permissao"
  ON public.exame_parametros FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'gestao_exames') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_permission(auth.uid(), 'gestao_exames') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Excluir parametros via permissao"
  ON public.exame_parametros FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'gestao_exames') OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER touch_exame_parametros_updated_at
  BEFORE UPDATE ON public.exame_parametros
  FOR EACH ROW EXECUTE FUNCTION public.touch_app_settings_updated_at();

-- Tabela: exame_layouts
CREATE TABLE public.exame_layouts (
  id BIGSERIAL PRIMARY KEY,
  exame_id UUID NOT NULL REFERENCES public.exames_catalogo(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  conteudo TEXT NOT NULL DEFAULT '',
  padrao BOOLEAN NOT NULL DEFAULT FALSE,
  criado_por TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_exame_layouts_exame_id ON public.exame_layouts(exame_id);

-- Apenas um layout padrão por exame
CREATE UNIQUE INDEX idx_exame_layouts_padrao_unico
  ON public.exame_layouts(exame_id)
  WHERE padrao = TRUE;

ALTER TABLE public.exame_layouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Visualizar layouts autenticado"
  ON public.exame_layouts FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Criar layouts via permissao"
  ON public.exame_layouts FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'gestao_exames') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Editar layouts via permissao"
  ON public.exame_layouts FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'gestao_exames') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_permission(auth.uid(), 'gestao_exames') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Excluir layouts via permissao"
  ON public.exame_layouts FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'gestao_exames') OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER touch_exame_layouts_updated_at
  BEFORE UPDATE ON public.exame_layouts
  FOR EACH ROW EXECUTE FUNCTION public.touch_app_settings_updated_at();