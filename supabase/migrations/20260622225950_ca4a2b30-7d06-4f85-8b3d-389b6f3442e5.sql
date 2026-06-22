
-- ============================================================
-- FASE 7 — EXPURGO PROGRAMADO
-- ============================================================

CREATE TYPE public.expurgo_lote_status AS ENUM (
  'PROGRAMADO','EM_EXECUCAO','CONCLUIDO','CANCELADO'
);

CREATE TYPE public.expurgo_item_status AS ENUM (
  'PENDENTE','EXECUTADO','PULADO'
);

-- ------------------------------------------------------------
-- LOTES
-- ------------------------------------------------------------
CREATE TABLE public.expurgo_lotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  titulo text NOT NULL,
  descricao text,
  data_programada date NOT NULL,
  status public.expurgo_lote_status NOT NULL DEFAULT 'PROGRAMADO',

  -- critério (snapshot, apenas informativo)
  criterio_material_ids uuid[] DEFAULT '{}',
  criterio_coleta_ate date,
  criterio_validade_ate date,
  criterio_observacao text,

  total_itens integer NOT NULL DEFAULT 0,
  total_executados integer NOT NULL DEFAULT 0,
  total_pulados integer NOT NULL DEFAULT 0,

  criado_por_user_id uuid,
  criado_por_nome text,
  concluido_em timestamptz,
  cancelado_em timestamptz,
  motivo_cancelamento text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expurgo_lotes TO authenticated;
GRANT ALL ON public.expurgo_lotes TO service_role;

ALTER TABLE public.expurgo_lotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expurgo_lotes_select"
  ON public.expurgo_lotes FOR SELECT TO authenticated
  USING ((tenant_id = current_tenant_id()) OR is_super_admin());

CREATE POLICY "expurgo_lotes_insert"
  ON public.expurgo_lotes FOR INSERT TO authenticated
  WITH CHECK (
    ((tenant_id = current_tenant_id()) AND has_permission(auth.uid(), 'armazenar_amostra'))
    OR is_super_admin()
  );

CREATE POLICY "expurgo_lotes_update"
  ON public.expurgo_lotes FOR UPDATE TO authenticated
  USING ((tenant_id = current_tenant_id()) OR is_super_admin())
  WITH CHECK (
    ((tenant_id = current_tenant_id()) AND has_permission(auth.uid(), 'armazenar_amostra'))
    OR is_super_admin()
  );

CREATE POLICY "expurgo_lotes_delete"
  ON public.expurgo_lotes FOR DELETE TO authenticated
  USING (is_super_admin());

CREATE INDEX idx_expurgo_lotes_tenant ON public.expurgo_lotes(tenant_id, data_programada DESC);
CREATE INDEX idx_expurgo_lotes_status ON public.expurgo_lotes(tenant_id, status);

CREATE TRIGGER trg_expurgo_lotes_updated
  BEFORE UPDATE ON public.expurgo_lotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------
-- ITENS
-- ------------------------------------------------------------
CREATE TABLE public.expurgo_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  lote_id uuid NOT NULL REFERENCES public.expurgo_lotes(id) ON DELETE CASCADE,
  amostra_id uuid NOT NULL REFERENCES public.amostras(id) ON DELETE CASCADE,
  status public.expurgo_item_status NOT NULL DEFAULT 'PENDENTE',

  -- snapshot leve da amostra no momento do agendamento
  snapshot_codigo_barra text,
  snapshot_material text,
  snapshot_localizacao text,
  snapshot_data_coleta timestamptz,
  snapshot_data_validade timestamptz,

  executado_em timestamptz,
  executado_por_user_id uuid,
  executado_por_nome text,
  motivo_pulo text,
  observacao text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- uma amostra só pode estar em UM lote ativo (não-concluído/não-cancelado)
CREATE UNIQUE INDEX uniq_expurgo_amostra_ativa
  ON public.expurgo_itens(amostra_id)
  WHERE status = 'PENDENTE';

CREATE INDEX idx_expurgo_itens_lote ON public.expurgo_itens(lote_id, status);
CREATE INDEX idx_expurgo_itens_tenant ON public.expurgo_itens(tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expurgo_itens TO authenticated;
GRANT ALL ON public.expurgo_itens TO service_role;

ALTER TABLE public.expurgo_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expurgo_itens_select"
  ON public.expurgo_itens FOR SELECT TO authenticated
  USING ((tenant_id = current_tenant_id()) OR is_super_admin());

CREATE POLICY "expurgo_itens_insert"
  ON public.expurgo_itens FOR INSERT TO authenticated
  WITH CHECK (
    ((tenant_id = current_tenant_id()) AND has_permission(auth.uid(), 'armazenar_amostra'))
    OR is_super_admin()
  );

CREATE POLICY "expurgo_itens_update"
  ON public.expurgo_itens FOR UPDATE TO authenticated
  USING ((tenant_id = current_tenant_id()) OR is_super_admin())
  WITH CHECK (
    ((tenant_id = current_tenant_id()) AND has_permission(auth.uid(), 'armazenar_amostra'))
    OR is_super_admin()
  );

CREATE POLICY "expurgo_itens_delete"
  ON public.expurgo_itens FOR DELETE TO authenticated
  USING (is_super_admin());

CREATE TRIGGER trg_expurgo_itens_updated
  BEFORE UPDATE ON public.expurgo_itens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------
-- TRIGGER: ao concluir item EXECUTADO, marca amostra DESCARTADA
-- e libera a alocação física vigente.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.aplicar_expurgo_amostra()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'EXECUTADO' AND (OLD.status IS DISTINCT FROM 'EXECUTADO') THEN
    UPDATE public.amostras
      SET status = 'DESCARTADA',
          localizacao = ''
      WHERE id = NEW.amostra_id;

    UPDATE public.amostra_alocacoes
      SET ativa = false,
          retirado_em = COALESCE(retirado_em, now()),
          motivo_retirada = COALESCE(motivo_retirada, 'EXPURGO')
      WHERE amostra_id = NEW.amostra_id AND ativa = true;

    -- atualiza totais do lote
    UPDATE public.expurgo_lotes
      SET total_executados = total_executados + 1
      WHERE id = NEW.lote_id;
  END IF;

  IF NEW.status = 'PULADO' AND (OLD.status IS DISTINCT FROM 'PULADO') THEN
    UPDATE public.expurgo_lotes
      SET total_pulados = total_pulados + 1
      WHERE id = NEW.lote_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_expurgo_aplicar
  AFTER UPDATE ON public.expurgo_itens
  FOR EACH ROW EXECUTE FUNCTION public.aplicar_expurgo_amostra();
