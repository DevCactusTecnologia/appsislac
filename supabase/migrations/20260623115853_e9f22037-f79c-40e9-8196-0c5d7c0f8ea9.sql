-- Exames 2.1 — Sub-fase A: drop 21 colunas mortas (0 consumidores reais)
ALTER TABLE public.exames_catalogo
  DROP COLUMN IF EXISTS exame_calculado,
  DROP COLUMN IF EXISTS exame_oculto,
  DROP COLUMN IF EXISTS tipo_mapa,
  DROP COLUMN IF EXISTS temperatura_transporte,
  DROP COLUMN IF EXISTS protegido_luz,
  DROP COLUMN IF EXISTS observacoes_coleta,
  DROP COLUMN IF EXISTS material_apoio,
  DROP COLUMN IF EXISTS recipiente_apoio,
  DROP COLUMN IF EXISTS volume_apoio_ml,
  DROP COLUMN IF EXISTS preparo_apoio,
  DROP COLUMN IF EXISTS prazo_apoio_dias,
  DROP COLUMN IF EXISTS exige_protocolo_externo,
  DROP COLUMN IF EXISTS idade_minima_meses,
  DROP COLUMN IF EXISTS idade_maxima_meses,
  DROP COLUMN IF EXISTS urgencia_padrao,
  DROP COLUMN IF EXISTS ordem_coleta,
  DROP COLUMN IF EXISTS ordem_setor,
  DROP COLUMN IF EXISTS ordem_impressao,
  DROP COLUMN IF EXISTS grupo_impressao,
  DROP COLUMN IF EXISTS template_laudo_id,
  DROP COLUMN IF EXISTS texto_interpretativo_padrao;

-- Exames 2.1 — Sub-fase B: Interface Engine readiness (todos nullable)
ALTER TABLE public.exames_catalogo
  ADD COLUMN IF NOT EXISTS codigo_interfaceamento text,
  ADD COLUMN IF NOT EXISTS codigo_hl7 text,
  ADD COLUMN IF NOT EXISTS codigo_equipamento jsonb;

COMMENT ON COLUMN public.exames_catalogo.codigo_interfaceamento IS
  'Código interno canônico para integrações (LIS ↔ equipamentos). Único lógico por tenant. Sem validação até Interface Engine ser implementado.';
COMMENT ON COLUMN public.exames_catalogo.codigo_hl7 IS
  'Identificador HL7 OBR para mensageria clínica. Preparação para Interface Engine.';
COMMENT ON COLUMN public.exames_catalogo.codigo_equipamento IS
  'Mapeamento por equipamento. Ex.: {"cobas-c311":"ACUR","alinity-i":"URI-AC"}. Preparação para Interface Engine.';