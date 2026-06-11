CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  tid uuid;
BEGIN
  IF uid IS NULL THEN
    RETURN '00000000-0000-0000-0000-000000000001'::uuid;
  END IF;
  SELECT tenant_id INTO tid FROM public.profiles WHERE user_id = uid LIMIT 1;
  IF tid IS NULL THEN
    RETURN '00000000-0000-0000-0000-000000000001'::uuid;
  END IF;
  RETURN tid;
END; $function$;