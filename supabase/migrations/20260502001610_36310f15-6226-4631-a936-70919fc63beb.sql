-- Fase 1 / Bloco 1 — Índices compostos para escala multi-tenant.
-- Usa IF NOT EXISTS para idempotência. NÃO usa CONCURRENTLY porque
-- migrations Supabase rodam em transação (CONCURRENTLY exigiria fora
-- de transação); as tabelas alvo são pequenas o suficiente para
-- criação imediata sem impacto operacional perceptível.
-- Tabelas já bem cobertas (atendimentos, atendimento_exames) foram
-- auditadas e não receberam novos índices para evitar duplicação.

-- pacientes: lista ordenada por criação dentro do tenant
CREATE INDEX IF NOT EXISTS idx_pacientes_tenant_created
  ON public.pacientes (tenant_id, created_at DESC);

-- convenio_faturas: faturamento por período dentro do tenant
CREATE INDEX IF NOT EXISTS idx_convenio_faturas_tenant_created
  ON public.convenio_faturas (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_convenio_faturas_tenant_periodo
  ON public.convenio_faturas (tenant_id, periodo_inicio DESC, periodo_fim DESC);

-- financeiro_saidas: relatórios financeiros por período
CREATE INDEX IF NOT EXISTS idx_financeiro_saidas_tenant_created
  ON public.financeiro_saidas (tenant_id, created_at DESC);

-- atendimento_pagamentos: alimenta a VIEW financeiro_entradas;
-- relatórios filtram por tenant + data de pagamento
CREATE INDEX IF NOT EXISTS idx_atendimento_pagamentos_tenant_data
  ON public.atendimento_pagamentos (tenant_id, data DESC);

-- ANALYZE para o planner aproveitar imediatamente as novas estatísticas
ANALYZE public.pacientes;
ANALYZE public.convenio_faturas;
ANALYZE public.financeiro_saidas;
ANALYZE public.atendimento_pagamentos;