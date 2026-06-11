-- Alinha o código humano do control-plane com o código operacional legado
-- quando ele já existe em public.tenants.codigo (ex.: Laboratório Demo = 1234).

ALTER TABLE public.tenant_registry DISABLE TRIGGER trg_tenant_registry_lab_code_guard;

UPDATE public.tenant_registry tr
SET lab_code = upper(regexp_replace(t.codigo, '[^A-Za-z0-9]', '', 'g'))
FROM public.tenants t
WHERE tr.tenant_id = t.id
  AND t.codigo IS NOT NULL
  AND btrim(t.codigo) <> ''
  AND tr.lab_code IS DISTINCT FROM upper(regexp_replace(t.codigo, '[^A-Za-z0-9]', '', 'g'))
  AND NOT EXISTS (
    SELECT 1
    FROM public.tenant_registry other
    WHERE other.tenant_id <> tr.tenant_id
      AND other.lab_code = upper(regexp_replace(t.codigo, '[^A-Za-z0-9]', '', 'g'))
  );

ALTER TABLE public.tenant_registry ENABLE TRIGGER trg_tenant_registry_lab_code_guard;