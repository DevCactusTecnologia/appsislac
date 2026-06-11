-- Limpa perfis órfãos (sem auth.users correspondente) e impede que voltem a existir.

-- 1) Apaga user_roles e profiles órfãos
DELETE FROM public.user_roles ur
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = ur.user_id);

DELETE FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.user_id);

-- 2) Trigger de validação: profile.user_id deve referenciar auth.users
CREATE OR REPLACE FUNCTION public.profiles_require_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = NEW.user_id) THEN
    RAISE EXCEPTION 'profiles.user_id % não existe em auth.users', NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_require_auth_user_trg ON public.profiles;
CREATE TRIGGER profiles_require_auth_user_trg
BEFORE INSERT OR UPDATE OF user_id ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.profiles_require_auth_user();

-- 3) Limpeza automática quando auth.users for deletado
CREATE OR REPLACE FUNCTION public.handle_auth_user_deleted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.user_roles WHERE user_id = OLD.id;
  DELETE FROM public.profiles WHERE user_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted
AFTER DELETE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_auth_user_deleted();