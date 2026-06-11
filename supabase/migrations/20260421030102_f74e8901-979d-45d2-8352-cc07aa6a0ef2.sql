-- Função que copia os mapas de trabalho "padrão" (do tenant Demo)
-- para um novo tenant. Idempotente: não duplica mapas com o mesmo nome.
CREATE OR REPLACE FUNCTION public.seed_default_mapas_for_tenant(_tenant_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _template_tenant uuid := '00000000-0000-0000-0000-000000000001';
  _inserted integer := 0;
BEGIN
  IF _tenant_id IS NULL OR _tenant_id = _template_tenant THEN
    RETURN 0;
  END IF;

  INSERT INTO public.mapas_trabalho (
    tenant_id, nome, descricao, tipo, template_key,
    conteudo, placeholders_usados, config, ativo, criado_por
  )
  SELECT
    _tenant_id, m.nome, m.descricao, m.tipo, m.template_key,
    m.conteudo, m.placeholders_usados, m.config, m.ativo, 'system-seed'
  FROM public.mapas_trabalho m
  WHERE m.tenant_id = _template_tenant
    AND NOT EXISTS (
      SELECT 1 FROM public.mapas_trabalho x
      WHERE x.tenant_id = _tenant_id AND x.nome = m.nome
    );

  GET DIAGNOSTICS _inserted = ROW_COUNT;
  RETURN _inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_default_mapas_for_tenant(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_default_mapas_for_tenant(uuid) TO service_role;