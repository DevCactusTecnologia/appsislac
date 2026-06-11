-- Cadastro de exames — expansão de campos
ALTER TABLE public.exames_catalogo
  -- Pré-analítico
  ADD COLUMN IF NOT EXISTS temperatura_transporte text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS protegido_luz boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS observacoes_coleta text NOT NULL DEFAULT '',
  -- Integração / Apoio
  ADD COLUMN IF NOT EXISTS provider_integracao text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS codigo_exame_apoio text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS permite_envio_apoio boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS exige_protocolo_externo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prazo_apoio_dias integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS material_apoio text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS recipiente_apoio text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS volume_apoio_ml numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS preparo_apoio text NOT NULL DEFAULT '',
  -- Resultado / Laudo
  ADD COLUMN IF NOT EXISTS texto_interpretativo_padrao text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS exibir_metodologia_laudo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS exibir_unidade_laudo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS exibir_material_laudo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS template_laudo_id uuid NULL,
  ADD COLUMN IF NOT EXISTS grupo_impressao text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ordem_impressao integer NOT NULL DEFAULT 0,
  -- Operacional avançado
  ADD COLUMN IF NOT EXISTS idade_minima_meses integer NULL,
  ADD COLUMN IF NOT EXISTS idade_maxima_meses integer NULL,
  ADD COLUMN IF NOT EXISTS urgencia_padrao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS ordem_coleta integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ordem_setor integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS exame_calculado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS exame_oculto boolean NOT NULL DEFAULT false;

-- Índices úteis (lookup por código de apoio + ordenação no laudo)
CREATE INDEX IF NOT EXISTS idx_exames_catalogo_codigo_apoio
  ON public.exames_catalogo (tenant_id, codigo_exame_apoio)
  WHERE codigo_exame_apoio <> '';

CREATE INDEX IF NOT EXISTS idx_exames_catalogo_grupo_impressao
  ON public.exames_catalogo (tenant_id, grupo_impressao, ordem_impressao)
  WHERE grupo_impressao <> '';

CREATE INDEX IF NOT EXISTS idx_exames_catalogo_tags
  ON public.exames_catalogo USING GIN (tags);