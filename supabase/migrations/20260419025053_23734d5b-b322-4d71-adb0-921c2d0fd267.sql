-- Recria a view financeiro_entradas para unir:
--   1) Pagamentos avulsos do paciente (atendimento_pagamentos)
--   2) Faturas de convênio efetivamente pagas (convenio_faturas com status='paga')
DROP VIEW IF EXISTS public.financeiro_entradas;

CREATE VIEW public.financeiro_entradas AS
-- Pagamentos avulsos (paciente)
SELECT
  ap.id::bigint                    AS pagamento_id,
  a.id::bigint                     AS atendimento_id,
  NULL::bigint                     AS fatura_id,
  'pagamento'::text                AS origem,
  a.protocolo                      AS protocolo,
  ap.data                          AS data,
  a.paciente_nome                  AS cliente,
  a.convenio_nome                  AS convenio,
  ap.tipo                          AS payment,
  ap.valor                         AS valor_total,
  ap.observacao                    AS observacao,
  a.unidade_id                     AS unidade_id,
  a.status_pagamento               AS status_pagamento,
  a.tenant_id                      AS tenant_id
FROM public.atendimento_pagamentos ap
JOIN public.atendimentos a ON a.id = ap.atendimento_id

UNION ALL

-- Faturas de convênio pagas (entrada agregada)
SELECT
  NULL::bigint                                 AS pagamento_id,
  NULL::bigint                                 AS atendimento_id,
  cf.id::bigint                                AS fatura_id,
  'fatura_convenio'::text                      AS origem,
  cf.codigo                                    AS protocolo,
  COALESCE(cf.data_pagamento::timestamptz, cf.updated_at) AS data,
  c.nome                                       AS cliente,
  c.nome                                       AS convenio,
  COALESCE(NULLIF(cf.forma_pagamento, ''), 'Faturado') AS payment,
  cf.total                                     AS valor_total,
  cf.observacao                                AS observacao,
  NULL::text                                   AS unidade_id,
  'Pagamento efetuado'::text                   AS status_pagamento,
  cf.tenant_id                                 AS tenant_id
FROM public.convenio_faturas cf
JOIN public.convenios c
  ON c.id = cf.convenio_id AND c.tenant_id = cf.tenant_id
WHERE cf.status = 'paga';

-- Permissões: as policies das tabelas-base controlam o acesso.
GRANT SELECT ON public.financeiro_entradas TO authenticated;

-- Índice para acelerar drill-down (itens por fatura)
CREATE INDEX IF NOT EXISTS idx_convenio_fatura_itens_fatura
  ON public.convenio_fatura_itens(fatura_id);
CREATE INDEX IF NOT EXISTS idx_convenio_fatura_itens_atex
  ON public.convenio_fatura_itens(atendimento_exame_id);