ALTER TABLE public.documento_templates DROP CONSTRAINT documento_templates_tipo_check;
ALTER TABLE public.documento_templates ADD CONSTRAINT documento_templates_tipo_check
  CHECK (tipo = ANY (ARRAY['comprovante_pagamento','comprovante_atendimento','declaracao_comparecimento','cabecalho','rodape','documento']::text[]));