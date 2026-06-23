-- ============================================================================
-- Migration: Corrigir 6 tabelas críticas com tenant_id e RLS seguro
-- Data: 2026-06-23
-- Tabelas: unidades, convenios, especialistas, exame_parametros, exame_layouts, tabela_preco
-- ============================================================================

-- ============================================================================
-- TABELA 1: unidades
-- ============================================================================

ALTER TABLE public.unidades 
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_unidades_tenant_id ON public.unidades(tenant_id);

-- Popular com tenant padrão (IMPORTANTE: ajuste conforme sua lógica!)
UPDATE public.unidades
SET tenant_id = '00000000-0000-0000-0000-000000000001'
WHERE tenant_id IS NULL;

ALTER TABLE public.unidades
ALTER COLUMN tenant_id SET NOT NULL;

-- Remover políticas inseguras
DROP POLICY IF EXISTS "Authenticated read unidades" ON public.unidades;
DROP POLICY IF EXISTS "Everyone can read unidades" ON public.unidades;

-- Criar políticas seguras
CREATE POLICY "unidades_authenticated_select" ON public.unidades
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "unidades_authenticated_insert" ON public.unidades
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(), 'criar_unidades'));

CREATE POLICY "unidades_authenticated_update" ON public.unidades
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(), 'editar_unidades'));

CREATE POLICY "unidades_authenticated_delete" ON public.unidades
  FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(), 'deletar_unidades'));

CREATE POLICY "unidades_super_admin_all" ON public.unidades
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- ============================================================================
-- TABELA 2: convenios
-- ============================================================================

ALTER TABLE public.convenios 
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_convenios_tenant_id ON public.convenios(tenant_id);

UPDATE public.convenios
SET tenant_id = '00000000-0000-0000-0000-000000000001'
WHERE tenant_id IS NULL;

ALTER TABLE public.convenios
ALTER COLUMN tenant_id SET NOT NULL;

-- Remover políticas inseguras
DROP POLICY IF EXISTS "Authenticated read convenios" ON public.convenios;
DROP POLICY IF EXISTS "Everyone can read convenios" ON public.convenios;

-- Criar políticas seguras
CREATE POLICY "convenios_authenticated_select" ON public.convenios
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "convenios_authenticated_insert" ON public.convenios
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(), 'criar_convenios'));

CREATE POLICY "convenios_authenticated_update" ON public.convenios
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(), 'editar_convenios'));

CREATE POLICY "convenios_authenticated_delete" ON public.convenios
  FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(), 'deletar_convenios'));

CREATE POLICY "convenios_super_admin_all" ON public.convenios
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- ============================================================================
-- TABELA 3: especialistas
-- ============================================================================

ALTER TABLE public.especialistas 
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_especialistas_tenant_id ON public.especialistas(tenant_id);

UPDATE public.especialistas
SET tenant_id = '00000000-0000-0000-0000-000000000001'
WHERE tenant_id IS NULL;

ALTER TABLE public.especialistas
ALTER COLUMN tenant_id SET NOT NULL;

-- Remover políticas inseguras
DROP POLICY IF EXISTS "Authenticated read especialistas" ON public.especialistas;
DROP POLICY IF EXISTS "Everyone can read especialistas" ON public.especialistas;

-- Criar políticas seguras
CREATE POLICY "especialistas_authenticated_select" ON public.especialistas
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "especialistas_authenticated_insert" ON public.especialistas
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(), 'criar_especialistas'));

CREATE POLICY "especialistas_authenticated_update" ON public.especialistas
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(), 'editar_especialistas'));

CREATE POLICY "especialistas_authenticated_delete" ON public.especialistas
  FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(), 'deletar_especialistas'));

CREATE POLICY "especialistas_super_admin_all" ON public.especialistas
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- ============================================================================
-- TABELA 4: exame_parametros
-- ============================================================================

ALTER TABLE public.exame_parametros 
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_exame_parametros_tenant_id ON public.exame_parametros(tenant_id);

UPDATE public.exame_parametros
SET tenant_id = '00000000-0000-0000-0000-000000000001'
WHERE tenant_id IS NULL;

ALTER TABLE public.exame_parametros
ALTER COLUMN tenant_id SET NOT NULL;

-- Remover políticas inseguras
DROP POLICY IF EXISTS "Visualizar parametros autenticado" ON public.exame_parametros;
DROP POLICY IF EXISTS "Everyone can read exame_parametros" ON public.exame_parametros;

-- Criar políticas seguras
CREATE POLICY "exame_parametros_authenticated_select" ON public.exame_parametros
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "exame_parametros_authenticated_insert" ON public.exame_parametros
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(), 'criar_parametros'));

CREATE POLICY "exame_parametros_authenticated_update" ON public.exame_parametros
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(), 'editar_parametros'));

CREATE POLICY "exame_parametros_authenticated_delete" ON public.exame_parametros
  FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(), 'deletar_parametros'));

CREATE POLICY "exame_parametros_super_admin_all" ON public.exame_parametros
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- ============================================================================
-- TABELA 5: exame_layouts
-- ============================================================================

ALTER TABLE public.exame_layouts 
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_exame_layouts_tenant_id ON public.exame_layouts(tenant_id);

UPDATE public.exame_layouts
SET tenant_id = '00000000-0000-0000-0000-000000000001'
WHERE tenant_id IS NULL;

ALTER TABLE public.exame_layouts
ALTER COLUMN tenant_id SET NOT NULL;

-- Remover políticas inseguras
DROP POLICY IF EXISTS "Authenticated read exame_layouts" ON public.exame_layouts;
DROP POLICY IF EXISTS "Everyone can read exame_layouts" ON public.exame_layouts;

-- Criar políticas seguras
CREATE POLICY "exame_layouts_authenticated_select" ON public.exame_layouts
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "exame_layouts_authenticated_insert" ON public.exame_layouts
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(), 'criar_layouts'));

CREATE POLICY "exame_layouts_authenticated_update" ON public.exame_layouts
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(), 'editar_layouts'));

CREATE POLICY "exame_layouts_authenticated_delete" ON public.exame_layouts
  FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(), 'deletar_layouts'));

CREATE POLICY "exame_layouts_super_admin_all" ON public.exame_layouts
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- ============================================================================
-- TABELA 6: tabela_preco
-- ============================================================================

ALTER TABLE public.tabela_preco 
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_tabela_preco_tenant_id ON public.tabela_preco(tenant_id);

UPDATE public.tabela_preco
SET tenant_id = '00000000-0000-0000-0000-000000000001'
WHERE tenant_id IS NULL;

ALTER TABLE public.tabela_preco
ALTER COLUMN tenant_id SET NOT NULL;

-- Remover políticas inseguras
DROP POLICY IF EXISTS "Authenticated read tabela_preco" ON public.tabela_preco;
DROP POLICY IF EXISTS "Everyone can read tabela_preco" ON public.tabela_preco;

-- Criar políticas seguras
CREATE POLICY "tabela_preco_authenticated_select" ON public.tabela_preco
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "tabela_preco_authenticated_insert" ON public.tabela_preco
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(), 'criar_preco'));

CREATE POLICY "tabela_preco_authenticated_update" ON public.tabela_preco
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(), 'editar_preco'));

CREATE POLICY "tabela_preco_authenticated_delete" ON public.tabela_preco
  FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(), 'deletar_preco'));

CREATE POLICY "tabela_preco_super_admin_all" ON public.tabela_preco
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- ============================================================================
-- VALIDAÇÕES PÓS-MIGRAÇÃO
-- ============================================================================

-- Verificar se todas as tabelas têm tenant_id:
-- SELECT 
--   table_name,
--   COUNT(*) as total_rows,
--   COUNT(CASE WHEN tenant_id IS NULL THEN 1 END) as null_count
-- FROM (
--   SELECT 'unidades' as table_name, tenant_id FROM public.unidades
--   UNION ALL SELECT 'convenios', tenant_id FROM public.convenios
--   UNION ALL SELECT 'especialistas', tenant_id FROM public.especialistas
--   UNION ALL SELECT 'exame_parametros', tenant_id FROM public.exame_parametros
--   UNION ALL SELECT 'exame_layouts', tenant_id FROM public.exame_layouts
--   UNION ALL SELECT 'tabela_preco', tenant_id FROM public.tabela_preco
-- ) data
-- GROUP BY table_name;

-- Testar RLS:
-- SELECT count(*) FROM public.unidades;  -- Como Tenant A
-- SELECT count(*) FROM public.unidades;  -- Como Tenant B
-- (Os números devem ser diferentes ou iguais, dependendo dos dados, mas NUNCA deve violar tenant)
