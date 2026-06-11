CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Service role / edge functions privilegiadas: auth.uid() é NULL.
  -- Nesses contextos a chamada já passou por validação de admin no
  -- edge function (via SUPABASE_SERVICE_ROLE_KEY), então liberamos.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Admin de tenant ou super_admin podem alterar tudo.
  IF public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Demais usuários: reverte campos privilegiados.
  IF NEW.perfil               IS DISTINCT FROM OLD.perfil
     OR NEW.unidade_ids       IS DISTINCT FROM OLD.unidade_ids
     OR NEW.permissoes_extras IS DISTINCT FROM OLD.permissoes_extras
     OR NEW.permissoes_revogadas IS DISTINCT FROM OLD.permissoes_revogadas
     OR NEW.status            IS DISTINCT FROM OLD.status
     OR NEW.email             IS DISTINCT FROM OLD.email
  THEN
    NEW.perfil               := OLD.perfil;
    NEW.unidade_ids          := OLD.unidade_ids;
    NEW.permissoes_extras    := OLD.permissoes_extras;
    NEW.permissoes_revogadas := OLD.permissoes_revogadas;
    NEW.status               := OLD.status;
    NEW.email                := OLD.email;
  END IF;
  RETURN NEW;
END;
$function$;