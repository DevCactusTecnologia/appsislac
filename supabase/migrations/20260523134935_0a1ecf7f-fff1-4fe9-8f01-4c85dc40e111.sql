
CREATE OR REPLACE FUNCTION public.bootstrap_set_cron_secret(p_value text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM vault.secrets WHERE name = 'cron_secret';
  IF v_id IS NULL THEN
    v_id := vault.create_secret(p_value, 'cron_secret', 'Shared secret for internal cron -> edge function auth');
  ELSE
    PERFORM vault.update_secret(v_id, p_value, 'cron_secret', 'Shared secret for internal cron -> edge function auth');
  END IF;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_set_cron_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_set_cron_secret(text) TO service_role;
