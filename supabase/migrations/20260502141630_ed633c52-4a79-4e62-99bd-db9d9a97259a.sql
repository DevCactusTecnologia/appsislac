REVOKE EXECUTE ON FUNCTION public.atendimentos_kpis(text,text,text,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.atendimentos_page(text,text,text,text,timestamptz,bigint,int) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_tenant_feature_flags() FROM PUBLIC, anon;