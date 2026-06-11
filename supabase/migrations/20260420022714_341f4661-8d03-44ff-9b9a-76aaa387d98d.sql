-- ─────────────────────────────────────────────────────────────────
-- 1) FINANCEIRO_SAIDAS — coluna de assinatura
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.financeiro_saidas
  ADD COLUMN IF NOT EXISTS assinatura_protocolo TEXT;

-- ─────────────────────────────────────────────────────────────────
-- 2) FINANCEIRO_SAIDAS — Funções de trigger
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.financeiro_saida_assign_protocolo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ano INT;
BEGIN
  v_ano := EXTRACT(YEAR FROM COALESCE(NEW.data, now()))::INT;
  NEW.protocolo := public.generate_protocolo_sequencial('SAI', v_ano);
  NEW.assinatura_protocolo := NULL;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.financeiro_saida_sign_protocolo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_assinatura TEXT;
BEGIN
  v_assinatura := public.gerar_assinatura_protocolo(
    NEW.tenant_id, NEW.protocolo, NEW.id, NEW.created_at
  );

  UPDATE public.financeiro_saidas
     SET assinatura_protocolo = v_assinatura
   WHERE id = NEW.id;

  INSERT INTO public.protocolo_auditoria
    (tenant_id, entidade, protocolo, registro_id, assinatura, evento, changed_by)
  VALUES
    (NEW.tenant_id, 'financeiro_saida', NEW.protocolo, NEW.id, v_assinatura, 'GERADO', auth.uid());

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_financeiro_saida_protocolo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.protocolo IS DISTINCT FROM OLD.protocolo THEN
    RAISE EXCEPTION 'Protocolo da saída é imutável (saída %)', OLD.id
      USING ERRCODE = '23514';
  END IF;
  IF OLD.assinatura_protocolo IS NOT NULL
     AND NEW.assinatura_protocolo IS DISTINCT FROM OLD.assinatura_protocolo THEN
    RAISE EXCEPTION 'Assinatura da saída é imutável (saída %)', OLD.id
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────
-- 3) FINANCEIRO_SAIDAS — Triggers (somente INSERT por enquanto;
--    a trigger de proteção é criada APÓS o backfill)
-- ─────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_financeiro_saida_assign_protocolo ON public.financeiro_saidas;
CREATE TRIGGER trg_financeiro_saida_assign_protocolo
  BEFORE INSERT ON public.financeiro_saidas
  FOR EACH ROW
  EXECUTE FUNCTION public.financeiro_saida_assign_protocolo();

DROP TRIGGER IF EXISTS trg_financeiro_saida_sign_protocolo ON public.financeiro_saidas;
CREATE TRIGGER trg_financeiro_saida_sign_protocolo
  AFTER INSERT ON public.financeiro_saidas
  FOR EACH ROW
  EXECUTE FUNCTION public.financeiro_saida_sign_protocolo();

-- Garante que a trigger de proteção NÃO existe antes do backfill
DROP TRIGGER IF EXISTS trg_protect_financeiro_saida_protocolo ON public.financeiro_saidas;

-- ─────────────────────────────────────────────────────────────────
-- 4) BACKFILL — Renumerar e assinar saídas existentes
--    Usa EXECUTE para que a coluna recém-criada seja resolvida em runtime
-- ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  r RECORD;
  v_ano INT;
  v_seq INT;
  v_novo_protocolo TEXT;
  v_assinatura TEXT;
BEGIN
  DELETE FROM public.protocolo_sequence WHERE prefixo = 'SAI';

  FOR r IN
    EXECUTE 'SELECT id, tenant_id, protocolo, data, created_at FROM public.financeiro_saidas ORDER BY created_at ASC, id ASC'
  LOOP
    v_ano := EXTRACT(YEAR FROM COALESCE(r.data, r.created_at))::INT;

    INSERT INTO public.protocolo_sequence (prefixo, ano, ultimo_numero)
    VALUES ('SAI', v_ano, 1)
    ON CONFLICT (prefixo, ano) DO UPDATE
      SET ultimo_numero = public.protocolo_sequence.ultimo_numero + 1,
          updated_at = now()
    RETURNING ultimo_numero INTO v_seq;

    v_novo_protocolo := 'SAI-' || v_ano::text || '-' || lpad(v_seq::text, 7, '0');

    v_assinatura := public.gerar_assinatura_protocolo(
      r.tenant_id, v_novo_protocolo, r.id, r.created_at
    );

    EXECUTE 'UPDATE public.financeiro_saidas SET protocolo = $1, assinatura_protocolo = $2 WHERE id = $3'
      USING v_novo_protocolo, v_assinatura, r.id;

    INSERT INTO public.protocolo_auditoria
      (tenant_id, entidade, protocolo, registro_id, assinatura, evento, changed_by)
    VALUES
      (r.tenant_id, 'financeiro_saida', v_novo_protocolo, r.id, v_assinatura, 'BACKFILL', NULL);
  END LOOP;
END $$;

-- Agora SIM, ativa a proteção de imutabilidade
CREATE TRIGGER trg_protect_financeiro_saida_protocolo
  BEFORE UPDATE ON public.financeiro_saidas
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_financeiro_saida_protocolo();

-- ─────────────────────────────────────────────────────────────────
-- 5) CONVENIO_FATURAS — coluna de assinatura
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.convenio_faturas
  ADD COLUMN IF NOT EXISTS assinatura_protocolo TEXT;

-- ─────────────────────────────────────────────────────────────────
-- 6) CONVENIO_FATURAS — Funções de trigger
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.convenio_fatura_assign_codigo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ano INT;
BEGIN
  v_ano := EXTRACT(YEAR FROM COALESCE(NEW.created_at, now()))::INT;
  NEW.codigo := public.generate_protocolo_sequencial('FAT', v_ano);
  NEW.assinatura_protocolo := NULL;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.convenio_fatura_sign_codigo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_assinatura TEXT;
BEGIN
  v_assinatura := public.gerar_assinatura_protocolo(
    NEW.tenant_id, NEW.codigo, NEW.id, NEW.created_at
  );

  UPDATE public.convenio_faturas
     SET assinatura_protocolo = v_assinatura
   WHERE id = NEW.id;

  INSERT INTO public.protocolo_auditoria
    (tenant_id, entidade, protocolo, registro_id, assinatura, evento, changed_by)
  VALUES
    (NEW.tenant_id, 'convenio_fatura', NEW.codigo, NEW.id, v_assinatura, 'GERADO', auth.uid());

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_convenio_fatura_codigo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.codigo IS DISTINCT FROM OLD.codigo THEN
    RAISE EXCEPTION 'Código da fatura é imutável (fatura %)', OLD.id
      USING ERRCODE = '23514';
  END IF;
  IF OLD.assinatura_protocolo IS NOT NULL
     AND NEW.assinatura_protocolo IS DISTINCT FROM OLD.assinatura_protocolo THEN
    RAISE EXCEPTION 'Assinatura da fatura é imutável (fatura %)', OLD.id
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_convenio_fatura_assign_codigo ON public.convenio_faturas;
CREATE TRIGGER trg_convenio_fatura_assign_codigo
  BEFORE INSERT ON public.convenio_faturas
  FOR EACH ROW
  EXECUTE FUNCTION public.convenio_fatura_assign_codigo();

DROP TRIGGER IF EXISTS trg_convenio_fatura_sign_codigo ON public.convenio_faturas;
CREATE TRIGGER trg_convenio_fatura_sign_codigo
  AFTER INSERT ON public.convenio_faturas
  FOR EACH ROW
  EXECUTE FUNCTION public.convenio_fatura_sign_codigo();

DROP TRIGGER IF EXISTS trg_protect_convenio_fatura_codigo ON public.convenio_faturas;
CREATE TRIGGER trg_protect_convenio_fatura_codigo
  BEFORE UPDATE ON public.convenio_faturas
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_convenio_fatura_codigo();

-- ─────────────────────────────────────────────────────────────────
-- 7) RPCs públicas de validação (SAI e FAT)
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.validate_protocolo_saida(_protocolo text)
RETURNS TABLE(valido boolean, protocolo text, data timestamp with time zone, status text, tipo text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r RECORD;
  v_recalc TEXT;
  v_status TEXT;
BEGIN
  SELECT s.id, s.tenant_id, s.protocolo, s.data, s.created_at,
         s.foi_pago, s.assinatura_protocolo
    INTO r
    FROM public.financeiro_saidas s
   WHERE s.protocolo = _protocolo
   LIMIT 1;

  IF NOT FOUND OR r.assinatura_protocolo IS NULL THEN
    RETURN QUERY SELECT false, _protocolo, NULL::timestamptz, NULL::text, 'financeiro_saida'::text;
    RETURN;
  END IF;

  v_recalc := public.gerar_assinatura_protocolo(r.tenant_id, r.protocolo, r.id, r.created_at);

  IF v_recalc = r.assinatura_protocolo THEN
    v_status := CASE WHEN r.foi_pago THEN 'Pago' ELSE 'Em aberto' END;
    RETURN QUERY SELECT true, r.protocolo, r.data, v_status, 'financeiro_saida'::text;
  ELSE
    RETURN QUERY SELECT false, r.protocolo, NULL::timestamptz, NULL::text, 'financeiro_saida'::text;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_protocolo_fatura(_codigo text)
RETURNS TABLE(valido boolean, protocolo text, data timestamp with time zone, status text, tipo text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r RECORD;
  v_recalc TEXT;
BEGIN
  SELECT f.id, f.tenant_id, f.codigo, f.created_at,
         f.status, f.assinatura_protocolo
    INTO r
    FROM public.convenio_faturas f
   WHERE f.codigo = _codigo
   LIMIT 1;

  IF NOT FOUND OR r.assinatura_protocolo IS NULL THEN
    RETURN QUERY SELECT false, _codigo, NULL::timestamptz, NULL::text, 'convenio_fatura'::text;
    RETURN;
  END IF;

  v_recalc := public.gerar_assinatura_protocolo(r.tenant_id, r.codigo, r.id, r.created_at);

  IF v_recalc = r.assinatura_protocolo THEN
    RETURN QUERY SELECT true, r.codigo, r.created_at, r.status, 'convenio_fatura'::text;
  ELSE
    RETURN QUERY SELECT false, r.codigo, NULL::timestamptz, NULL::text, 'convenio_fatura'::text;
  END IF;
END;
$$;