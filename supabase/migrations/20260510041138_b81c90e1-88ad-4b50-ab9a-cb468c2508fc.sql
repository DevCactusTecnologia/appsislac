
ALTER TABLE public.mapas_trabalho
  ADD COLUMN IF NOT EXISTS is_catch_all boolean NOT NULL DEFAULT false;

-- Backfill via NFD-normalize manual (sem extensão unaccent)
UPDATE public.mapas_trabalho
   SET is_catch_all = true
 WHERE tipo = 'LOTE'
   AND (
     lower(translate(nome,
       'ÁÀÂÃÄÅáàâãäåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
       'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
     )) LIKE 'mapa padrao%'
     OR lower(translate(nome,
       'ÁÀÂÃÄÅáàâãäåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
       'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
     )) LIKE 'mapa do analista%'
   );

CREATE UNIQUE INDEX IF NOT EXISTS uq_mapas_trabalho_catch_all_per_tenant
  ON public.mapas_trabalho (tenant_id)
  WHERE is_catch_all = true;

ALTER TABLE public.mapas_trabalho DROP CONSTRAINT IF EXISTS mapas_trabalho_tipo_check;
ALTER TABLE public.mapas_trabalho
  ADD CONSTRAINT mapas_trabalho_tipo_check
  CHECK (tipo = ANY (ARRAY['INDIVIDUAL'::text, 'LOTE'::text]));
