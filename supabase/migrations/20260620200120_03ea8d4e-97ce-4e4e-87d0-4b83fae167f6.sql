UPDATE public.exame_layouts
SET conteudo = regexp_replace(conteudo, 'font-family\s*:\s*[^;"'']+', 'font-family:Courier,monospace', 'gi')
WHERE conteudo ~* 'font-family\s*:';

UPDATE public.exame_layouts
SET conteudo = replace(conteudo, 'Courier New', 'Courier')
WHERE conteudo LIKE '%Courier New%';