
-- =========================================================
-- P1-3: Remover policies duplicadas em storage.objects
--   (mantém apenas as policies "tenant admin" com role check
--    e a policy de SELECT pública intencional)
-- =========================================================
DROP POLICY IF EXISTS tenant_assets_select ON storage.objects;
DROP POLICY IF EXISTS tenant_assets_insert ON storage.objects;
DROP POLICY IF EXISTS tenant_assets_update ON storage.objects;
DROP POLICY IF EXISTS tenant_assets_delete ON storage.objects;

-- =========================================================
-- P1-4: Restringir EXECUTE em funções SECURITY DEFINER
--   - Revoga de anon/public em massa
--   - Mantém validate_protocolo_* acessível a anon (uso público)
--   - Concede a authenticated/service_role explicitamente
-- =========================================================
DO $$
DECLARE
  r record;
  sig text;
  -- funções que DEVEM continuar acessíveis publicamente (anon)
  public_fns text[] := ARRAY[
    'validate_protocolo_atendimento',
    'validate_protocolo_orcamento',
    'validate_protocolo_fatura',
    'validate_protocolo_saida'
  ];
BEGIN
  FOR r IN
    SELECT p.oid,
           p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
  LOOP
    sig := format('public.%I(%s)', r.proname, r.args);

    -- Revoga de todos
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', sig);

    -- Concede a service_role sempre
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', sig);

    -- Concede a authenticated por padrão (necessário p/ RPC do app)
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', sig);

    -- Reabre para anon apenas as funções de validação pública
    IF r.proname = ANY(public_fns) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon', sig);
    END IF;
  END LOOP;
END
$$;
