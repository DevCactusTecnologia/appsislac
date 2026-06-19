-- Fase 2 — Normalização de despesas (forma_pagamento)
-- DOWN: ALTER TABLE public.financeiro_saidas DROP COLUMN forma_pagamento;
--       (a descrição "limpa" não é restaurada automaticamente; o backfill é one-shot)

ALTER TABLE public.financeiro_saidas
  ADD COLUMN IF NOT EXISTS forma_pagamento text NULL;

COMMENT ON COLUMN public.financeiro_saidas.forma_pagamento IS
  'Forma de pagamento da despesa (PIX, Dinheiro, Débito, Crédito, Transferência, Boleto, …). '
  'Substitui o antigo sufixo [pgto:X] que era armazenado em descricao. Fase 2 — Financeiro V2.';

-- Backfill: extrai [pgto:X] da descricao para a coluna nova e remove o sufixo.
-- Faz isso APENAS em registros que ainda têm o marcador, para ser idempotente.
UPDATE public.financeiro_saidas
SET
  forma_pagamento = COALESCE(
    forma_pagamento,
    NULLIF(trim(substring(descricao FROM '\[pgto:([^\]]+)\]')), '')
  ),
  descricao = regexp_replace(descricao, '\s*\[pgto:[^\]]+\]\s*$', '', 'i')
WHERE descricao ~ '\[pgto:[^\]]+\]';

-- Index leve para filtro/agrupamento por forma de pagamento por tenant.
CREATE INDEX IF NOT EXISTS idx_financeiro_saidas_tenant_forma
  ON public.financeiro_saidas (tenant_id, forma_pagamento)
  WHERE forma_pagamento IS NOT NULL;