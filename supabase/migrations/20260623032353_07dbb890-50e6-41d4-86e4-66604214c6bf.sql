-- Fase 2.2: histórico imutável (remover DELETE)
DROP POLICY IF EXISTS estmov_delete ON public.estoque_movimentacoes;

-- Fase 2.4: CHECK constraints (status de lote + tipo de movimentação)
-- Normalizar dados fora do conjunto antes de aplicar (defensivo)
UPDATE public.estoque_lotes
   SET status = 'ativo'
 WHERE status IS NULL OR status NOT IN ('ativo','esgotado','vencido','descartado');

UPDATE public.estoque_movimentacoes
   SET tipo = 'ajuste'
 WHERE tipo IS NULL OR tipo NOT IN ('entrada','saida','ajuste','descarte');

ALTER TABLE public.estoque_lotes
  DROP CONSTRAINT IF EXISTS estoque_lotes_status_check,
  ADD CONSTRAINT estoque_lotes_status_check
    CHECK (status IN ('ativo','esgotado','vencido','descartado'));

ALTER TABLE public.estoque_movimentacoes
  DROP CONSTRAINT IF EXISTS estoque_movimentacoes_tipo_check,
  ADD CONSTRAINT estoque_movimentacoes_tipo_check
    CHECK (tipo IN ('entrada','saida','ajuste','descarte'));

-- Fase 2.7: proteger histórico de lotes contra deleção em cascata de insumo
ALTER TABLE public.estoque_lotes
  DROP CONSTRAINT IF EXISTS estoque_lotes_insumo_id_fkey,
  ADD CONSTRAINT estoque_lotes_insumo_id_fkey
    FOREIGN KEY (insumo_id) REFERENCES public.estoque_insumos(id) ON DELETE RESTRICT;

ALTER TABLE public.estoque_movimentacoes
  DROP CONSTRAINT IF EXISTS estoque_movimentacoes_insumo_id_fkey,
  ADD CONSTRAINT estoque_movimentacoes_insumo_id_fkey
    FOREIGN KEY (insumo_id) REFERENCES public.estoque_insumos(id) ON DELETE RESTRICT;

-- Fase 2.3 preparação: habilitar pg_cron e pg_net (idempotente)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;