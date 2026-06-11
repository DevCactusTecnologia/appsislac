
-- 1) Coluna legacy_id em select_options
ALTER TABLE public.select_options
  ADD COLUMN IF NOT EXISTS legacy_id uuid;

CREATE INDEX IF NOT EXISTS idx_select_options_categoria_legacy
  ON public.select_options (categoria, legacy_id);

-- 2) Backfill (match por tenant + valor=nome dentro de cada categoria)
UPDATE public.select_options so
   SET legacy_id = m.id
  FROM public.motivos_cancelamento m
 WHERE so.categoria = 'motivo_cancelamento'
   AND so.tenant_id IS NOT DISTINCT FROM m.tenant_id
   AND so.valor = m.nome
   AND so.legacy_id IS DISTINCT FROM m.id;

UPDATE public.select_options so
   SET legacy_id = r.id
  FROM public.recoletas_motivos r
 WHERE so.categoria = 'recoleta_motivo'
   AND so.tenant_id IS NOT DISTINCT FROM r.tenant_id
   AND so.valor = r.nome
   AND so.legacy_id IS DISTINCT FROM r.id;

UPDATE public.select_options so
   SET legacy_id = f.id
  FROM public.financeiro_formas_pagamento f
 WHERE so.categoria = 'financeiro_forma_pagamento'
   AND so.tenant_id IS NOT DISTINCT FROM f.tenant_id
   AND so.valor = f.nome
   AND so.legacy_id IS DISTINCT FROM f.id;

UPDATE public.select_options so
   SET legacy_id = f.id
  FROM public.financeiro_destinos_pagamento f
 WHERE so.categoria = 'financeiro_destino_pagamento'
   AND so.tenant_id IS NOT DISTINCT FROM f.tenant_id
   AND so.valor = f.nome
   AND so.legacy_id IS DISTINCT FROM f.id;

UPDATE public.select_options so
   SET legacy_id = f.id
  FROM public.financeiro_tipos_despesa f
 WHERE so.categoria = 'financeiro_tipo_despesa'
   AND so.tenant_id IS NOT DISTINCT FROM f.tenant_id
   AND so.valor = f.nome
   AND so.legacy_id IS DISTINCT FROM f.id;

-- 3) Atualizar função forwarder para incluir legacy_id
CREATE OR REPLACE FUNCTION public.fwd_legacy_dict_to_select_options()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cat       text  := TG_ARGV[0];
  j_new       jsonb := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
  j_old       jsonb := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
  v_tenant    uuid;
  v_nome      text;
  v_ordem     int;
  v_legacy_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_legacy_id := (j_old ->> 'id')::uuid;
    DELETE FROM public.select_options
     WHERE categoria = v_cat
       AND legacy_id = v_legacy_id;
    RETURN OLD;
  END IF;

  v_tenant    := (j_new ->> 'tenant_id')::uuid;
  v_nome      := j_new ->> 'nome';
  v_ordem     := COALESCE(NULLIF(j_new ->> 'ordem','')::int, 0);
  v_legacy_id := (j_new ->> 'id')::uuid;

  -- UPSERT por legacy_id (chave estável); se renomeou, o label/valor segue o nome novo.
  UPDATE public.select_options
     SET valor      = v_nome,
         label      = v_nome,
         ordem      = v_ordem,
         ativo      = COALESCE((j_new ->> 'ativo')::boolean, true),
         sistema    = COALESCE((j_new ->> 'sistema')::boolean, false),
         tenant_id  = v_tenant,
         updated_at = now()
   WHERE categoria = v_cat
     AND legacy_id = v_legacy_id;

  IF NOT FOUND THEN
    INSERT INTO public.select_options
      (tenant_id, categoria, valor, label, ordem, ativo, sistema, legacy_id, created_at, updated_at)
    VALUES (
      v_tenant, v_cat, v_nome, v_nome, v_ordem,
      COALESCE((j_new ->> 'ativo')::boolean, true),
      COALESCE((j_new ->> 'sistema')::boolean, false),
      v_legacy_id,
      now(), now()
    );
  END IF;

  RETURN NEW;
END $function$;

-- 4) Wire triggers nas 5 tabelas legadas (idempotente)
DROP TRIGGER IF EXISTS trg_fwd_motivos_cancelamento ON public.motivos_cancelamento;
CREATE TRIGGER trg_fwd_motivos_cancelamento
AFTER INSERT OR UPDATE OR DELETE ON public.motivos_cancelamento
FOR EACH ROW EXECUTE FUNCTION public.fwd_legacy_dict_to_select_options('motivo_cancelamento');

DROP TRIGGER IF EXISTS trg_fwd_recoletas_motivos ON public.recoletas_motivos;
CREATE TRIGGER trg_fwd_recoletas_motivos
AFTER INSERT OR UPDATE OR DELETE ON public.recoletas_motivos
FOR EACH ROW EXECUTE FUNCTION public.fwd_legacy_dict_to_select_options('recoleta_motivo');

DROP TRIGGER IF EXISTS trg_fwd_financeiro_formas_pagamento ON public.financeiro_formas_pagamento;
CREATE TRIGGER trg_fwd_financeiro_formas_pagamento
AFTER INSERT OR UPDATE OR DELETE ON public.financeiro_formas_pagamento
FOR EACH ROW EXECUTE FUNCTION public.fwd_legacy_dict_to_select_options('financeiro_forma_pagamento');

DROP TRIGGER IF EXISTS trg_fwd_financeiro_destinos_pagamento ON public.financeiro_destinos_pagamento;
CREATE TRIGGER trg_fwd_financeiro_destinos_pagamento
AFTER INSERT OR UPDATE OR DELETE ON public.financeiro_destinos_pagamento
FOR EACH ROW EXECUTE FUNCTION public.fwd_legacy_dict_to_select_options('financeiro_destino_pagamento');

DROP TRIGGER IF EXISTS trg_fwd_financeiro_tipos_despesa ON public.financeiro_tipos_despesa;
CREATE TRIGGER trg_fwd_financeiro_tipos_despesa
AFTER INSERT OR UPDATE OR DELETE ON public.financeiro_tipos_despesa
FOR EACH ROW EXECUTE FUNCTION public.fwd_legacy_dict_to_select_options('financeiro_tipo_despesa');
