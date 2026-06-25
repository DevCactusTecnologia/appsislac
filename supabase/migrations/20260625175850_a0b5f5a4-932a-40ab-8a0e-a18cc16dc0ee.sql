
ALTER TABLE public.valores_referencia
  ADD COLUMN IF NOT EXISTS exame_id uuid,
  ADD COLUMN IF NOT EXISTS parametro_id bigint;

UPDATE public.valores_referencia vr
SET exame_id = ec.id
FROM public.exames_catalogo ec
WHERE vr.exame_id IS NULL
  AND ec.tenant_id = vr.tenant_id
  AND lower(ec.nome) = lower(vr.exame_nome);

UPDATE public.valores_referencia vr
SET parametro_id = ep.id
FROM public.exame_parametros ep
WHERE vr.parametro_id IS NULL
  AND ep.tenant_id = vr.tenant_id
  AND ep.exame_id = vr.exame_id
  AND (
    lower(ep.rotulo) = lower(vr.parametro_nome)
    OR lower(ep.chave) = lower(vr.parametro_nome)
    OR lower(ep.abreviacao) = lower(vr.parametro_nome)
  );

ALTER TABLE public.valores_referencia
  ADD CONSTRAINT valores_referencia_exame_fk
    FOREIGN KEY (exame_id) REFERENCES public.exames_catalogo(id) ON DELETE CASCADE,
  ADD CONSTRAINT valores_referencia_parametro_fk
    FOREIGN KEY (parametro_id) REFERENCES public.exame_parametros(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_valores_referencia_parametro_id
  ON public.valores_referencia(parametro_id);
CREATE INDEX IF NOT EXISTS idx_valores_referencia_exame_parametro
  ON public.valores_referencia(exame_id, parametro_id);
