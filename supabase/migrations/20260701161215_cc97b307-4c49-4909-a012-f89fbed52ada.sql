CREATE OR REPLACE FUNCTION public.super_admin_dump_auth_users(_tenant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  users_out jsonb;
  roles_out jsonb;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'id', u.id,
    'email', u.email,
    'encrypted_password', u.encrypted_password,
    'email_confirmed_at', u.email_confirmed_at,
    'raw_user_meta_data', u.raw_user_meta_data,
    'raw_app_meta_data', u.raw_app_meta_data,
    'created_at', u.created_at,
    'updated_at', u.updated_at
  ))
    INTO users_out
    FROM auth.users u
   WHERE u.id IN (SELECT id FROM public.profiles WHERE tenant_id = _tenant_id);

  SELECT jsonb_agg(jsonb_build_object(
    'user_id', ur.user_id,
    'role', ur.role,
    'tenant_id', _tenant_id
  ))
    INTO roles_out
    FROM public.user_roles ur
   WHERE ur.user_id IN (SELECT id FROM public.profiles WHERE tenant_id = _tenant_id);

  RETURN jsonb_build_object(
    'users', coalesce(users_out,'[]'::jsonb),
    'roles', coalesce(roles_out,'[]'::jsonb)
  );
END $function$;