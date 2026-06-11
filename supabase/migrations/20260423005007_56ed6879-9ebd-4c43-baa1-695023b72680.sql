-- Adiciona colunas para migração de arquitetura do editor de mapas
ALTER TABLE public.mapas_trabalho 
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'legacy_html',
ADD COLUMN IF NOT EXISTS layout_json JSONB DEFAULT '{}'::jsonb;

-- Comentário para documentação
COMMENT ON COLUMN public.mapas_trabalho.source IS 'Origem do conteúdo: legacy_html (TipTap antigo) ou visual_builder (novo editor estruturado)';
COMMENT ON COLUMN public.mapas_trabalho.layout_json IS 'Estrutura de dados do novo editor visual (JSON)';
