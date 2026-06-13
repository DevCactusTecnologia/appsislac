-- C.3: drop legacy dictionary tables (data already mirrored to select_options in C.1)

-- 1) Drop forwarding triggers (function fwd_legacy_dict_to_select_options is kept for recoletas_motivos)
DROP TRIGGER IF EXISTS trg_fwd_motivos_cancelamento ON public.motivos_cancelamento;
DROP TRIGGER IF EXISTS trg_fwd_financeiro_formas_pagamento ON public.financeiro_formas_pagamento;
DROP TRIGGER IF EXISTS trg_fwd_financeiro_tipos_despesa ON public.financeiro_tipos_despesa;
DROP TRIGGER IF EXISTS trg_fwd_financeiro_destinos_pagamento ON public.financeiro_destinos_pagamento;

-- 2) Drop legacy tables (verified: zero foreign keys point to these)
DROP TABLE IF EXISTS public.motivos_cancelamento;
DROP TABLE IF EXISTS public.financeiro_formas_pagamento;
DROP TABLE IF EXISTS public.financeiro_tipos_despesa;
DROP TABLE IF EXISTS public.financeiro_destinos_pagamento;