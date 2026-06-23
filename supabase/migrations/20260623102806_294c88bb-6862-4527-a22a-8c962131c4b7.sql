
-- =====================================================================
-- Equipe 2.1 — Fase 2.1: trigger anti auto-escalonamento em profiles
-- =====================================================================
-- Hoje a policy `profiles_update_self` permite ao próprio usuário gravar
-- qualquer coluna do seu profile via PostgREST — inclusive perfil, permissões
-- extras, unidades e status. Isso permite escalação silenciosa.
--
-- Solução: manter a policy (UX precisa que o usuário edite seu próprio
-- profile), mas adicionar um trigger BEFORE UPDATE que bloqueia mudanças em
-- colunas sensíveis quando o caller está editando a si mesmo e NÃO é admin
-- nem super_admin. Service-role (edge functions, triggers internos) tem
-- `auth.uid()` NULL — não cai no bloqueio.

CREATE OR REPLACE FUNCTION public.profiles_guard_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  is_self boolean;
  is_admin boolean;
BEGIN
  -- Sem usuário autenticado (ex.: service_role, triggers internos) → não bloqueia.
  IF caller IS NULL THEN
    RETURN NEW;
  END IF;

  is_self := caller = OLD.user_id;

  -- Edição de outro usuário é tratada pelas policies (profiles_update_admin).
  IF NOT is_self THEN
    RETURN NEW;
  END IF;

  -- Admin/super_admin editando o próprio profile: pode tudo.
  is_admin := public.is_super_admin(caller) OR public.has_role(caller, 'admin'::app_role);
  IF is_admin THEN
    RETURN NEW;
  END IF;

  -- Usuário comum editando a si mesmo: bloqueia mudanças em colunas sensíveis.
  IF NEW.perfil IS DISTINCT FROM OLD.perfil
     OR NEW.permissoes_extras IS DISTINCT FROM OLD.permissoes_extras
     OR NEW.permissoes_revogadas IS DISTINCT FROM OLD.permissoes_revogadas
     OR NEW.unidade_ids IS DISTINCT FROM OLD.unidade_ids
     OR NEW.unidade_ativa IS DISTINCT FROM OLD.unidade_ativa
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.friendly_id IS DISTINCT FROM OLD.friendly_id
  THEN
    RAISE EXCEPTION 'Operação não permitida: apenas administradores podem alterar perfil, permissões, unidades, status, tenant, email ou identificador.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_self_update_trg ON public.profiles;
CREATE TRIGGER profiles_guard_self_update_trg
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_guard_self_update();

COMMENT ON FUNCTION public.profiles_guard_self_update() IS
  'Equipe 2.1 — impede auto-escalonamento: usuário comum só pode alterar nome/telefone/avatar/assinatura no próprio profile.';

-- =====================================================================
-- Equipe 2.1 — Fase 2.8: remover policy duplicada em unidades
-- =====================================================================
-- `unidades_public_read` ((ativo = true) AND (tenant_id = current_tenant_id()))
-- é redundante com `und_select` que já cobre o mesmo escopo para authenticated
-- (e mais — inclui super_admin). Mantemos `und_select`.

DROP POLICY IF EXISTS unidades_public_read ON public.unidades;
