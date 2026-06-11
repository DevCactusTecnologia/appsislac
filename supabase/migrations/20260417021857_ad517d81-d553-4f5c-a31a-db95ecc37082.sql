
-- =========================================================================
-- FASE 4: Profiles + permission overrides
-- =========================================================================

-- 1) Tabela profiles -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL UNIQUE,
  nome                  TEXT NOT NULL DEFAULT '',
  email                 TEXT NOT NULL,
  avatar                TEXT,
  perfil                TEXT NOT NULL DEFAULT 'recepcionista'
                          CHECK (perfil IN ('admin','analista','recepcionista','financeiro')),
  unidade_ids           TEXT[] NOT NULL DEFAULT ARRAY['und-001'],
  unidade_ativa         TEXT NOT NULL DEFAULT 'und-001',
  permissoes_extras     TEXT[] NOT NULL DEFAULT '{}',
  permissoes_revogadas  TEXT[] NOT NULL DEFAULT '{}',
  status                TEXT NOT NULL DEFAULT 'Ativo'
                          CHECK (status IN ('Ativo','Inativo')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email   ON public.profiles(email);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- updated_at trigger (reusa convenção)
CREATE OR REPLACE FUNCTION public.touch_profiles_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS touch_profiles_updated_at ON public.profiles;
CREATE TRIGGER touch_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_profiles_updated_at();

-- 2) RLS profiles --------------------------------------------------------
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
CREATE POLICY "Users view own profile" ON public.profiles
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins view all profiles" ON public.profiles;
CREATE POLICY "Admins view all profiles" ON public.profiles
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Self-update: usuário pode atualizar nome/avatar/unidade_ativa,
-- mas NÃO pode mudar perfil/unidade_ids/permissoes (enforcement via trigger).
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins manage profiles" ON public.profiles;
CREATE POLICY "Admins manage profiles" ON public.profiles
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- INSERT: só via trigger (security definer) na criação de auth.users
-- Não exponho política de INSERT para usuários comuns.
DROP POLICY IF EXISTS "Admins insert profiles" ON public.profiles;
CREATE POLICY "Admins insert profiles" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3) Trigger: protect privileged columns from self-update ---------------
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se quem chama é admin, qualquer alteração é permitida
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  -- Caso contrário, reverte campos privilegiados
  IF NEW.perfil               IS DISTINCT FROM OLD.perfil
     OR NEW.unidade_ids       IS DISTINCT FROM OLD.unidade_ids
     OR NEW.permissoes_extras IS DISTINCT FROM OLD.permissoes_extras
     OR NEW.permissoes_revogadas IS DISTINCT FROM OLD.permissoes_revogadas
     OR NEW.status            IS DISTINCT FROM OLD.status
     OR NEW.email             IS DISTINCT FROM OLD.email
  THEN
    NEW.perfil               := OLD.perfil;
    NEW.unidade_ids          := OLD.unidade_ids;
    NEW.permissoes_extras    := OLD.permissoes_extras;
    NEW.permissoes_revogadas := OLD.permissoes_revogadas;
    NEW.status               := OLD.status;
    NEW.email                := OLD.email;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_privileged_columns ON public.profiles;
CREATE TRIGGER protect_profile_privileged_columns
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileged_columns();

-- 4) handle_new_user: cria profile + role default ao signup --------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta_name TEXT;
  meta_avatar TEXT;
BEGIN
  meta_name   := COALESCE(NEW.raw_user_meta_data->>'full_name',
                          NEW.raw_user_meta_data->>'name',
                          split_part(NEW.email, '@', 1));
  meta_avatar := NEW.raw_user_meta_data->>'avatar_url';

  INSERT INTO public.profiles (user_id, nome, email, avatar, perfil)
  VALUES (NEW.id, meta_name, NEW.email, meta_avatar, 'recepcionista')
  ON CONFLICT (user_id) DO NOTHING;

  -- Role padrão
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5) has_permission(): roles + overrides ---------------------------------
-- Mapeamento role→permissões padrão fica no app (frontend), mas a função
-- aqui resolve conflitos para queries server-side futuras.
CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _permission TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prof_perfil TEXT;
  extras TEXT[];
  revoked TEXT[];
  default_perms TEXT[];
BEGIN
  SELECT perfil, permissoes_extras, permissoes_revogadas
    INTO prof_perfil, extras, revoked
    FROM public.profiles WHERE user_id = _user_id;

  IF prof_perfil IS NULL THEN RETURN FALSE; END IF;

  -- Override revogação
  IF _permission = ANY(revoked) THEN RETURN FALSE; END IF;
  -- Override concessão
  IF _permission = ANY(extras)  THEN RETURN TRUE;  END IF;

  -- Defaults por perfil (espelham o frontend)
  default_perms := CASE prof_perfil
    WHEN 'admin' THEN ARRAY[
      'visualizar_dashboard','cadastrar_paciente','editar_paciente','visualizar_pacientes',
      'criar_atendimento','editar_atendimento','cancelar_atendimento','visualizar_atendimentos',
      'registrar_coleta','analisar_amostra','liberar_resultado','imprimir_laudo',
      'gestao_financeira','registrar_pagamento','visualizar_financeiro',
      'criar_orcamento','visualizar_orcamentos',
      'gestao_usuarios','gestao_unidades','gestao_convenios','gestao_exames',
      'configuracoes_sistema','auditoria','impressao_geral'
    ]
    WHEN 'analista' THEN ARRAY[
      'visualizar_dashboard','visualizar_pacientes','visualizar_atendimentos',
      'analisar_amostra','liberar_resultado','imprimir_laudo','registrar_coleta'
    ]
    WHEN 'recepcionista' THEN ARRAY[
      'visualizar_dashboard','cadastrar_paciente','editar_paciente','visualizar_pacientes',
      'criar_atendimento','editar_atendimento','visualizar_atendimentos',
      'registrar_coleta','registrar_pagamento','criar_orcamento','visualizar_orcamentos'
    ]
    WHEN 'financeiro' THEN ARRAY[
      'visualizar_dashboard','visualizar_pacientes','visualizar_atendimentos',
      'gestao_financeira','registrar_pagamento','visualizar_financeiro',
      'criar_orcamento','visualizar_orcamentos'
    ]
    ELSE ARRAY[]::TEXT[]
  END;

  RETURN _permission = ANY(default_perms);
END;
$$;
