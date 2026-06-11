
-- Backfill: exames que voltaram de 'finalizado' para um estado editável
-- antes da migração de retificação devem receber a flag retroativamente.
WITH cand AS (
  SELECT DISTINCT (registro_id)::bigint AS exame_id, MIN(created_at) AS retify_at
  FROM public.audit_logs
  WHERE tabela = 'atendimento_exames'
    AND acao = 'UPDATE'
    AND antes->>'status' = 'finalizado'
    AND depois->>'status' IN ('em_analise','em_bancada','analisado','pendente')
  GROUP BY registro_id
)
UPDATE public.atendimento_exames ae
SET retificado = true,
    retificado_at = COALESCE(ae.retificado_at, c.retify_at)
FROM cand c
WHERE ae.id = c.exame_id
  AND ae.retificado = false
  AND ae.status <> 'cancelado';

-- Recalcula status_atendimento dos atendimentos impactados.
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT DISTINCT ae.atendimento_id
    FROM public.atendimento_exames ae
    WHERE ae.retificado = true
  LOOP
    PERFORM public.recompute_atendimento_status(rec.atendimento_id);
  END LOOP;
END $$;
