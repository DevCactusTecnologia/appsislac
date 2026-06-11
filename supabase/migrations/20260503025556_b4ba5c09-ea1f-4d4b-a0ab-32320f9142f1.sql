DROP POLICY IF EXISTS doc_templates_demo_anon_select ON public.documento_templates;
DROP POLICY IF EXISTS doc_templates_demo_anon_insert ON public.documento_templates;
DROP POLICY IF EXISTS doc_templates_demo_anon_update ON public.documento_templates;
DROP POLICY IF EXISTS doc_templates_demo_anon_delete ON public.documento_templates;

CREATE POLICY doc_templates_demo_anon_select
ON public.documento_templates
FOR SELECT
TO anon
USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY doc_templates_demo_anon_insert
ON public.documento_templates
FOR INSERT
TO anon
WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY doc_templates_demo_anon_update
ON public.documento_templates
FOR UPDATE
TO anon
USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid)
WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY doc_templates_demo_anon_delete
ON public.documento_templates
FOR DELETE
TO anon
USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);