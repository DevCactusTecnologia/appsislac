CREATE OR REPLACE FUNCTION public.update_own_tenant_site_config(
  p_slug text,
  p_dominio_custom text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid := current_tenant_id();
  v_uid uuid := auth.uid();
  v_is_admin boolean;
  v_existing uuid;
  v_slug text := nullif(btrim(lower(p_slug)), '');
  v_dominio text := nullif(btrim(lower(p_dominio_custom)), '');
  v_old_dominio text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'no_tenant';
  END IF;

  -- Permite super_admin OU admin do tenant
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_uid
      AND role IN ('super_admin','admin')
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Valida slug
  IF v_slug IS NOT NULL THEN
    IF length(v_slug) < 3 THEN
      RAISE EXCEPTION 'slug_invalid_length';
    END IF;
    IF v_slug !~ '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$' THEN
      RAISE EXCEPTION 'slug_invalid_format';
    END IF;
    IF v_slug IN ('admin','api','app','www','site','login','signup','dashboard','super-admin','assets','public','static','auth','sislac') THEN
      RAISE EXCEPTION 'slug_reserved';
    END IF;
    SELECT id INTO v_existing FROM public.tenants WHERE slug = v_slug;
    IF v_existing IS NOT NULL AND v_existing <> v_tenant THEN
      RAISE EXCEPTION 'slug_taken';
    END IF;
  END IF;

  SELECT dominio_custom INTO v_old_dominio FROM public.tenants WHERE id = v_tenant;

  UPDATE public.tenants
     SET slug = v_slug,
         dominio_custom = v_dominio,
         dominio_verificado = CASE
           WHEN v_dominio IS DISTINCT FROM v_old_dominio THEN false
           ELSE dominio_verificado
         END,
         updated_at = now()
   WHERE id = v_tenant;
END;
$$;

REVOKE ALL ON FUNCTION public.update_own_tenant_site_config(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_own_tenant_site_config(text, text) TO authenticated;