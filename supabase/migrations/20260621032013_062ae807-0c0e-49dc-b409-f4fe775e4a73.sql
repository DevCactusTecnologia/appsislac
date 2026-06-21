
-- 1) Estado de pagamento (necessário para o estorno funcionar de fato).
ALTER TABLE public.atendimento_pagamentos
  ADD COLUMN IF NOT EXISTS status_pagamento text NOT NULL DEFAULT 'efetuado';

-- 2) View de Entradas passa a esconder pagamentos estornados.
CREATE OR REPLACE VIEW public.financeiro_entradas AS
  SELECT ap.id AS pagamento_id,
         a.id AS atendimento_id,
         NULL::bigint AS fatura_id,
         'pagamento'::text AS origem,
         a.protocolo,
         ap.data,
         a.paciente_nome AS cliente,
         a.convenio_nome AS convenio,
         ap.tipo AS payment,
         ap.valor AS valor_total,
         ap.observacao,
         a.unidade_id,
         a.status_pagamento,
         a.tenant_id
    FROM atendimento_pagamentos ap
    JOIN atendimentos a ON a.id = ap.atendimento_id
   WHERE COALESCE(ap.status_pagamento,'efetuado') <> 'estornado'
  UNION ALL
  SELECT NULL::bigint AS pagamento_id,
         NULL::bigint AS atendimento_id,
         cf.id AS fatura_id,
         'fatura_convenio'::text AS origem,
         cf.codigo AS protocolo,
         COALESCE(cf.data_pagamento::timestamp with time zone, cf.updated_at) AS data,
         c.nome AS cliente,
         c.nome AS convenio,
         COALESCE(NULLIF(cf.forma_pagamento, ''::text), 'Faturado'::text) AS payment,
         cf.total AS valor_total,
         cf.observacao,
         NULL::text AS unidade_id,
         'Pagamento efetuado'::text AS status_pagamento,
         cf.tenant_id
    FROM convenio_faturas cf
    JOIN convenios c ON c.id = cf.convenio_id AND c.tenant_id = cf.tenant_id
   WHERE cf.status = 'paga'::text;

-- 3) Cleanup pontual: estornar o pagamento duplicado (id=10) do ATD-2026-0000002.
DO $$
DECLARE
  v_pag RECORD;
BEGIN
  SELECT ap.id, ap.tenant_id, ap.valor, ap.status_pagamento
    INTO v_pag
    FROM public.atendimento_pagamentos ap
    JOIN public.atendimentos a ON a.id = ap.atendimento_id
   WHERE a.protocolo = 'ATD-2026-0000002'
     AND ap.id = 10
   LIMIT 1;

  IF v_pag.id IS NULL THEN
    RAISE NOTICE 'Pagamento id=10 não encontrado — nada a estornar.';
    RETURN;
  END IF;

  IF v_pag.status_pagamento = 'estornado' THEN
    RAISE NOTICE 'Pagamento id=10 já estava estornado.';
    RETURN;
  END IF;

  UPDATE public.atendimento_pagamentos
     SET status_pagamento = 'estornado',
         updated_at = now()
   WHERE id = v_pag.id;

  INSERT INTO public.financeiro_estornos
    (tenant_id, origem_tipo, origem_id, motivo, valor, criado_por)
  VALUES
    (v_pag.tenant_id, 'pagamento', v_pag.id,
     'Lançamento duplicado — ATD-2026-0000002 ficou com 2x R$ 35,00 (id 9 e id 10) durante validação do fluxo aditivo. Mantida a entrada original (id 9).',
     v_pag.valor, NULL);
END$$;
