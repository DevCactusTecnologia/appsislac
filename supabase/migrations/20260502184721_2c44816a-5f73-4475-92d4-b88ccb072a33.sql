-- current_tenant_feature_flags é seguro para qualquer chamador:
-- retorna {} quando não há tenant, e feature_flags é metadado não-sensível.
GRANT EXECUTE ON FUNCTION public.current_tenant_feature_flags() TO anon;