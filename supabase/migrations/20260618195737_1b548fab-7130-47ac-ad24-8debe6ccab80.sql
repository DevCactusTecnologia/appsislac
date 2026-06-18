CREATE OR REPLACE FUNCTION public.fwd_app_settings_audit_to_platform()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.platform_audit (ator_id, recurso_tipo, recurso_id, acao, contexto, created_at)
  VALUES (NEW.changed_by, 'settings', NEW.key, NEW.operation,
          jsonb_build_object('old_value', NEW.old_value, 'new_value', NEW.new_value),
          NEW.changed_at);
  RETURN NEW;
END $function$;