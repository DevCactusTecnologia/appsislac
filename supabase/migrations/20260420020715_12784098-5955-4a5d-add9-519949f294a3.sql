-- ============================================================================
-- SISLAC: Sistema de Protocolo Blindado para ATENDIMENTOS (piloto)
-- Padrão: ATD-AAAA-NNNNNNN | sequência atômica por ano | HMAC-SHA256
-- Imutável | Auditável | Backfill com renumeração
-- ============================================================================

-- 0) Garantir pgcrypto (já existe em extensions)
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 1) Sequência atômica por (prefixo, ano)
CREATE TABLE IF NOT EXISTS public.protocolo_sequence (
  prefixo TEXT NOT NULL,
  ano     INT  NOT NULL,
  ultimo_numero INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (prefixo, ano)
);

ALTER TABLE public.protocolo_sequence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS protseq_no_access ON public.protocolo_sequence;
CREATE POLICY protseq_no_access ON public.protocolo_sequence
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- 2) Chave HMAC por tenant em app_settings
DO $$
BEGIN
  INSERT INTO public.app_settings (tenant_id, key, value)
  SELECT t.id,
         'protocolo_hmac_key',
         jsonb_build_object('hex', encode(extensions.gen_random_bytes(64), 'hex'),
                            'rotated_at', now())
    FROM public.tenants t
   WHERE NOT EXISTS (
     SELECT 1 FROM public.app_settings s
      WHERE s.tenant_id = t.id AND s.key = 'protocolo_hmac_key'
   );
END $$;

CREATE OR REPLACE FUNCTION public._get_protocolo_hmac_key(_tenant_id uuid)
RETURNS BYTEA
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hex text;
BEGIN
  SELECT (value->>'hex') INTO v_hex
    FROM public.app_settings
   WHERE tenant_id = _tenant_id AND key = 'protocolo_hmac_key'
   LIMIT 1;

  IF v_hex IS NULL THEN
    v_hex := encode(extensions.gen_random_bytes(64), 'hex');
    INSERT INTO public.app_settings (tenant_id, key, value)
    VALUES (_tenant_id, 'protocolo_hmac_key',
            jsonb_build_object('hex', v_hex, 'rotated_at', now()))
    ON CONFLICT (tenant_id, key) DO NOTHING;

    SELECT (value->>'hex') INTO v_hex
      FROM public.app_settings
     WHERE tenant_id = _tenant_id AND key = 'protocolo_hmac_key';
  END IF;

  RETURN decode(v_hex, 'hex');
END;
$$;

REVOKE ALL ON FUNCTION public._get_protocolo_hmac_key(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._get_protocolo_hmac_key(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public._get_protocolo_hmac_key(uuid) FROM anon;

-- 3) Geração atômica de protocolo
CREATE OR REPLACE FUNCTION public.generate_protocolo_sequencial(
  _prefixo TEXT,
  _ano INT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_numero INT;
BEGIN
  INSERT INTO public.protocolo_sequence (prefixo, ano, ultimo_numero)
  VALUES (_prefixo, _ano, 1)
  ON CONFLICT (prefixo, ano) DO UPDATE
    SET ultimo_numero = public.protocolo_sequence.ultimo_numero + 1,
        updated_at = now()
  RETURNING ultimo_numero INTO v_numero;

  RETURN _prefixo || '-' || _ano::text || '-' || lpad(v_numero::text, 7, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.generate_protocolo_sequencial(text, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.generate_protocolo_sequencial(text, int) FROM authenticated;
REVOKE ALL ON FUNCTION public.generate_protocolo_sequencial(text, int) FROM anon;

-- 4) Assinatura HMAC-SHA256
CREATE OR REPLACE FUNCTION public.gerar_assinatura_protocolo(
  _tenant_id   uuid,
  _protocolo   text,
  _registro_id bigint,
  _timestamp   timestamptz
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_payload TEXT;
  v_key BYTEA;
BEGIN
  v_payload := _protocolo || '|' || _registro_id::text || '|'
            || to_char(_timestamp AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  v_key := public._get_protocolo_hmac_key(_tenant_id);
  RETURN encode(extensions.hmac(v_payload::bytea, v_key, 'sha256'), 'hex');
END;
$$;

REVOKE ALL ON FUNCTION public.gerar_assinatura_protocolo(uuid, text, bigint, timestamptz) FROM PUBLIC;

-- 5) Coluna assinatura + índice único de protocolo
ALTER TABLE public.atendimentos
  ADD COLUMN IF NOT EXISTS assinatura_protocolo TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS atendimentos_protocolo_unique
  ON public.atendimentos (protocolo);

-- 6) Auditoria de protocolos
CREATE TABLE IF NOT EXISTS public.protocolo_auditoria (
  id          BIGSERIAL PRIMARY KEY,
  tenant_id   uuid NOT NULL,
  entidade    TEXT NOT NULL,
  protocolo   TEXT NOT NULL,
  registro_id BIGINT NOT NULL,
  assinatura  TEXT NOT NULL,
  evento      TEXT NOT NULL,
  ip_origem   INET,
  user_agent  TEXT,
  changed_by  uuid,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS protaud_protocolo_idx
  ON public.protocolo_auditoria (protocolo);
CREATE INDEX IF NOT EXISTS protaud_tenant_changed_idx
  ON public.protocolo_auditoria (tenant_id, changed_at DESC);

ALTER TABLE public.protocolo_auditoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS protaud_select ON public.protocolo_auditoria;
CREATE POLICY protaud_select ON public.protocolo_auditoria
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (tenant_id = public.current_tenant_id()
        AND (public.has_role(auth.uid(), 'admin'::app_role)
             OR public.has_permission(auth.uid(), 'auditoria')))
  );

-- 7) BEFORE INSERT: gera protocolo (sempre sobrescreve)
CREATE OR REPLACE FUNCTION public.atendimento_assign_protocolo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ano INT;
BEGIN
  v_ano := EXTRACT(YEAR FROM COALESCE(NEW.data, now()))::INT;
  NEW.protocolo := public.generate_protocolo_sequencial('ATD', v_ano);
  NEW.assinatura_protocolo := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_atendimento_assign_protocolo ON public.atendimentos;
CREATE TRIGGER trg_atendimento_assign_protocolo
  BEFORE INSERT ON public.atendimentos
  FOR EACH ROW
  EXECUTE FUNCTION public.atendimento_assign_protocolo();

-- 8) AFTER INSERT: assina + auditoria
CREATE OR REPLACE FUNCTION public.atendimento_sign_protocolo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assinatura TEXT;
BEGIN
  v_assinatura := public.gerar_assinatura_protocolo(
    NEW.tenant_id, NEW.protocolo, NEW.id, NEW.created_at
  );

  UPDATE public.atendimentos
     SET assinatura_protocolo = v_assinatura
   WHERE id = NEW.id;

  INSERT INTO public.protocolo_auditoria
    (tenant_id, entidade, protocolo, registro_id, assinatura, evento, changed_by)
  VALUES
    (NEW.tenant_id, 'atendimento', NEW.protocolo, NEW.id, v_assinatura, 'GERADO', auth.uid());

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_atendimento_sign_protocolo ON public.atendimentos;
CREATE TRIGGER trg_atendimento_sign_protocolo
  AFTER INSERT ON public.atendimentos
  FOR EACH ROW
  EXECUTE FUNCTION public.atendimento_sign_protocolo();

-- 9) BEFORE UPDATE: imutabilidade
CREATE OR REPLACE FUNCTION public.protect_atendimento_protocolo()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.protocolo IS DISTINCT FROM OLD.protocolo THEN
    RAISE EXCEPTION 'Protocolo é imutável (atendimento %)', OLD.id
      USING ERRCODE = '23514';
  END IF;
  IF OLD.assinatura_protocolo IS NOT NULL
     AND NEW.assinatura_protocolo IS DISTINCT FROM OLD.assinatura_protocolo THEN
    RAISE EXCEPTION 'Assinatura do protocolo é imutável (atendimento %)', OLD.id
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_atendimento_protocolo ON public.atendimentos;
CREATE TRIGGER trg_protect_atendimento_protocolo
  BEFORE UPDATE ON public.atendimentos
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_atendimento_protocolo();

-- 10) BACKFILL: renumera todos os atendimentos para ATD-AAAA-NNNNNNN
DO $$
DECLARE
  r RECORD;
  v_ano INT;
  v_novo TEXT;
  v_ass TEXT;
BEGIN
  DELETE FROM public.protocolo_sequence WHERE prefixo = 'ATD';

  ALTER TABLE public.atendimentos DISABLE TRIGGER trg_protect_atendimento_protocolo;

  FOR r IN
    SELECT id, tenant_id, protocolo AS protocolo_antigo, data, created_at
      FROM public.atendimentos
     ORDER BY data ASC, id ASC
  LOOP
    v_ano := EXTRACT(YEAR FROM r.data)::INT;
    v_novo := public.generate_protocolo_sequencial('ATD', v_ano);
    v_ass := public.gerar_assinatura_protocolo(r.tenant_id, v_novo, r.id, r.created_at);

    UPDATE public.atendimentos
       SET protocolo = v_novo,
           assinatura_protocolo = v_ass
     WHERE id = r.id;

    UPDATE public.atendimento_audit
       SET protocolo = v_novo
     WHERE atendimento_id = r.id;

    INSERT INTO public.protocolo_auditoria
      (tenant_id, entidade, protocolo, registro_id, assinatura, evento)
    VALUES
      (r.tenant_id, 'atendimento', v_novo, r.id, v_ass, 'BACKFILL');
  END LOOP;

  ALTER TABLE public.atendimentos ENABLE TRIGGER trg_protect_atendimento_protocolo;
END $$;

-- 11) Validação pública (sem PII)
CREATE OR REPLACE FUNCTION public.validate_protocolo_atendimento(
  _protocolo TEXT
)
RETURNS TABLE (
  valido     boolean,
  protocolo  text,
  data       timestamptz,
  status     text,
  tipo       text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_recalc TEXT;
BEGIN
  SELECT a.id, a.tenant_id, a.protocolo, a.data, a.created_at,
         a.status_atendimento, a.assinatura_protocolo
    INTO r
    FROM public.atendimentos a
   WHERE a.protocolo = _protocolo
   LIMIT 1;

  IF NOT FOUND OR r.assinatura_protocolo IS NULL THEN
    RETURN QUERY SELECT false, _protocolo, NULL::timestamptz, NULL::text, 'atendimento'::text;
    RETURN;
  END IF;

  v_recalc := public.gerar_assinatura_protocolo(r.tenant_id, r.protocolo, r.id, r.created_at);

  IF v_recalc = r.assinatura_protocolo THEN
    RETURN QUERY SELECT true, r.protocolo, r.data, r.status_atendimento, 'atendimento'::text;
  ELSE
    RETURN QUERY SELECT false, r.protocolo, NULL::timestamptz, NULL::text, 'atendimento'::text;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_protocolo_atendimento(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.validate_protocolo_atendimento(text) TO anon, authenticated;