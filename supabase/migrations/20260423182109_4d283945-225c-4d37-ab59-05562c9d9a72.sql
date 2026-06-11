-- 1. Adiciona colunas (nullable inicialmente)
ALTER TABLE public.atendimento_exames
  ADD COLUMN IF NOT EXISTS amostra_seq integer,
  ADD COLUMN IF NOT EXISTS grupo_exame_id uuid;

-- 2. Backfill com ROW_NUMBER: cada duplicata recebe seq incremental
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY atendimento_id, COALESCE(exame_id::text, lower(nome_exame))
           ORDER BY ordem, id
         ) AS rn
  FROM public.atendimento_exames
  WHERE amostra_seq IS NULL
)
UPDATE public.atendimento_exames ae
SET amostra_seq = ranked.rn
FROM ranked
WHERE ae.id = ranked.id;

-- 3. Backfill grupo_exame_id: mesmo grupo para mesma combinação (atendimento, exame)
WITH grupos AS (
  SELECT atendimento_id,
         COALESCE(exame_id::text, lower(nome_exame)) AS chave_exame,
         gen_random_uuid() AS gid
  FROM public.atendimento_exames
  WHERE grupo_exame_id IS NULL
  GROUP BY atendimento_id, COALESCE(exame_id::text, lower(nome_exame))
)
UPDATE public.atendimento_exames ae
SET grupo_exame_id = g.gid
FROM grupos g
WHERE ae.atendimento_id = g.atendimento_id
  AND COALESCE(ae.exame_id::text, lower(ae.nome_exame)) = g.chave_exame
  AND ae.grupo_exame_id IS NULL;

-- 4. Defaults e NOT NULL
ALTER TABLE public.atendimento_exames
  ALTER COLUMN amostra_seq SET DEFAULT 1,
  ALTER COLUMN amostra_seq SET NOT NULL,
  ALTER COLUMN grupo_exame_id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN grupo_exame_id SET NOT NULL;

-- 5. Unicidade
CREATE UNIQUE INDEX IF NOT EXISTS atendimento_exames_unico_amostra
  ON public.atendimento_exames (atendimento_id, COALESCE(exame_id::text, lower(nome_exame)), amostra_seq);

-- 6. Índice de grupo
CREATE INDEX IF NOT EXISTS atendimento_exames_grupo_idx
  ON public.atendimento_exames (atendimento_id, grupo_exame_id);

-- 7. Função: próximo amostra_seq
CREATE OR REPLACE FUNCTION public.proxima_amostra_seq(
  _atendimento_id bigint,
  _exame_id uuid,
  _nome_exame text
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(MAX(amostra_seq), 0) + 1
  FROM public.atendimento_exames
  WHERE atendimento_id = _atendimento_id
    AND (
      (_exame_id IS NOT NULL AND exame_id = _exame_id)
      OR (_exame_id IS NULL AND lower(nome_exame) = lower(_nome_exame))
    );
$$;

-- 8. Função: grupo_exame_id (reutiliza ou novo)
CREATE OR REPLACE FUNCTION public.grupo_exame_para(
  _atendimento_id bigint,
  _exame_id uuid,
  _nome_exame text
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT grupo_exame_id
     FROM public.atendimento_exames
     WHERE atendimento_id = _atendimento_id
       AND (
         (_exame_id IS NOT NULL AND exame_id = _exame_id)
         OR (_exame_id IS NULL AND lower(nome_exame) = lower(_nome_exame))
       )
     ORDER BY amostra_seq ASC
     LIMIT 1),
    gen_random_uuid()
  );
$$;