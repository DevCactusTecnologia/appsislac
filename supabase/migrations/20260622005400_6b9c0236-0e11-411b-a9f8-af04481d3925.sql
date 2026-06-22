
-- ============================================================
-- CONVÊNIOS 2.0 — FASE 3
-- Glosa formal e Reapresentação auditável
-- ============================================================

-- 1. Extensões em convenio_faturas para rastrear reapresentações
ALTER TABLE public.convenio_faturas
  ADD COLUMN IF NOT EXISTS fatura_origem_id bigint NULL REFERENCES public.convenio_faturas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tentativa integer NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_convenio_faturas_fatura_origem
  ON public.convenio_faturas(fatura_origem_id) WHERE fatura_origem_id IS NOT NULL;

COMMENT ON COLUMN public.convenio_faturas.fatura_origem_id IS
  'Convênios 2.0 Fase 3 — fatura raiz quando esta é reapresentação. NULL = fatura original.';
COMMENT ON COLUMN public.convenio_faturas.tentativa IS
  'Convênios 2.0 Fase 3 — 1=original, 2=primeira reapresentação, etc.';

-- 2. Tabela convenio_glosas
CREATE TABLE IF NOT EXISTS public.convenio_glosas (
  id bigserial PRIMARY KEY,
  tenant_id uuid NOT NULL DEFAULT public.current_tenant_id(),
  fatura_id bigint NOT NULL REFERENCES public.convenio_faturas(id) ON DELETE RESTRICT,
  fatura_item_id bigint NULL REFERENCES public.convenio_fatura_itens(id) ON DELETE SET NULL,
  valor_original numeric(14,2) NOT NULL CHECK (valor_original >= 0),
  valor_glosado numeric(14,2) NOT NULL CHECK (valor_glosado >= 0),
  motivo text NOT NULL,
  status text NOT NULL DEFAULT 'aberta',
  reapresentada_em_fatura_id bigint NULL REFERENCES public.convenio_faturas(id) ON DELETE SET NULL,
  reapresentada_em timestamptz NULL,
  reapresentada_por uuid NULL,
  cancelada_em timestamptz NULL,
  cancelada_por uuid NULL,
  motivo_cancelamento text NULL,
  observacao text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT convenio_glosas_status_chk CHECK (status IN ('aberta','reapresentada','aceita_perda','cancelada')),
  CONSTRAINT convenio_glosas_valor_chk CHECK (valor_glosado <= valor_original)
);

GRANT SELECT, INSERT, UPDATE ON public.convenio_glosas TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.convenio_glosas_id_seq TO authenticated;
GRANT ALL ON public.convenio_glosas TO service_role;
GRANT ALL ON SEQUENCE public.convenio_glosas_id_seq TO service_role;

ALTER TABLE public.convenio_glosas ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_convenio_glosas_tenant ON public.convenio_glosas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_convenio_glosas_fatura ON public.convenio_glosas(fatura_id);
CREATE INDEX IF NOT EXISTS idx_convenio_glosas_reapres ON public.convenio_glosas(reapresentada_em_fatura_id) WHERE reapresentada_em_fatura_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_convenio_glosas_status ON public.convenio_glosas(status);

-- 2.1 RLS policies
DROP POLICY IF EXISTS cg_select ON public.convenio_glosas;
CREATE POLICY cg_select ON public.convenio_glosas
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(), 'visualizar_financeiro'))
  );

DROP POLICY IF EXISTS cg_insert ON public.convenio_glosas;
CREATE POLICY cg_insert ON public.convenio_glosas
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'gestao_financeira')
  );

DROP POLICY IF EXISTS cg_update ON public.convenio_glosas;
CREATE POLICY cg_update ON public.convenio_glosas
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'gestao_financeira')
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'gestao_financeira')
  );

-- nota: sem DELETE — glosa nunca é apagada (apenas cancelada via status)

-- 2.2 updated_at
DROP TRIGGER IF EXISTS trg_convenio_glosas_updated_at ON public.convenio_glosas;
CREATE TRIGGER trg_convenio_glosas_updated_at
  BEFORE UPDATE ON public.convenio_glosas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2.3 trigger de auditoria
CREATE OR REPLACE FUNCTION public.audit_convenio_glosas()
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
    v_acao := 'glosa_criada';
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'aberta' AND NEW.status = 'reapresentada' THEN
      v_acao := 'glosa_reapresentada';
    ELSIF OLD.status <> 'cancelada' AND NEW.status = 'cancelada' THEN
      v_acao := 'glosa_cancelada';
    ELSIF OLD.motivo IS DISTINCT FROM NEW.motivo THEN
      v_acao := 'glosa_motivo_editado';
    ELSE
      v_acao := 'glosa_atualizada';
    END IF;
  ELSE
    v_acao := 'glosa_removida';
  END IF;

  INSERT INTO public.financeiro_audit(tenant_id, entidade, entidade_id, acao, antes, depois, ator_id)
  VALUES (
    v_tenant,
    'convenio_glosas',
    COALESCE(NEW.id, OLD.id)::text,
    v_acao,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    auth.uid()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_convenio_glosas ON public.convenio_glosas;
CREATE TRIGGER trg_audit_convenio_glosas
  AFTER INSERT OR UPDATE ON public.convenio_glosas
  FOR EACH ROW EXECUTE FUNCTION public.audit_convenio_glosas();

-- 3. RPC — registrar glosa (parcial ou total)
CREATE OR REPLACE FUNCTION public.convenio_fatura_glosar(
  p_fatura_id bigint,
  p_motivo text,
  p_itens jsonb  -- [{"item_id": <bigint>, "valor_glosado": <numeric>}]
)
RETURNS TABLE(glosa_id bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_fat record;
  v_item jsonb;
  v_item_row record;
  v_valor_glosado numeric(14,2);
  v_new_id bigint;
BEGIN
  v_tenant := public.current_tenant_id();
  IF NOT public.has_permission(auth.uid(), 'gestao_financeira') THEN
    RAISE EXCEPTION 'sem permissão para glosar fatura' USING ERRCODE = '42501';
  END IF;
  IF p_motivo IS NULL OR length(btrim(p_motivo)) = 0 THEN
    RAISE EXCEPTION 'motivo da glosa é obrigatório';
  END IF;
  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'informe ao menos um item para glosar';
  END IF;

  SELECT * INTO v_fat FROM public.convenio_faturas
   WHERE id = p_fatura_id AND tenant_id = v_tenant;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'fatura % não encontrada neste tenant', p_fatura_id;
  END IF;
  IF v_fat.status = 'cancelada' THEN
    RAISE EXCEPTION 'fatura cancelada não pode ser glosada';
  END IF;

  -- itera os itens
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    SELECT * INTO v_item_row FROM public.convenio_fatura_itens
      WHERE id = (v_item->>'item_id')::bigint
        AND fatura_id = p_fatura_id
        AND tenant_id = v_tenant;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'item % não pertence à fatura %', (v_item->>'item_id'), p_fatura_id;
    END IF;
    v_valor_glosado := COALESCE((v_item->>'valor_glosado')::numeric, v_item_row.valor);
    IF v_valor_glosado <= 0 OR v_valor_glosado > v_item_row.valor THEN
      RAISE EXCEPTION 'valor glosado inválido para item %: % (máx %)',
        v_item_row.id, v_valor_glosado, v_item_row.valor;
    END IF;

    -- impede glosa duplicada aberta sobre o mesmo item
    IF EXISTS (
      SELECT 1 FROM public.convenio_glosas
        WHERE fatura_item_id = v_item_row.id
          AND status = 'aberta'
    ) THEN
      RAISE EXCEPTION 'já existe glosa aberta para o item %', v_item_row.id;
    END IF;

    INSERT INTO public.convenio_glosas(
      tenant_id, fatura_id, fatura_item_id,
      valor_original, valor_glosado, motivo, status, created_by
    ) VALUES (
      v_tenant, p_fatura_id, v_item_row.id,
      v_item_row.valor, v_valor_glosado, btrim(p_motivo), 'aberta', auth.uid()
    ) RETURNING id INTO v_new_id;

    glosa_id := v_new_id;
    RETURN NEXT;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.convenio_fatura_glosar(bigint, text, jsonb) TO authenticated;

-- 4. RPC — reapresentação (cria nova fatura vinculada à original)
CREATE OR REPLACE FUNCTION public.convenio_fatura_reapresentar(
  p_fatura_origem_id bigint,
  p_glosa_ids bigint[],
  p_motivo text,
  p_periodo_inicio date,
  p_periodo_fim date
)
RETURNS TABLE(fatura_id bigint, codigo text, tentativa integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_origem record;
  v_raiz_id bigint;
  v_tentativa integer;
  v_new_fatura record;
  v_glosa record;
  v_total_itens int := 0;
BEGIN
  v_tenant := public.current_tenant_id();
  IF NOT public.has_permission(auth.uid(), 'gestao_financeira') THEN
    RAISE EXCEPTION 'sem permissão para reapresentar fatura' USING ERRCODE = '42501';
  END IF;
  IF p_motivo IS NULL OR length(btrim(p_motivo)) = 0 THEN
    RAISE EXCEPTION 'motivo da reapresentação é obrigatório';
  END IF;
  IF p_glosa_ids IS NULL OR array_length(p_glosa_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'selecione ao menos uma glosa para reapresentar';
  END IF;

  SELECT * INTO v_origem FROM public.convenio_faturas
    WHERE id = p_fatura_origem_id AND tenant_id = v_tenant;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'fatura origem % não encontrada', p_fatura_origem_id;
  END IF;

  -- cadeia: raiz é a primeira fatura sem origem
  v_raiz_id := COALESCE(v_origem.fatura_origem_id, v_origem.id);
  -- nova tentativa = max(tentativa) da cadeia + 1
  SELECT COALESCE(MAX(tentativa),1) + 1 INTO v_tentativa
    FROM public.convenio_faturas
    WHERE tenant_id = v_tenant
      AND (id = v_raiz_id OR fatura_origem_id = v_raiz_id);

  -- cria nova fatura "aberta", vinculada à raiz
  INSERT INTO public.convenio_faturas(
    tenant_id, codigo, convenio_id, periodo_inicio, periodo_fim,
    subtotal, desconto, total, status, observacao,
    fatura_origem_id, tentativa
  ) VALUES (
    v_tenant,
    'FAT-TMP-' || extract(epoch from now())::bigint,
    v_origem.convenio_id,
    p_periodo_inicio, p_periodo_fim,
    0, 0, 0, 'aberta',
    'Reapresentação da fatura ' || v_origem.codigo || ' — motivo: ' || btrim(p_motivo),
    v_raiz_id, v_tentativa
  ) RETURNING * INTO v_new_fatura;

  -- copia os itens dos itens glosados para a nova fatura
  FOR v_glosa IN
    SELECT g.*, fi.atendimento_exame_id, fi.valor AS item_valor
      FROM public.convenio_glosas g
      LEFT JOIN public.convenio_fatura_itens fi ON fi.id = g.fatura_item_id
      WHERE g.id = ANY(p_glosa_ids)
        AND g.tenant_id = v_tenant
        AND g.fatura_id = p_fatura_origem_id
        AND g.status = 'aberta'
        AND g.fatura_item_id IS NOT NULL
  LOOP
    -- só replica o item se ele ainda não está em outra fatura ativa
    IF EXISTS (
      SELECT 1 FROM public.convenio_fatura_itens fi2
       JOIN public.convenio_faturas f2 ON f2.id = fi2.fatura_id
       WHERE fi2.atendimento_exame_id = v_glosa.atendimento_exame_id
         AND f2.status <> 'cancelada'
         AND fi2.fatura_id <> p_fatura_origem_id
    ) THEN
      RAISE EXCEPTION 'exame % já está em outra fatura ativa — cancele antes de reapresentar', v_glosa.atendimento_exame_id;
    END IF;

    INSERT INTO public.convenio_fatura_itens(tenant_id, fatura_id, atendimento_exame_id, valor)
    VALUES (v_tenant, v_new_fatura.id, v_glosa.atendimento_exame_id, v_glosa.item_valor);
    v_total_itens := v_total_itens + 1;

    -- atualiza glosa: marca como reapresentada
    UPDATE public.convenio_glosas
       SET status = 'reapresentada',
           reapresentada_em_fatura_id = v_new_fatura.id,
           reapresentada_em = now(),
           reapresentada_por = auth.uid()
     WHERE id = v_glosa.id;
  END LOOP;

  IF v_total_itens = 0 THEN
    RAISE EXCEPTION 'nenhum item válido para reapresentar';
  END IF;

  fatura_id := v_new_fatura.id;
  -- recarrega o codigo (foi reescrito pelo trigger de geração)
  SELECT cf.codigo INTO codigo FROM public.convenio_faturas cf WHERE cf.id = v_new_fatura.id;
  tentativa := v_tentativa;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.convenio_fatura_reapresentar(bigint, bigint[], text, date, date) TO authenticated;

-- 5. View SSOT — resumo financeiro por fatura
CREATE OR REPLACE VIEW public.convenio_fatura_resumo AS
WITH glosas_agg AS (
  SELECT fatura_id,
    SUM(valor_glosado) FILTER (WHERE status IN ('aberta','reapresentada','aceita_perda')) AS total_glosado,
    SUM(valor_glosado) FILTER (WHERE status = 'reapresentada') AS total_reapresentado,
    SUM(valor_glosado) FILTER (WHERE status = 'aberta') AS total_glosado_aberto
  FROM public.convenio_glosas
  GROUP BY fatura_id
)
SELECT
  f.id AS fatura_id,
  f.tenant_id,
  f.codigo,
  f.convenio_id,
  f.status,
  f.fatura_origem_id,
  f.tentativa,
  f.total AS total_faturado,
  CASE WHEN f.status = 'paga' THEN f.total ELSE 0 END AS total_recebido,
  COALESCE(g.total_glosado, 0) AS total_glosado,
  COALESCE(g.total_reapresentado, 0) AS total_reapresentado,
  COALESCE(g.total_glosado_aberto, 0) AS total_glosado_aberto,
  CASE
    WHEN f.status = 'cancelada' THEN 0
    WHEN f.status = 'paga' THEN 0
    ELSE f.total - COALESCE(g.total_glosado, 0)
  END AS saldo_pendente
FROM public.convenio_faturas f
LEFT JOIN glosas_agg g ON g.fatura_id = f.id;

GRANT SELECT ON public.convenio_fatura_resumo TO authenticated;
GRANT SELECT ON public.convenio_fatura_resumo TO service_role;

COMMENT ON VIEW public.convenio_fatura_resumo IS
  'Convênios 2.0 Fase 3 — SSOT de totais por fatura: faturado, glosado, recebido, reapresentado e saldo pendente.';
