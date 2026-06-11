
-- ===== Tabela tenants =====
CREATE TABLE IF NOT EXISTS public.tenants (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          text NOT NULL,
  slug          text NOT NULL UNIQUE,
  cnpj          text NOT NULL DEFAULT '',
  email_contato text NOT NULL DEFAULT '',
  telefone      text NOT NULL DEFAULT '',
  status        text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','suspenso','cancelado')),
  plano         text NOT NULL DEFAULT 'free',
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON public.tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_slug   ON public.tenants(slug);
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.touch_tenants_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_tenants_touch ON public.tenants;
CREATE TRIGGER trg_tenants_touch BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.touch_tenants_updated_at();

INSERT INTO public.tenants (id, nome, slug, status, plano, email_contato)
VALUES ('00000000-0000-0000-0000-000000000001', 'Laboratório Demo', 'demo', 'ativo', 'free', 'demo@sislac.com')
ON CONFLICT (id) DO NOTHING;

-- ===== Helpers =====
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin')
$$;

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE tid uuid;
BEGIN
  SELECT tenant_id INTO tid FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
  RETURN tid;
END; $$;

-- ===== Adiciona tenant_id =====
ALTER TABLE public.profiles               ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.pacientes              ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.atendimentos           ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.atendimento_exames     ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.atendimento_pagamentos ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.atendimento_audit      ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.convenios              ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.especialistas          ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.exames_catalogo        ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.exame_layouts          ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.exame_parametros       ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.financeiro_saidas      ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.labs_apoio             ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.orcamentos             ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.orcamento_exames       ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.tabela_preco_itens     ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.unidades               ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.valores_referencia     ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.app_settings           ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.app_settings_audit     ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

-- ===== Backfill demo =====
UPDATE public.profiles               SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.pacientes              SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.atendimentos           SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.atendimento_exames     SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.atendimento_pagamentos SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.atendimento_audit      SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.convenios              SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.especialistas          SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.exames_catalogo        SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.exame_layouts          SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.exame_parametros       SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.financeiro_saidas      SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.labs_apoio             SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.orcamentos             SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.orcamento_exames       SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.tabela_preco_itens     SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.unidades               SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.valores_referencia     SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.app_settings           SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.app_settings_audit     SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;

ALTER TABLE public.profiles               ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.pacientes              ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.atendimentos           ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.atendimento_exames     ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.atendimento_pagamentos ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.convenios              ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.especialistas          ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.exames_catalogo        ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.exame_layouts          ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.exame_parametros       ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.financeiro_saidas      ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.labs_apoio             ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.orcamentos             ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.orcamento_exames       ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.tabela_preco_itens     ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.unidades               ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.valores_referencia     ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.app_settings           ALTER COLUMN tenant_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_tenant           ON public.profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pacientes_tenant          ON public.pacientes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_atendimentos_tenant       ON public.atendimentos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_atend_exames_tenant       ON public.atendimento_exames(tenant_id);
CREATE INDEX IF NOT EXISTS idx_atend_pag_tenant          ON public.atendimento_pagamentos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_atend_audit_tenant        ON public.atendimento_audit(tenant_id);
CREATE INDEX IF NOT EXISTS idx_convenios_tenant          ON public.convenios(tenant_id);
CREATE INDEX IF NOT EXISTS idx_especialistas_tenant      ON public.especialistas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_exames_catalogo_tenant    ON public.exames_catalogo(tenant_id);
CREATE INDEX IF NOT EXISTS idx_exame_layouts_tenant      ON public.exame_layouts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_exame_parametros_tenant   ON public.exame_parametros(tenant_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_saidas_tenant  ON public.financeiro_saidas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_labs_apoio_tenant         ON public.labs_apoio(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_tenant         ON public.orcamentos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orcamento_exames_tenant   ON public.orcamento_exames(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tabela_preco_itens_tenant ON public.tabela_preco_itens(tenant_id);
CREATE INDEX IF NOT EXISTS idx_unidades_tenant           ON public.unidades(tenant_id);
CREATE INDEX IF NOT EXISTS idx_valores_referencia_tenant ON public.valores_referencia(tenant_id);
CREATE INDEX IF NOT EXISTS idx_app_settings_tenant       ON public.app_settings(tenant_id);

-- ===== handle_new_user adaptado =====
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  meta_name   TEXT;
  meta_avatar TEXT;
  meta_tenant uuid;
  meta_perfil TEXT;
BEGIN
  meta_name   := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
  meta_avatar := NEW.raw_user_meta_data->>'avatar_url';
  meta_perfil := COALESCE(NEW.raw_user_meta_data->>'perfil', 'recepcionista');
  BEGIN meta_tenant := (NEW.raw_user_meta_data->>'tenant_id')::uuid;
  EXCEPTION WHEN OTHERS THEN meta_tenant := NULL; END;
  IF meta_tenant IS NULL THEN meta_tenant := '00000000-0000-0000-0000-000000000001'::uuid; END IF;

  INSERT INTO public.profiles (user_id, nome, email, avatar, perfil, tenant_id)
  VALUES (NEW.id, meta_name, NEW.email, meta_avatar, meta_perfil, meta_tenant)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END; $$;

-- ===== RLS: TENANTS =====
DROP POLICY IF EXISTS "Super admins manage tenants" ON public.tenants;
CREATE POLICY "Super admins manage tenants" ON public.tenants FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS "Tenant admins read own tenant" ON public.tenants;
CREATE POLICY "Tenant admins read own tenant" ON public.tenants FOR SELECT TO authenticated
  USING (id = public.current_tenant_id());

-- ===== RLS: PROFILES =====
DROP POLICY IF EXISTS "Admins insert profiles"   ON public.profiles;
DROP POLICY IF EXISTS "Admins manage profiles"   ON public.profiles;
DROP POLICY IF EXISTS "Admins view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users view own profile"   ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR auth.uid() = user_id
      OR (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(),'admin')));
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid())
      OR (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(),'admin')));
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profiles_update_admin" ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(),'admin')))
  WITH CHECK (public.is_super_admin(auth.uid()) OR (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(),'admin')));
CREATE POLICY "profiles_delete" ON public.profiles FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(),'admin')));

-- ===== RLS: USER_ROLES =====
DROP POLICY IF EXISTS "Admins can manage roles"   ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles"  ON public.user_roles;
CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "user_roles_manage" ON public.user_roles FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'admin'));

-- ===== RLS demais tabelas (padrão multi-tenant) =====
DROP POLICY IF EXISTS "Cadastrar pacientes via permissao" ON public.pacientes;
DROP POLICY IF EXISTS "Editar pacientes via permissao"    ON public.pacientes;
DROP POLICY IF EXISTS "Excluir pacientes admin"           ON public.pacientes;
DROP POLICY IF EXISTS "Visualizar pacientes via permissao" ON public.pacientes;
CREATE POLICY "pacientes_select" ON public.pacientes FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(),'visualizar_pacientes')));
CREATE POLICY "pacientes_insert" ON public.pacientes FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(),'cadastrar_paciente'));
CREATE POLICY "pacientes_update" ON public.pacientes FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(),'editar_paciente'))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(),'editar_paciente'));
CREATE POLICY "pacientes_delete" ON public.pacientes FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(),'admin')));

DROP POLICY IF EXISTS "Criar atendimentos via permissao"     ON public.atendimentos;
DROP POLICY IF EXISTS "Editar atendimentos via permissao"    ON public.atendimentos;
DROP POLICY IF EXISTS "Excluir atendimentos via permissao"   ON public.atendimentos;
DROP POLICY IF EXISTS "Visualizar atendimentos via permissao" ON public.atendimentos;
CREATE POLICY "atend_select" ON public.atendimentos FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(),'visualizar_atendimentos')));
CREATE POLICY "atend_insert" ON public.atendimentos FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(),'criar_atendimento'));
CREATE POLICY "atend_update" ON public.atendimentos FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND (public.has_permission(auth.uid(),'editar_atendimento') OR public.has_permission(auth.uid(),'cancelar_atendimento') OR public.has_permission(auth.uid(),'analisar_amostra') OR public.has_permission(auth.uid(),'liberar_resultado') OR public.has_permission(auth.uid(),'registrar_coleta')))
  WITH CHECK (tenant_id = public.current_tenant_id() AND (public.has_permission(auth.uid(),'editar_atendimento') OR public.has_permission(auth.uid(),'cancelar_atendimento') OR public.has_permission(auth.uid(),'analisar_amostra') OR public.has_permission(auth.uid(),'liberar_resultado') OR public.has_permission(auth.uid(),'registrar_coleta')));
CREATE POLICY "atend_delete" ON public.atendimentos FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(),'cancelar_atendimento'));

DROP POLICY IF EXISTS "Criar exames via permissao"      ON public.atendimento_exames;
DROP POLICY IF EXISTS "Editar exames via permissao"     ON public.atendimento_exames;
DROP POLICY IF EXISTS "Excluir exames via permissao"    ON public.atendimento_exames;
DROP POLICY IF EXISTS "Visualizar exames via permissao" ON public.atendimento_exames;
CREATE POLICY "atex_select" ON public.atendimento_exames FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(),'visualizar_atendimentos')));
CREATE POLICY "atex_insert" ON public.atendimento_exames FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() AND (public.has_permission(auth.uid(),'criar_atendimento') OR public.has_permission(auth.uid(),'editar_atendimento')));
CREATE POLICY "atex_update" ON public.atendimento_exames FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND (public.has_permission(auth.uid(),'editar_atendimento') OR public.has_permission(auth.uid(),'registrar_coleta') OR public.has_permission(auth.uid(),'analisar_amostra') OR public.has_permission(auth.uid(),'liberar_resultado')))
  WITH CHECK (tenant_id = public.current_tenant_id() AND (public.has_permission(auth.uid(),'editar_atendimento') OR public.has_permission(auth.uid(),'registrar_coleta') OR public.has_permission(auth.uid(),'analisar_amostra') OR public.has_permission(auth.uid(),'liberar_resultado')));
CREATE POLICY "atex_delete" ON public.atendimento_exames FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND (public.has_permission(auth.uid(),'editar_atendimento') OR public.has_permission(auth.uid(),'cancelar_atendimento')));

DROP POLICY IF EXISTS "Criar pagamentos via permissao"      ON public.atendimento_pagamentos;
DROP POLICY IF EXISTS "Editar pagamentos via permissao"     ON public.atendimento_pagamentos;
DROP POLICY IF EXISTS "Excluir pagamentos admin"            ON public.atendimento_pagamentos;
DROP POLICY IF EXISTS "Visualizar pagamentos via permissao" ON public.atendimento_pagamentos;
CREATE POLICY "atpag_select" ON public.atendimento_pagamentos FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR (tenant_id = public.current_tenant_id() AND (public.has_permission(auth.uid(),'visualizar_atendimentos') OR public.has_permission(auth.uid(),'visualizar_financeiro'))));
CREATE POLICY "atpag_insert" ON public.atendimento_pagamentos FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(),'registrar_pagamento'));
CREATE POLICY "atpag_update" ON public.atendimento_pagamentos FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(),'registrar_pagamento'))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(),'registrar_pagamento'));
CREATE POLICY "atpag_delete" ON public.atendimento_pagamentos FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(),'admin')));

DROP POLICY IF EXISTS "Visualizar auditoria via permissao" ON public.atendimento_audit;
CREATE POLICY "ataudit_select" ON public.atendimento_audit FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR (tenant_id = public.current_tenant_id() AND (public.has_role(auth.uid(),'admin') OR public.has_permission(auth.uid(),'auditoria'))));

DROP POLICY IF EXISTS "Admins delete convenios"      ON public.convenios;
DROP POLICY IF EXISTS "Admins insert convenios"      ON public.convenios;
DROP POLICY IF EXISTS "Admins update convenios"      ON public.convenios;
DROP POLICY IF EXISTS "Authenticated read convenios" ON public.convenios;
CREATE POLICY "conv_select" ON public.convenios FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()) OR tenant_id = public.current_tenant_id());
CREATE POLICY "conv_insert" ON public.convenios FOR INSERT TO authenticated WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "conv_update" ON public.convenios FOR UPDATE TO authenticated USING (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(),'admin')) WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "conv_delete" ON public.convenios FOR DELETE TO authenticated USING (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Authenticated read especialistas"      ON public.especialistas;
DROP POLICY IF EXISTS "Cadastrar especialistas via permissao" ON public.especialistas;
DROP POLICY IF EXISTS "Editar especialistas via permissao"    ON public.especialistas;
DROP POLICY IF EXISTS "Excluir especialistas admin"           ON public.especialistas;
CREATE POLICY "esp_select" ON public.especialistas FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()) OR tenant_id = public.current_tenant_id());
CREATE POLICY "esp_insert" ON public.especialistas FOR INSERT TO authenticated WITH CHECK (tenant_id = public.current_tenant_id() AND (public.has_permission(auth.uid(),'cadastrar_paciente') OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "esp_update" ON public.especialistas FOR UPDATE TO authenticated USING (tenant_id = public.current_tenant_id() AND (public.has_permission(auth.uid(),'editar_paciente') OR public.has_role(auth.uid(),'admin'))) WITH CHECK (tenant_id = public.current_tenant_id() AND (public.has_permission(auth.uid(),'editar_paciente') OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "esp_delete" ON public.especialistas FOR DELETE TO authenticated USING (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Admins delete exames_catalogo"      ON public.exames_catalogo;
DROP POLICY IF EXISTS "Admins insert exames_catalogo"      ON public.exames_catalogo;
DROP POLICY IF EXISTS "Admins update exames_catalogo"      ON public.exames_catalogo;
DROP POLICY IF EXISTS "Authenticated read exames_catalogo" ON public.exames_catalogo;
CREATE POLICY "excat_select" ON public.exames_catalogo FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()) OR tenant_id = public.current_tenant_id());
CREATE POLICY "excat_insert" ON public.exames_catalogo FOR INSERT TO authenticated WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "excat_update" ON public.exames_catalogo FOR UPDATE TO authenticated USING (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(),'admin')) WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "excat_delete" ON public.exames_catalogo FOR DELETE TO authenticated USING (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Criar layouts via permissao"      ON public.exame_layouts;
DROP POLICY IF EXISTS "Editar layouts via permissao"     ON public.exame_layouts;
DROP POLICY IF EXISTS "Excluir layouts via permissao"    ON public.exame_layouts;
DROP POLICY IF EXISTS "Visualizar layouts autenticado"   ON public.exame_layouts;
CREATE POLICY "exlay_select" ON public.exame_layouts FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()) OR tenant_id = public.current_tenant_id());
CREATE POLICY "exlay_insert" ON public.exame_layouts FOR INSERT TO authenticated WITH CHECK (tenant_id = public.current_tenant_id() AND (public.has_permission(auth.uid(),'gestao_exames') OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "exlay_update" ON public.exame_layouts FOR UPDATE TO authenticated USING (tenant_id = public.current_tenant_id() AND (public.has_permission(auth.uid(),'gestao_exames') OR public.has_role(auth.uid(),'admin'))) WITH CHECK (tenant_id = public.current_tenant_id() AND (public.has_permission(auth.uid(),'gestao_exames') OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "exlay_delete" ON public.exame_layouts FOR DELETE TO authenticated USING (tenant_id = public.current_tenant_id() AND (public.has_permission(auth.uid(),'gestao_exames') OR public.has_role(auth.uid(),'admin')));

DROP POLICY IF EXISTS "Criar parametros via permissao"     ON public.exame_parametros;
DROP POLICY IF EXISTS "Editar parametros via permissao"    ON public.exame_parametros;
DROP POLICY IF EXISTS "Excluir parametros via permissao"   ON public.exame_parametros;
DROP POLICY IF EXISTS "Visualizar parametros autenticado"  ON public.exame_parametros;
CREATE POLICY "expar_select" ON public.exame_parametros FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()) OR tenant_id = public.current_tenant_id());
CREATE POLICY "expar_insert" ON public.exame_parametros FOR INSERT TO authenticated WITH CHECK (tenant_id = public.current_tenant_id() AND (public.has_permission(auth.uid(),'gestao_exames') OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "expar_update" ON public.exame_parametros FOR UPDATE TO authenticated USING (tenant_id = public.current_tenant_id() AND (public.has_permission(auth.uid(),'gestao_exames') OR public.has_role(auth.uid(),'admin'))) WITH CHECK (tenant_id = public.current_tenant_id() AND (public.has_permission(auth.uid(),'gestao_exames') OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "expar_delete" ON public.exame_parametros FOR DELETE TO authenticated USING (tenant_id = public.current_tenant_id() AND (public.has_permission(auth.uid(),'gestao_exames') OR public.has_role(auth.uid(),'admin')));

DROP POLICY IF EXISTS "Criar saidas via permissao"      ON public.financeiro_saidas;
DROP POLICY IF EXISTS "Editar saidas via permissao"     ON public.financeiro_saidas;
DROP POLICY IF EXISTS "Excluir saidas admin"            ON public.financeiro_saidas;
DROP POLICY IF EXISTS "Visualizar saidas via permissao" ON public.financeiro_saidas;
CREATE POLICY "fin_select" ON public.financeiro_saidas FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()) OR (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(),'visualizar_financeiro')));
CREATE POLICY "fin_insert" ON public.financeiro_saidas FOR INSERT TO authenticated WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(),'gestao_financeira'));
CREATE POLICY "fin_update" ON public.financeiro_saidas FOR UPDATE TO authenticated USING (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(),'gestao_financeira')) WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(),'gestao_financeira'));
CREATE POLICY "fin_delete" ON public.financeiro_saidas FOR DELETE TO authenticated USING (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Admins delete labs_apoio"      ON public.labs_apoio;
DROP POLICY IF EXISTS "Admins insert labs_apoio"      ON public.labs_apoio;
DROP POLICY IF EXISTS "Admins update labs_apoio"      ON public.labs_apoio;
DROP POLICY IF EXISTS "Authenticated read labs_apoio" ON public.labs_apoio;
CREATE POLICY "lab_select" ON public.labs_apoio FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()) OR tenant_id = public.current_tenant_id());
CREATE POLICY "lab_insert" ON public.labs_apoio FOR INSERT TO authenticated WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "lab_update" ON public.labs_apoio FOR UPDATE TO authenticated USING (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(),'admin')) WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "lab_delete" ON public.labs_apoio FOR DELETE TO authenticated USING (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Criar orcamentos via permissao"      ON public.orcamentos;
DROP POLICY IF EXISTS "Editar orcamentos via permissao"     ON public.orcamentos;
DROP POLICY IF EXISTS "Excluir orcamentos admin"            ON public.orcamentos;
DROP POLICY IF EXISTS "Visualizar orcamentos via permissao" ON public.orcamentos;
CREATE POLICY "orc_select" ON public.orcamentos FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()) OR (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(),'visualizar_orcamentos')));
CREATE POLICY "orc_insert" ON public.orcamentos FOR INSERT TO authenticated WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(),'criar_orcamento'));
CREATE POLICY "orc_update" ON public.orcamentos FOR UPDATE TO authenticated USING (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(),'criar_orcamento')) WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(),'criar_orcamento'));
CREATE POLICY "orc_delete" ON public.orcamentos FOR DELETE TO authenticated USING (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Criar orcamento_exames via permissao"      ON public.orcamento_exames;
DROP POLICY IF EXISTS "Editar orcamento_exames via permissao"     ON public.orcamento_exames;
DROP POLICY IF EXISTS "Excluir orcamento_exames via permissao"    ON public.orcamento_exames;
DROP POLICY IF EXISTS "Visualizar orcamento_exames via permissao" ON public.orcamento_exames;
CREATE POLICY "orcex_select" ON public.orcamento_exames FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()) OR (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(),'visualizar_orcamentos')));
CREATE POLICY "orcex_insert" ON public.orcamento_exames FOR INSERT TO authenticated WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(),'criar_orcamento'));
CREATE POLICY "orcex_update" ON public.orcamento_exames FOR UPDATE TO authenticated USING (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(),'criar_orcamento')) WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(),'criar_orcamento'));
CREATE POLICY "orcex_delete" ON public.orcamento_exames FOR DELETE TO authenticated USING (tenant_id = public.current_tenant_id() AND (public.has_permission(auth.uid(),'criar_orcamento') OR public.has_role(auth.uid(),'admin')));

DROP POLICY IF EXISTS "Admins delete tabela_preco"      ON public.tabela_preco_itens;
DROP POLICY IF EXISTS "Admins insert tabela_preco"      ON public.tabela_preco_itens;
DROP POLICY IF EXISTS "Admins update tabela_preco"      ON public.tabela_preco_itens;
DROP POLICY IF EXISTS "Authenticated read tabela_preco" ON public.tabela_preco_itens;
CREATE POLICY "tab_select" ON public.tabela_preco_itens FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()) OR tenant_id = public.current_tenant_id());
CREATE POLICY "tab_insert" ON public.tabela_preco_itens FOR INSERT TO authenticated WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "tab_update" ON public.tabela_preco_itens FOR UPDATE TO authenticated USING (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(),'admin')) WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "tab_delete" ON public.tabela_preco_itens FOR DELETE TO authenticated USING (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Admins delete unidades"      ON public.unidades;
DROP POLICY IF EXISTS "Admins insert unidades"      ON public.unidades;
DROP POLICY IF EXISTS "Admins update unidades"      ON public.unidades;
DROP POLICY IF EXISTS "Authenticated read unidades" ON public.unidades;
CREATE POLICY "und_select" ON public.unidades FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()) OR tenant_id = public.current_tenant_id());
CREATE POLICY "und_insert" ON public.unidades FOR INSERT TO authenticated WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "und_update" ON public.unidades FOR UPDATE TO authenticated USING (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(),'admin')) WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "und_delete" ON public.unidades FOR DELETE TO authenticated USING (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Admins delete valores_referencia"      ON public.valores_referencia;
DROP POLICY IF EXISTS "Admins insert valores_referencia"      ON public.valores_referencia;
DROP POLICY IF EXISTS "Admins update valores_referencia"      ON public.valores_referencia;
DROP POLICY IF EXISTS "Authenticated read valores_referencia" ON public.valores_referencia;
CREATE POLICY "vref_select" ON public.valores_referencia FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()) OR tenant_id = public.current_tenant_id());
CREATE POLICY "vref_insert" ON public.valores_referencia FOR INSERT TO authenticated WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "vref_update" ON public.valores_referencia FOR UPDATE TO authenticated USING (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(),'admin')) WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "vref_delete" ON public.valores_referencia FOR DELETE TO authenticated USING (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Admins can delete app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can insert app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can update app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "App settings are publicly readable" ON public.app_settings;
CREATE POLICY "appset_select" ON public.app_settings FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()) OR tenant_id = public.current_tenant_id());
CREATE POLICY "appset_insert" ON public.app_settings FOR INSERT TO authenticated WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "appset_update" ON public.app_settings FOR UPDATE TO authenticated USING (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(),'admin')) WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "appset_delete" ON public.app_settings FOR DELETE TO authenticated USING (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Admins can read audit" ON public.app_settings_audit;
CREATE POLICY "appsetaudit_select" ON public.app_settings_audit FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(),'admin')));
