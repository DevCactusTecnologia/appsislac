-- Fase 6 (Financeiro V2) — Status de despesas com 3 estados.
ALTER TABLE public.financeiro_saidas
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'aberta';

-- Backfill (idempotente): paga onde foi_pago=true, aberta caso contrário.
UPDATE public.financeiro_saidas
SET status = CASE WHEN foi_pago THEN 'paga' ELSE 'aberta' END
WHERE status NOT IN ('aberta', 'paga', 'cancelada')
   OR (foi_pago = true  AND status <> 'paga')
   OR (foi_pago = false AND status NOT IN ('aberta', 'cancelada'));

-- Restrição de domínio (idempotente).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'financeiro_saidas_status_chk'
      AND conrelid = 'public.financeiro_saidas'::regclass
  ) THEN
    ALTER TABLE public.financeiro_saidas
      ADD CONSTRAINT financeiro_saidas_status_chk
      CHECK (status IN ('aberta', 'paga', 'cancelada'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_financeiro_saidas_tenant_status
  ON public.financeiro_saidas (tenant_id, status);

COMMENT ON COLUMN public.financeiro_saidas.status IS
  'Fase 6 V2: aberta | paga | cancelada. `foi_pago` mantido como espelho legado.';