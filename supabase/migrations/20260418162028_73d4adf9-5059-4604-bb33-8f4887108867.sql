-- Tabela de Estados (UFs do Brasil)
CREATE TABLE public.states (
  id smallint PRIMARY KEY,
  name text NOT NULL,
  uf char(2) NOT NULL UNIQUE
);

-- Tabela de Cidades (municípios IBGE)
CREATE TABLE public.cities (
  id bigint PRIMARY KEY,
  code_ibge text NOT NULL UNIQUE,
  name text NOT NULL,
  uf_id smallint NOT NULL REFERENCES public.states(id) ON DELETE CASCADE
);

CREATE INDEX idx_cities_uf_id ON public.cities(uf_id);
CREATE INDEX idx_cities_name_lower ON public.cities(lower(name));
CREATE INDEX idx_cities_uf_id_name ON public.cities(uf_id, name);

-- RLS: leitura pública (dados de referência), sem escrita
ALTER TABLE public.states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "states_public_read" ON public.states
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "cities_public_read" ON public.cities
  FOR SELECT TO anon, authenticated USING (true);
