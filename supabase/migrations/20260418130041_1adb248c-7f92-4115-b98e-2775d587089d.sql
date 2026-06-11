
-- Adiciona campos para padrão LIS (Laboratory Information System)
ALTER TABLE public.exames_catalogo
  -- Códigos regulatórios adicionais
  ADD COLUMN IF NOT EXISTS porte_cbhpm text NOT NULL DEFAULT '-',
  ADD COLUMN IF NOT EXISTS codigo_loinc text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS codigo_sus text NOT NULL DEFAULT '',
  -- Analítico
  ADD COLUMN IF NOT EXISTS metodologia text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS prazo_entrega_dias integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS urgencia_disponivel boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prazo_urgencia_horas integer NOT NULL DEFAULT 0,
  -- Pré-analítico estruturado
  ADD COLUMN IF NOT EXISTS recipiente text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cor_tampa text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS volume_minimo_ml numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estabilidade text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS requer_jejum boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS horas_jejum integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS preparo_paciente text NOT NULL DEFAULT '',
  -- Operacional / Etiquetas
  ADD COLUMN IF NOT EXISTS grupo_etiquetas text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS quantidade_etiquetas integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS informacoes_coleta text NOT NULL DEFAULT '',
  -- Operacional avançado
  ADD COLUMN IF NOT EXISTS sinonimos text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sexo_aplicavel text NOT NULL DEFAULT 'AMBOS',
  ADD COLUMN IF NOT EXISTS exibir_portal boolean NOT NULL DEFAULT true,
  -- Pós-analítico
  ADD COLUMN IF NOT EXISTS unidade_padrao text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS requer_assinatura_medica boolean NOT NULL DEFAULT true;

-- Constraints de validação
ALTER TABLE public.exames_catalogo
  DROP CONSTRAINT IF EXISTS exames_catalogo_sexo_aplicavel_check,
  ADD CONSTRAINT exames_catalogo_sexo_aplicavel_check
    CHECK (sexo_aplicavel IN ('AMBOS','MASCULINO','FEMININO'));

ALTER TABLE public.exames_catalogo
  DROP CONSTRAINT IF EXISTS exames_catalogo_quantidade_etiquetas_check,
  ADD CONSTRAINT exames_catalogo_quantidade_etiquetas_check
    CHECK (quantidade_etiquetas >= 1 AND quantidade_etiquetas <= 20);

ALTER TABLE public.exames_catalogo
  DROP CONSTRAINT IF EXISTS exames_catalogo_prazo_entrega_check,
  ADD CONSTRAINT exames_catalogo_prazo_entrega_check
    CHECK (prazo_entrega_dias >= 0 AND prazo_entrega_dias <= 365);

-- Índice para busca por sinônimos
CREATE INDEX IF NOT EXISTS idx_exames_catalogo_sinonimos
  ON public.exames_catalogo USING gin (to_tsvector('portuguese', sinonimos));
