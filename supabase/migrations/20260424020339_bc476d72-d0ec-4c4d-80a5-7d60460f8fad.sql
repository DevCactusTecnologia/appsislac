-- ============================================================
-- P0: app_settings — PK composta (tenant_id, key)
-- ============================================================
-- Antes: PRIMARY KEY (key)  → tenants compartilhavam linhas!
-- Agora: PRIMARY KEY (tenant_id, key)

ALTER TABLE public.app_settings
  DROP CONSTRAINT IF EXISTS app_settings_pkey;

ALTER TABLE public.app_settings
  ADD CONSTRAINT app_settings_pkey PRIMARY KEY (tenant_id, key);

-- Índice auxiliar para lookups por key isolada (raro, mas usado em manutenção)
CREATE INDEX IF NOT EXISTS idx_app_settings_key
  ON public.app_settings(key);

-- ============================================================
-- HMAC por tenant — garantir geração automática
-- ============================================================
CREATE OR REPLACE FUNCTION public.ensure_tenant_hmac_key(_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
BEGIN
  SELECT (value #>> '{}') INTO v_key
  FROM public.app_settings
  WHERE tenant_id = _tenant_id AND key = 'protocolo_hmac_key';

  IF v_key IS NULL OR length(v_key) < 32 THEN
    v_key := encode(gen_random_bytes(32), 'hex');
    INSERT INTO public.app_settings(tenant_id, key, value)
    VALUES (_tenant_id, 'protocolo_hmac_key', to_jsonb(v_key))
    ON CONFLICT (tenant_id, key) DO UPDATE SET value = EXCLUDED.value;
  END IF;

  RETURN v_key;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_tenant_hmac_key(uuid) FROM public, anon, authenticated;