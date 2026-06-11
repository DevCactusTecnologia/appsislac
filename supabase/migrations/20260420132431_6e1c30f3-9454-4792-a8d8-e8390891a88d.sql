-- Remove duplicatas mantendo apenas o vínculo mais recente por exame
DELETE FROM public.mapa_exames me
USING public.mapa_exames me2
WHERE me.exame_id = me2.exame_id
  AND me.tenant_id = me2.tenant_id
  AND me.created_at < me2.created_at;

-- Cria constraint UNIQUE garantindo que um exame só pode estar em UM mapa
ALTER TABLE public.mapa_exames
  ADD CONSTRAINT mapa_exames_exame_id_unique UNIQUE (exame_id);