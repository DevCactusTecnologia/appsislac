UPDATE public.documento_templates
SET conteudo = regexp_replace(
  conteudo,
  '(style="[^"]*)border-(top|bottom)\s*:\s*[^;"]+;?\s*([^"]*")',
  '\1\3',
  'gi'
)
WHERE conteudo ~* 'border-(top|bottom)\s*:';
