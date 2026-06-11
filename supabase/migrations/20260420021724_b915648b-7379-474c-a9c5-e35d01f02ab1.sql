-- ============================================================
-- 1. COLUNA DE ASSINATURA NO ORCAMENTO
-- ============================================================
ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS assinatura_protocolo TEXT;

-- ============================================================
-- 2. TRIGGER BEFORE INSERT: gera código server-side
-- ============================================================
CREATE OR REPLACE FUNCTION public.orcamento_assign_codigo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ano INT;
BEGIN
  v_ano := EXTRACT(YEAR FROM COALESCE(NEW.data, now()))::INT;
  NEW.codigo := public.generate_protocolo_sequencial('ORC', v_ano);
  NEW.assinatura_protocolo := NULL;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_orcamento_assign_codigo ON public.orcamentos;
CREATE TRIGGER trg_orcamento_assign_codigo
BEFORE INSERT ON public.orcamentos
FOR EACH ROW
EXECUTE FUNCTION public.orcamento_assign_codigo();

-- ============================================================
-- 3. TRIGGER AFTER INSERT: assina HMAC + auditoria
-- ============================================================
CREATE OR REPLACE FUNCTION public.orcamento_sign_codigo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_assinatura TEXT;
BEGIN
  v_assinatura := public.gerar_assinatura_protocolo(
    NEW.tenant_id, NEW.codigo, NEW.id, NEW.created_at
  );

  UPDATE public.orcamentos
     SET assinatura_protocolo = v_assinatura
   WHERE id = NEW.id;

  INSERT INTO public.protocolo_auditoria
    (tenant_id, entidade, protocolo, registro_id, assinatura, evento, changed_by)
  VALUES
    (NEW.tenant_id, 'orcamento', NEW.codigo, NEW.id, v_assinatura, 'GERADO', auth.uid());

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_orcamento_sign_codigo ON public.orcamentos;
CREATE TRIGGER trg_orcamento_sign_codigo
AFTER INSERT ON public.orcamentos
FOR EACH ROW
EXECUTE FUNCTION public.orcamento_sign_codigo();

-- ============================================================
-- 4. TRIGGER BEFORE UPDATE: imutabilidade
-- ============================================================
CREATE OR REPLACE FUNCTION public.protect_orcamento_codigo()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.codigo IS DISTINCT FROM OLD.codigo THEN
    RAISE EXCEPTION 'Código do orçamento é imutável (orcamento %)', OLD.id
      USING ERRCODE = '23514';
  END IF;
  IF OLD.assinatura_protocolo IS NOT NULL
     AND NEW.assinatura_protocolo IS DISTINCT FROM OLD.assinatura_protocolo THEN
    RAISE EXCEPTION 'Assinatura do orçamento é imutável (orcamento %)', OLD.id
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_protect_orcamento_codigo ON public.orcamentos;
CREATE TRIGGER trg_protect_orcamento_codigo
BEFORE UPDATE ON public.orcamentos
FOR EACH ROW
EXECUTE FUNCTION public.protect_orcamento_codigo();

-- ============================================================
-- 5. RPC PÚBLICA DE VALIDAÇÃO PARA ORÇAMENTOS
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_protocolo_orcamento(_codigo TEXT)
RETURNS TABLE(valido BOOLEAN, protocolo TEXT, data TIMESTAMPTZ, status TEXT, tipo TEXT)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r RECORD;
  v_recalc TEXT;
  v_status TEXT;
BEGIN
  SELECT o.id, o.tenant_id, o.codigo, o.data, o.created_at,
         o.convertido, o.assinatura_protocolo
    INTO r
    FROM public.orcamentos o
   WHERE o.codigo = _codigo
   LIMIT 1;

  IF NOT FOUND OR r.assinatura_protocolo IS NULL THEN
    RETURN QUERY SELECT false, _codigo, NULL::timestamptz, NULL::text, 'orcamento'::text;
    RETURN;
  END IF;

  v_recalc := public.gerar_assinatura_protocolo(r.tenant_id, r.codigo, r.id, r.created_at);

  IF v_recalc = r.assinatura_protocolo THEN
    v_status := CASE WHEN r.convertido THEN 'Convertido em atendimento' ELSE 'Aberto' END;
    RETURN QUERY SELECT true, r.codigo, r.data, v_status, 'orcamento'::text;
  ELSE
    RETURN QUERY SELECT false, r.codigo, NULL::timestamptz, NULL::text, 'orcamento'::text;
  END IF;
END;
$function$;

-- ============================================================
-- 6. BACKFILL: renumera orçamentos existentes em ordem cronológica
-- ============================================================
DO $$
DECLARE
  r RECORD;
  v_ano INT;
  v_novo_codigo TEXT;
  v_assinatura TEXT;
  v_old_codigo TEXT;
BEGIN
  -- Limpa qualquer sequência ORC existente para começar do zero
  DELETE FROM public.protocolo_sequence WHERE prefixo = 'ORC';

  -- Desabilita triggers de imutabilidade temporariamente
  ALTER TABLE public.orcamentos DISABLE TRIGGER trg_protect_orcamento_codigo;

  FOR r IN
    SELECT id, tenant_id, codigo, created_at, data
      FROM public.orcamentos
     ORDER BY created_at ASC, id ASC
  LOOP
    v_ano := EXTRACT(YEAR FROM COALESCE(r.data, r.created_at))::INT;
    v_old_codigo := r.codigo;
    v_novo_codigo := public.generate_protocolo_sequencial('ORC', v_ano);
    v_assinatura := public.gerar_assinatura_protocolo(r.tenant_id, v_novo_codigo, r.id, r.created_at);

    UPDATE public.orcamentos
       SET codigo = v_novo_codigo,
           assinatura_protocolo = v_assinatura
     WHERE id = r.id;

    INSERT INTO public.protocolo_auditoria
      (tenant_id, entidade, protocolo, registro_id, assinatura, evento, changed_by)
    VALUES
      (r.tenant_id, 'orcamento', v_novo_codigo, r.id, v_assinatura, 'BACKFILL_RENUMERADO', NULL);
  END LOOP;

  -- Reabilita triggers
  ALTER TABLE public.orcamentos ENABLE TRIGGER trg_protect_orcamento_codigo;
END $$;