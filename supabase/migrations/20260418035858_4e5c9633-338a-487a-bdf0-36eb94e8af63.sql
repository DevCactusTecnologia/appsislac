-- =====================================================
-- 1) Catálogo: tipo_processo + lab_apoio_id + integracao_ativa
-- =====================================================
ALTER TABLE public.exames_catalogo
  ADD COLUMN IF NOT EXISTS tipo_processo text NOT NULL DEFAULT 'INTERNO'
    CHECK (tipo_processo IN ('INTERNO','TERCEIRIZADO')),
  ADD COLUMN IF NOT EXISTS lab_apoio_id uuid REFERENCES public.labs_apoio(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS integracao_ativa boolean NOT NULL DEFAULT false;

-- Backfill: campo "analise" hoje guarda o id do lab_apoio quando terceirizado.
-- Detecta UUIDs válidos que batem com labs_apoio do mesmo tenant.
UPDATE public.exames_catalogo e
SET tipo_processo = 'TERCEIRIZADO',
    lab_apoio_id = l.id
FROM public.labs_apoio l
WHERE l.tenant_id = e.tenant_id
  AND e.analise ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND e.analise::uuid = l.id;

CREATE INDEX IF NOT EXISTS idx_exames_catalogo_tipo_processo
  ON public.exames_catalogo (tenant_id, tipo_processo);

-- =====================================================
-- 2) atendimento_exames: snapshot + status externo
-- =====================================================
ALTER TABLE public.atendimento_exames
  ADD COLUMN IF NOT EXISTS tipo_processo text NOT NULL DEFAULT 'INTERNO'
    CHECK (tipo_processo IN ('INTERNO','TERCEIRIZADO')),
  ADD COLUMN IF NOT EXISTS lab_apoio_id uuid REFERENCES public.labs_apoio(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS integracao_ativa boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status_externo text NOT NULL DEFAULT 'NAO_APLICAVEL'
    CHECK (status_externo IN (
      'NAO_APLICAVEL',
      'AGUARDANDO_ENVIO',
      'ENVIADO',
      'EM_ANALISE_LAB',
      'RESULTADO_RECEBIDO',
      'IMPORTADO',
      'FINALIZADO',
      'ERRO_INTEGRACAO'
    )),
  ADD COLUMN IF NOT EXISTS protocolo_externo text,
  ADD COLUMN IF NOT EXISTS data_envio timestamptz,
  ADD COLUMN IF NOT EXISTS data_retorno timestamptz,
  ADD COLUMN IF NOT EXISTS resultado_importado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS arquivo_resultado_path text;

-- Backfill snapshot dos atendimentos existentes (a partir do catálogo atual)
UPDATE public.atendimento_exames ae
SET tipo_processo = ec.tipo_processo,
    lab_apoio_id  = ec.lab_apoio_id,
    integracao_ativa = ec.integracao_ativa,
    status_externo = CASE
      WHEN ec.tipo_processo = 'TERCEIRIZADO' AND ae.status = 'finalizado' THEN 'FINALIZADO'
      WHEN ec.tipo_processo = 'TERCEIRIZADO' THEN 'AGUARDANDO_ENVIO'
      ELSE 'NAO_APLICAVEL'
    END
FROM public.exames_catalogo ec
WHERE ae.exame_id = ec.id;

CREATE INDEX IF NOT EXISTS idx_atendimento_exames_tipo_processo
  ON public.atendimento_exames (tenant_id, tipo_processo, status_externo);

-- =====================================================
-- 3) Trigger para snapshot automático em INSERT
-- =====================================================
CREATE OR REPLACE FUNCTION public.snapshot_exame_terceirizado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tipo text;
  v_lab uuid;
  v_int boolean;
BEGIN
  IF NEW.exame_id IS NULL THEN RETURN NEW; END IF;

  -- Só preenche se ainda não foi setado explicitamente
  IF NEW.tipo_processo IS NULL OR NEW.tipo_processo = 'INTERNO' THEN
    SELECT tipo_processo, lab_apoio_id, integracao_ativa
      INTO v_tipo, v_lab, v_int
      FROM public.exames_catalogo
      WHERE id = NEW.exame_id;

    IF v_tipo IS NOT NULL THEN
      NEW.tipo_processo := v_tipo;
      NEW.lab_apoio_id := v_lab;
      NEW.integracao_ativa := COALESCE(v_int, false);
      NEW.status_externo := CASE
        WHEN v_tipo = 'TERCEIRIZADO' THEN 'AGUARDANDO_ENVIO'
        ELSE 'NAO_APLICAVEL'
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_snapshot_exame_terceirizado ON public.atendimento_exames;
CREATE TRIGGER trg_snapshot_exame_terceirizado
  BEFORE INSERT ON public.atendimento_exames
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_exame_terceirizado();

-- =====================================================
-- 4) Storage: bucket privado resultados-externos
-- =====================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('resultados-externos', 'resultados-externos', false)
ON CONFLICT (id) DO NOTHING;

-- Path convention: {tenant_id}/{atendimento_exame_id}/{filename}
-- RLS: usuário só acessa arquivos do seu tenant
DROP POLICY IF EXISTS "resultados_externos_select" ON storage.objects;
CREATE POLICY "resultados_externos_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'resultados-externos'
  AND (storage.foldername(name))[1] = current_tenant_id()::text
);

DROP POLICY IF EXISTS "resultados_externos_insert" ON storage.objects;
CREATE POLICY "resultados_externos_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'resultados-externos'
  AND (storage.foldername(name))[1] = current_tenant_id()::text
  AND (
    has_permission(auth.uid(), 'liberar_resultado')
    OR has_permission(auth.uid(), 'analisar_amostra')
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

DROP POLICY IF EXISTS "resultados_externos_update" ON storage.objects;
CREATE POLICY "resultados_externos_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'resultados-externos'
  AND (storage.foldername(name))[1] = current_tenant_id()::text
);

DROP POLICY IF EXISTS "resultados_externos_delete" ON storage.objects;
CREATE POLICY "resultados_externos_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'resultados-externos'
  AND (storage.foldername(name))[1] = current_tenant_id()::text
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- =====================================================
-- 5) Recompute: terceirizados não bloqueiam liberação geral
--     (status já considera apenas 'cancelado' / 'finalizado' / etc.
--      e a UI passa a marcar terceirizado como 'finalizado' quando importado)
-- =====================================================