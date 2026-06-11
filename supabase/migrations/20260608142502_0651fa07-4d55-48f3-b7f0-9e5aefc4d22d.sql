
-- 1. HARDENING: SECURITY DEFINER FUNCTIONS
-- Revoke all execution rights from public for ALL SECURITY DEFINER functions in public schema
DO $$ 
DECLARE 
    func_record RECORD;
BEGIN 
    FOR func_record IN 
        SELECT proname, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND prosecdef = true
    LOOP 
        EXECUTE 'REVOKE ALL ON FUNCTION public.' || quote_ident(func_record.proname) || '(' || func_record.args || ') FROM public, anon, authenticated';
        -- Explicitly grant back to service_role (always needed for internal ops)
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.' || quote_ident(func_record.proname) || '(' || func_record.args || ') TO service_role';
    END LOOP;
END $$;

-- Specifically re-grant to authenticated/anon only the functions that are intended for them, but with care.
-- Most of these functions are used by triggers or internal API calls.
-- If they are called via RPC from the frontend, they need explicit grants.
GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_tenant_feature_flags() TO authenticated;

-- 2. HARDENING: RLS POLICIES (Cross-tenant leaks)

-- exames_catalogo: was "ativo = true" for anon. Now restricted by tenant.
DROP POLICY IF EXISTS exames_catalogo_public_read ON public.exames_catalogo;
CREATE POLICY exames_catalogo_public_read ON public.exames_catalogo 
FOR SELECT TO anon, authenticated
USING (ativo = true AND tenant_id = current_tenant_id());

-- exames_publicos: was "ativo = true" for anon, authenticated.
DROP POLICY IF EXISTS ep_public_read_active ON public.exames_publicos;
CREATE POLICY ep_public_read_active ON public.exames_publicos
FOR SELECT TO anon, authenticated
USING (ativo = true AND tenant_id = current_tenant_id());

-- unidades: was "ativo = true" for anon.
DROP POLICY IF EXISTS unidades_public_read ON public.unidades;
CREATE POLICY unidades_public_read ON public.unidades
FOR SELECT TO anon, authenticated
USING (ativo = true AND tenant_id = current_tenant_id());

-- tenant_settings_public: was "true".
DROP POLICY IF EXISTS tsp_public_read ON public.tenant_settings_public;
CREATE POLICY tsp_public_read ON public.tenant_settings_public
FOR SELECT TO anon, authenticated
USING (tenant_id = current_tenant_id());

-- tabela_preco_itens: (Exam Pricing)
ALTER TABLE public.tabela_preco_itens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tpi_public_read ON public.tabela_preco_itens;
CREATE POLICY tpi_public_read ON public.tabela_preco_itens
FOR SELECT TO anon, authenticated
USING (tenant_id = current_tenant_id());

-- 3. HARDENING: DOCUMENT TEMPLATES (Demo Tenant P0)
-- Remove anon access to modify demo tenant templates
DROP POLICY IF EXISTS doc_templates_demo_anon_insert ON public.documento_templates;
DROP POLICY IF EXISTS doc_templates_demo_anon_update ON public.documento_templates;
DROP POLICY IF EXISTS doc_templates_demo_anon_delete ON public.documento_templates;
-- Keep select if needed for demo, but highly restricted
DROP POLICY IF EXISTS doc_templates_demo_anon_select ON public.documento_templates;
CREATE POLICY doc_templates_demo_anon_select ON public.documento_templates
FOR SELECT TO anon
USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- 4. HARDENING: EXTENSIONS
-- Move extensions to a dedicated schema
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION pg_trgm SET SCHEMA extensions;
-- Ensure search_path for functions includes extensions if needed, but not public by default.
-- We already ensured most S.D. functions have search_path=public. 
-- Let's update them to be safer if they use trgm.

-- 5. HARDENING: SEARCH PATH
-- Re-verify and set search_path for all public S.D. functions to 'public, extensions' (restricted)
DO $$ 
DECLARE 
    func_record RECORD;
BEGIN 
    FOR func_record IN 
        SELECT proname, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND prosecdef = true
    LOOP 
        EXECUTE 'ALTER FUNCTION public.' || quote_ident(func_record.proname) || '(' || func_record.args || ') SET search_path = public, extensions';
    END LOOP;
END $$;

-- 6. HARDENING: REALTIME
-- Realtime is often configured via publications. To secure it, we ensure tables have RLS.
-- Tables in supabase_realtime publication: atendimentos, atendimento_exames, atendimento_pagamentos, solicitacoes_publicas, provider_catalog_import_jobs.
-- We ensure their SELECT policies are strictly tenant-bound.
-- atendimentos was "roles:{public}" which means anon could see it if they passed RLS? 
-- The policy "atend_select" used current_tenant_id(). 
-- But "roles:{public}" includes anon. Let's restrict to authenticated.
ALTER POLICY atend_select ON public.atendimentos TO authenticated;
ALTER POLICY pacientes_select ON public.pacientes TO authenticated;

-- 7. CLEANUP: RLS ALWAYS TRUE
DROP POLICY IF EXISTS states_public_read ON public.states;
CREATE POLICY states_public_read ON public.states FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS cities_public_read ON public.cities;
CREATE POLICY cities_public_read ON public.cities FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS tuss_catalogo_read_all ON public.tuss_catalogo;
CREATE POLICY tuss_catalogo_read_all ON public.tuss_catalogo FOR SELECT TO authenticated USING (true);
