
-- Onda A: sincronização automática tenants.status ↔ tenant_registry.runtime_status
CREATE OR REPLACE FUNCTION public.sync_tenant_registry_runtime_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_runtime text;
BEGIN
  -- Mapeia status operacional → runtime_status do control-plane
  IF NEW.status = 'ativo' THEN
    v_runtime := 'active';
  ELSIF NEW.status IN ('suspenso', 'inativo', 'cancelado') THEN
    v_runtime := 'suspended';
  ELSE
    v_runtime := 'active';
  END IF;

  UPDATE public.tenant_registry
     SET runtime_status = v_runtime,
         updated_at = now()
   WHERE tenant_id = NEW.id
     AND runtime_status IS DISTINCT FROM v_runtime;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_tenant_registry_runtime_status ON public.tenants;
CREATE TRIGGER trg_sync_tenant_registry_runtime_status
AFTER INSERT OR UPDATE OF status ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.sync_tenant_registry_runtime_status();

-- Backfill imediato: alinha registros existentes
UPDATE public.tenant_registry r
   SET runtime_status = CASE
         WHEN t.status = 'ativo' THEN 'active'
         WHEN t.status IN ('suspenso','inativo','cancelado') THEN 'suspended'
         ELSE 'active'
       END,
       updated_at = now()
  FROM public.tenants t
 WHERE r.tenant_id = t.id
   AND r.runtime_status IS DISTINCT FROM CASE
         WHEN t.status = 'ativo' THEN 'active'
         WHEN t.status IN ('suspenso','inativo','cancelado') THEN 'suspended'
         ELSE 'active'
       END;
