WITH expanded AS (
  SELECT
    ep.id,
    btrim(part) AS opt,
    (elem_ord - 1) * 1000 + part_ord AS pos
  FROM public.exame_parametros ep
  CROSS JOIN LATERAL unnest(ep.opcoes_select) WITH ORDINALITY AS e(elem, elem_ord)
  CROSS JOIN LATERAL regexp_split_to_table(e.elem, '\s*,\s*') WITH ORDINALITY AS p(part, part_ord)
  WHERE ep.tipo = 'Select'
    AND ep.opcoes_select IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM unnest(ep.opcoes_select) AS x WHERE x LIKE '%,%'
    )
    AND btrim(part) <> ''
),
dedup AS (
  SELECT id, opt, MIN(pos) AS pos
  FROM expanded
  GROUP BY id, opt
),
ordered AS (
  SELECT id, ARRAY_AGG(opt ORDER BY pos) AS arr
  FROM dedup
  GROUP BY id
)
UPDATE public.exame_parametros ep
SET opcoes_select = o.arr
FROM ordered o
WHERE ep.id = o.id;