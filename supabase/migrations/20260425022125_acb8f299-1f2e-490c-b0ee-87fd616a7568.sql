-- Função idempotente que garante as formas de pagamento padrão para um tenant.
-- Reutilizável tanto no fluxo de criação de novos tenants quanto em backfill.
CREATE OR REPLACE FUNCTION public.seed_default_formas_pagamento_for_tenant(_tenant_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _count integer;
BEGIN
  INSERT INTO public.financeiro_formas_pagamento (tenant_id, nome, sistema, ativo, ordem)
  VALUES
    (_tenant_id, 'Dinheiro',           true, true, 1),
    (_tenant_id, 'PIX',                true, true, 2),
    (_tenant_id, 'Cartão de Débito',  true, true, 3),
    (_tenant_id, 'Cartão de Crédito', true, true, 4)
  ON CONFLICT (tenant_id, nome) DO NOTHING;
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$function$;

-- Backfill: aplica a rotina em todos os tenants existentes (idempotente).
DO $$
DECLARE
  t_id uuid;
BEGIN
  FOR t_id IN SELECT id FROM public.tenants LOOP
    PERFORM public.seed_default_formas_pagamento_for_tenant(t_id);
  END LOOP;
END $$;