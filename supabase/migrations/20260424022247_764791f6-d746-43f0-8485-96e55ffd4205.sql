CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ATENDIMENTOS
CREATE INDEX IF NOT EXISTS idx_atendimentos_tenant_status_data
  ON public.atendimentos (tenant_id, status_atendimento, data DESC);

CREATE INDEX IF NOT EXISTS idx_atendimentos_tenant_created
  ON public.atendimentos (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_atendimentos_tenant_cpf
  ON public.atendimentos (tenant_id, paciente_cpf);

CREATE INDEX IF NOT EXISTS idx_atendimentos_tenant_paciente
  ON public.atendimentos (tenant_id, paciente_id);

-- PACIENTES — trigram puro em nome (Postgres restringe gin com tenant_id uuid)
CREATE INDEX IF NOT EXISTS idx_pacientes_nome_trgm
  ON public.pacientes USING gin (lower(nome) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_pacientes_tenant_nome
  ON public.pacientes (tenant_id, lower(nome));

CREATE INDEX IF NOT EXISTS idx_pacientes_tenant_cpf
  ON public.pacientes (tenant_id, cpf);

-- ATENDIMENTO_EXAMES
CREATE INDEX IF NOT EXISTS idx_atendimento_exames_tenant_status
  ON public.atendimento_exames (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_atendimento_exames_atendimento_status
  ON public.atendimento_exames (atendimento_id, status);

CREATE INDEX IF NOT EXISTS idx_atendimento_exames_tenant_data_liberacao
  ON public.atendimento_exames (tenant_id, data_liberacao DESC NULLS LAST);

-- AMOSTRAS
CREATE INDEX IF NOT EXISTS idx_amostras_tenant_status_validade
  ON public.amostras (tenant_id, status, data_validade);

CREATE INDEX IF NOT EXISTS idx_amostras_tenant_codigo
  ON public.amostras (tenant_id, codigo_barra);

-- PAGAMENTOS
CREATE INDEX IF NOT EXISTS idx_atendimento_pagamentos_atendimento
  ON public.atendimento_pagamentos (atendimento_id);

-- AUDITORIA
CREATE INDEX IF NOT EXISTS idx_atendimento_audit_tenant_changed
  ON public.atendimento_audit (tenant_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_atendimento_audit_atendimento
  ON public.atendimento_audit (atendimento_id, changed_at DESC);

-- Atualiza estatísticas
ANALYZE public.atendimentos;
ANALYZE public.atendimento_exames;
ANALYZE public.atendimento_pagamentos;
ANALYZE public.pacientes;
ANALYZE public.amostras;