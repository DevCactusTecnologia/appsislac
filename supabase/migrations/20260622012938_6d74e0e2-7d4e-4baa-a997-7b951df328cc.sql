
-- ============================================================
-- CONVÊNIOS 2.0 — FASE 4
-- Competência e Fechamento Mensal
-- ============================================================

-- 1) Tabela convenio_competencias
CREATE TABLE IF NOT EXISTS public.convenio_competencias (
  id bigserial PRIMARY KEY,
  tenant_id uuid NOT NULL DEFAULT public.current_tenant_id(),
  competencia text NOT NULL, -- 'YYYY-MM'
  status text NOT NULL DEFAULT 'aberta',
  aberta_em timestamptz NOT NULL DEFAULT now(),
  aberta_por uuid NULL,
  fechada_em timestamptz NULL,
  fechada_por uuid NULL,
  reaberta_em timestamptz NULL,
  reaberta_por uuid NULL,
  motivo_reabertura text NULL,
  observacao text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT convenio_competencias_status_chk CHECK (status IN ('aberta','fechada')),
  CONSTRAINT convenio_competencias_format_chk CHECK (competencia ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  CONSTRAINT convenio_competencias_unique UNIQUE (tenant_id, competencia)
);

GRANT SELECT, INSERT, UPDATE ON public.convenio_competencias TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.convenio_competencias_id_seq TO authenticated;
GRANT ALL ON public.convenio_competencias TO service_role;
GRANT ALL ON SEQUENCE public.convenio_competencias_id_seq TO service_role;

ALTER TABLE public.convenio_competencias ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_convenio_competencias_tenant ON public.convenio_competencias(tenant_id);
CREATE INDEX IF NOT EXISTS idx_convenio_competencias_status ON public.convenio_competencias(tenant_id, status);

DROP POLICY IF EXISTS cc_select ON public.convenio_competencias;
CREATE POLICY cc_select ON public.convenio_competencias
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(), 'visualizar_financeiro'))
  );

DROP POLICY IF EXISTS cc_insert ON public.convenio_competencias;
CREATE POLICY cc_insert ON public.convenio_competencias
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'gestao_financeira')
  );

DROP POLICY IF EXISTS cc_update ON public.convenio_competencias;
CREATE POLICY cc_update ON public.convenio_competencias
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'gestao_financeira')
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'gestao_financeira')
  );
-- sem DELETE — competência nunca é apagada

DROP TRIGGER IF EXISTS trg_convenio_competencias_updated_at ON public.convenio_competencias;
CREATE TRIGGER trg_convenio_competencias_updated_at
  BEFORE UPDATE ON public.convenio_competencias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Trigger de auditoria
CREATE OR REPLACE FUNCTION public.audit_convenio_competencias()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_acao text;
BEGIN
  v_tenant := COALESCE(NEW.tenant_id, OLD.tenant_id);
  IF TG_OP = 'INSERT' THEN
    v_acao := 'competencia_aberta';
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'aberta' AND NEW.status = 'fechada' THEN
      v_acao := 'competencia_fechada';
    ELSIF OLD.status = 'fechada' AND NEW.status = 'aberta' THEN
      v_acao := 'competencia_reaberta';
    ELSIF OLD.observacao IS DISTINCT FROM NEW.observacao THEN
      v_acao := 'competencia_observacao_editada';
    ELSE
      v_acao := 'competencia_atualizada';
    END IF;
  ELSE
    v_acao := 'competencia_removida';
  END IF;
  INSERT INTO public.financeiro_audit(tenant_id, entidade, entidade_id, acao, antes, depois, ator_id)
  VALUES (
    v_tenant, 'convenio_competencias',
    COALESCE(NEW.id, OLD.id)::text, v_acao,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    auth.uid()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_convenio_competencias ON public.convenio_competencias;
CREATE TRIGGER trg_audit_convenio_competencias
  AFTER INSERT OR UPDATE ON public.convenio_competencias
  FOR EACH ROW EXECUTE FUNCTION public.audit_convenio_competencias();

-- 3) Vinculação das faturas: coluna competencia derivada de periodo_fim
ALTER TABLE public.convenio_faturas
  ADD COLUMN IF NOT EXISTS competencia text NULL;

-- backfill
UPDATE public.convenio_faturas
   SET competencia = to_char(periodo_fim, 'YYYY-MM')
 WHERE competencia IS NULL;

-- garante competência preenchida e consistente automaticamente
CREATE OR REPLACE FUNCTION public.convenio_fatura_set_competencia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.competencia := to_char(NEW.periodo_fim, 'YYYY-MM');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_convenio_fatura_set_competencia ON public.convenio_faturas;
CREATE TRIGGER trg_convenio_fatura_set_competencia
  BEFORE INSERT OR UPDATE OF periodo_fim ON public.convenio_faturas
  FOR EACH ROW EXECUTE FUNCTION public.convenio_fatura_set_competencia();

ALTER TABLE public.convenio_faturas
  ALTER COLUMN competencia SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_convenio_faturas_competencia
  ON public.convenio_faturas(tenant_id, competencia);

-- 4) Helper: competência está fechada?
CREATE OR REPLACE FUNCTION public.competencia_esta_fechada(_tenant uuid, _competencia text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.convenio_competencias
     WHERE tenant_id = _tenant
       AND competencia = _competencia
       AND status = 'fechada'
  );
$$;

GRANT EXECUTE ON FUNCTION public.competencia_esta_fechada(uuid, text) TO authenticated;

-- 5) Travamento operacional — bloqueia mutações de faturas em competência fechada
CREATE OR REPLACE FUNCTION public.guard_fatura_competencia_fechada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comp_old text;
  v_comp_new text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_comp_new := to_char(NEW.periodo_fim, 'YYYY-MM');
    IF public.competencia_esta_fechada(NEW.tenant_id, v_comp_new) THEN
      RAISE EXCEPTION 'competência % está fechada — não é possível criar faturas nela', v_comp_new
        USING ERRCODE = '42501';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    v_comp_old := to_char(OLD.periodo_fim, 'YYYY-MM');
    v_comp_new := to_char(NEW.periodo_fim, 'YYYY-MM');
    IF public.competencia_esta_fechada(OLD.tenant_id, v_comp_old) THEN
      -- permite somente alteração de observação em competência fechada
      IF OLD.periodo_inicio   IS DISTINCT FROM NEW.periodo_inicio
         OR OLD.periodo_fim   IS DISTINCT FROM NEW.periodo_fim
         OR OLD.subtotal      IS DISTINCT FROM NEW.subtotal
         OR OLD.desconto      IS DISTINCT FROM NEW.desconto
         OR OLD.total         IS DISTINCT FROM NEW.total
         OR OLD.status        IS DISTINCT FROM NEW.status
         OR OLD.convenio_id   IS DISTINCT FROM NEW.convenio_id
      THEN
        RAISE EXCEPTION 'fatura % pertence à competência fechada % — alteração estrutural bloqueada',
          OLD.codigo, v_comp_old USING ERRCODE = '42501';
      END IF;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_comp_old := to_char(OLD.periodo_fim, 'YYYY-MM');
    IF public.competencia_esta_fechada(OLD.tenant_id, v_comp_old) THEN
      RAISE EXCEPTION 'fatura em competência fechada não pode ser apagada' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_fatura_competencia ON public.convenio_faturas;
CREATE TRIGGER trg_guard_fatura_competencia
  BEFORE INSERT OR UPDATE OR DELETE ON public.convenio_faturas
  FOR EACH ROW EXECUTE FUNCTION public.guard_fatura_competencia_fechada();

-- guarda itens de fatura (não pode adicionar/remover/alterar em competência fechada)
CREATE OR REPLACE FUNCTION public.guard_fatura_item_competencia_fechada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fat record;
  v_comp text;
BEGIN
  SELECT tenant_id, periodo_fim INTO v_fat
    FROM public.convenio_faturas
    WHERE id = COALESCE(NEW.fatura_id, OLD.fatura_id);
  IF NOT FOUND THEN RETURN COALESCE(NEW, OLD); END IF;
  v_comp := to_char(v_fat.periodo_fim, 'YYYY-MM');
  IF public.competencia_esta_fechada(v_fat.tenant_id, v_comp) THEN
    RAISE EXCEPTION 'itens da fatura pertencem à competência fechada % — operação bloqueada', v_comp
      USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_fatura_item_competencia ON public.convenio_fatura_itens;
CREATE TRIGGER trg_guard_fatura_item_competencia
  BEFORE INSERT OR UPDATE OR DELETE ON public.convenio_fatura_itens
  FOR EACH ROW EXECUTE FUNCTION public.guard_fatura_item_competencia_fechada();

-- guarda glosas (também travadas dentro de competência fechada)
CREATE OR REPLACE FUNCTION public.guard_glosa_competencia_fechada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fat record;
  v_comp text;
BEGIN
  SELECT tenant_id, periodo_fim INTO v_fat
    FROM public.convenio_faturas
    WHERE id = COALESCE(NEW.fatura_id, OLD.fatura_id);
  IF NOT FOUND THEN RETURN COALESCE(NEW, OLD); END IF;
  v_comp := to_char(v_fat.periodo_fim, 'YYYY-MM');
  IF public.competencia_esta_fechada(v_fat.tenant_id, v_comp) THEN
    RAISE EXCEPTION 'glosa pertence à competência fechada % — operação bloqueada', v_comp
      USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_glosa_competencia ON public.convenio_glosas;
CREATE TRIGGER trg_guard_glosa_competencia
  BEFORE INSERT OR UPDATE OR DELETE ON public.convenio_glosas
  FOR EACH ROW EXECUTE FUNCTION public.guard_glosa_competencia_fechada();

-- 6) RPCs — abrir, fechar, reabrir competência
CREATE OR REPLACE FUNCTION public.competencia_abrir(p_competencia text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_id bigint;
BEGIN
  v_tenant := public.current_tenant_id();
  IF NOT public.has_permission(auth.uid(), 'gestao_financeira') THEN
    RAISE EXCEPTION 'sem permissão para abrir competência' USING ERRCODE = '42501';
  END IF;
  IF p_competencia !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION 'competência inválida: % (use YYYY-MM)', p_competencia;
  END IF;
  INSERT INTO public.convenio_competencias(tenant_id, competencia, aberta_por)
    VALUES (v_tenant, p_competencia, auth.uid())
    ON CONFLICT (tenant_id, competencia) DO UPDATE
      SET status = CASE WHEN public.convenio_competencias.status = 'fechada'
                        THEN public.convenio_competencias.status
                        ELSE 'aberta' END
    RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.competencia_abrir(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.competencia_fechar(p_competencia text, p_observacao text DEFAULT '')
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_id bigint;
BEGIN
  v_tenant := public.current_tenant_id();
  IF NOT public.has_permission(auth.uid(), 'gestao_financeira') THEN
    RAISE EXCEPTION 'sem permissão para fechar competência' USING ERRCODE = '42501';
  END IF;
  -- garante existência (cria automaticamente se não houver)
  INSERT INTO public.convenio_competencias(tenant_id, competencia, aberta_por)
    VALUES (v_tenant, p_competencia, auth.uid())
    ON CONFLICT (tenant_id, competencia) DO NOTHING;

  UPDATE public.convenio_competencias
     SET status = 'fechada',
         fechada_em = now(),
         fechada_por = auth.uid(),
         observacao = COALESCE(NULLIF(btrim(p_observacao), ''), observacao)
   WHERE tenant_id = v_tenant
     AND competencia = p_competencia
     AND status = 'aberta'
   RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'competência % já está fechada ou não existe', p_competencia;
  END IF;
  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.competencia_fechar(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.competencia_reabrir(p_competencia text, p_motivo text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_id bigint;
BEGIN
  v_tenant := public.current_tenant_id();
  -- somente admin ou super_admin podem reabrir
  IF NOT (public.is_super_admin() OR public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'apenas admin/super_admin podem reabrir competência' USING ERRCODE = '42501';
  END IF;
  IF p_motivo IS NULL OR length(btrim(p_motivo)) = 0 THEN
    RAISE EXCEPTION 'motivo da reabertura é obrigatório';
  END IF;
  UPDATE public.convenio_competencias
     SET status = 'aberta',
         reaberta_em = now(),
         reaberta_por = auth.uid(),
         motivo_reabertura = btrim(p_motivo),
         fechada_em = NULL,
         fechada_por = NULL
   WHERE tenant_id = v_tenant
     AND competencia = p_competencia
     AND status = 'fechada'
   RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'competência % não está fechada', p_competencia;
  END IF;
  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.competencia_reabrir(text, text) TO authenticated;

-- 7) View SSOT — resumo por competência
CREATE OR REPLACE VIEW public.convenio_competencia_resumo AS
WITH base AS (
  SELECT
    f.tenant_id,
    f.competencia,
    COUNT(*)                                       AS qtd_faturas,
    SUM(f.total)                                   AS total_faturado,
    SUM(CASE WHEN f.status = 'paga' THEN f.total ELSE 0 END) AS total_recebido,
    SUM(CASE WHEN f.status = 'cancelada' THEN f.total ELSE 0 END) AS total_cancelado
  FROM public.convenio_faturas f
  GROUP BY f.tenant_id, f.competencia
),
glos AS (
  SELECT
    f.tenant_id,
    f.competencia,
    SUM(g.valor_glosado) FILTER (WHERE g.status IN ('aberta','reapresentada','aceita_perda')) AS total_glosado,
    SUM(g.valor_glosado) FILTER (WHERE g.status = 'reapresentada') AS total_reapresentado,
    SUM(g.valor_glosado) FILTER (WHERE g.status = 'aberta')        AS total_glosado_aberto
  FROM public.convenio_glosas g
  JOIN public.convenio_faturas f ON f.id = g.fatura_id
  GROUP BY f.tenant_id, f.competencia
)
SELECT
  COALESCE(b.tenant_id, c.tenant_id) AS tenant_id,
  COALESCE(b.competencia, c.competencia) AS competencia,
  COALESCE(c.status, 'aberta') AS status,
  c.fechada_em,
  c.fechada_por,
  c.aberta_em,
  c.aberta_por,
  COALESCE(b.qtd_faturas, 0) AS qtd_faturas,
  COALESCE(b.total_faturado, 0) AS total_faturado,
  COALESCE(b.total_recebido, 0) AS total_recebido,
  COALESCE(b.total_cancelado, 0) AS total_cancelado,
  COALESCE(g.total_glosado, 0) AS total_glosado,
  COALESCE(g.total_reapresentado, 0) AS total_reapresentado,
  COALESCE(g.total_glosado_aberto, 0) AS total_glosado_aberto,
  COALESCE(b.total_faturado, 0)
    - COALESCE(b.total_recebido, 0)
    - COALESCE(b.total_cancelado, 0)
    - COALESCE(g.total_glosado_aberto, 0) AS saldo_pendente
FROM base b
FULL OUTER JOIN public.convenio_competencias c
  ON c.tenant_id = b.tenant_id AND c.competencia = b.competencia
LEFT JOIN glos g
  ON g.tenant_id = COALESCE(b.tenant_id, c.tenant_id)
 AND g.competencia = COALESCE(b.competencia, c.competencia);

ALTER VIEW public.convenio_competencia_resumo SET (security_invoker = on);
GRANT SELECT ON public.convenio_competencia_resumo TO authenticated;
GRANT SELECT ON public.convenio_competencia_resumo TO service_role;

COMMENT ON VIEW public.convenio_competencia_resumo IS
  'Convênios 2.0 Fase 4 — SSOT por competência: faturado, recebido, glosado, reapresentado, saldo e status do fechamento.';
