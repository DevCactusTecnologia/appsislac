
-- Normaliza tokens ##TOKEN## em exame_layouts cujos exames são INTERNO.
-- Caso 1: padrão já parcialmente courier (## em courier, miolo em <strong> simples)
UPDATE public.exame_layouts el
SET conteudo = regexp_replace(
  conteudo,
  '<span style="font-family:Courier,monospace;font-size:12px;"><strong>##</strong></span><strong>([A-Za-z0-9_+\-.]+)</strong><span style="font-family:Courier,monospace;font-size:12px;"><strong>##</strong></span>',
  '<span style="font-family:Courier,monospace;font-size:12px;"><strong>##\1##</strong></span>',
  'g'
)
WHERE exame_id IN (SELECT id FROM public.exames_catalogo WHERE tipo_processo = 'INTERNO');

-- Caso 2: tokens ainda completamente sem formatação ##TOKEN## texto puro
UPDATE public.exame_layouts el
SET conteudo = regexp_replace(
  conteudo,
  '##([A-Za-z0-9_+\-.]+)##',
  '<span style="font-family:Courier,monospace;font-size:12px;"><strong>##\1##</strong></span>',
  'g'
)
WHERE exame_id IN (SELECT id FROM public.exames_catalogo WHERE tipo_processo = 'INTERNO')
  AND conteudo ~ '(^|[^>])##[A-Za-z0-9_+\-.]+##';
