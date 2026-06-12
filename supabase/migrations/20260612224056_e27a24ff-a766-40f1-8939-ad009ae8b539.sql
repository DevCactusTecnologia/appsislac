-- Cleanup: remove duplicate forwarding triggers on legacy dictionary tables.
-- Each table has two triggers doing the exact same forward-to-select_options work
-- (one with old name `*_fwd_so`, another with new name `trg_fwd_*`).
-- Dropping the older `*_fwd_so` keeps a single forwarding trigger per table.

DROP TRIGGER IF EXISTS financeiro_destinos_pagamento_fwd_so ON public.financeiro_destinos_pagamento;
DROP TRIGGER IF EXISTS financeiro_formas_pagamento_fwd_so   ON public.financeiro_formas_pagamento;
DROP TRIGGER IF EXISTS financeiro_tipos_despesa_fwd_so      ON public.financeiro_tipos_despesa;
DROP TRIGGER IF EXISTS motivos_cancelamento_fwd_so          ON public.motivos_cancelamento;
DROP TRIGGER IF EXISTS recoletas_motivos_fwd_so             ON public.recoletas_motivos;