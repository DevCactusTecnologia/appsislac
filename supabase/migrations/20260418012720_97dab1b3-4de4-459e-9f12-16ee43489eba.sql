-- Habilita realtime para tabelas que afetam a view financeiro_entradas,
-- permitindo que a aba Entradas e relatórios financeiros reajam a
-- cancelamentos de atendimentos e edições de pagamentos.
ALTER TABLE public.atendimentos REPLICA IDENTITY FULL;
ALTER TABLE public.atendimento_pagamentos REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.atendimentos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.atendimento_pagamentos;