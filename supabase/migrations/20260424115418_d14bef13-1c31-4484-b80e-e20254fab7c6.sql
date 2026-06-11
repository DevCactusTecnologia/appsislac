-- Preparação para multi-database (database-per-tenant) — fase 1: schema apenas.
-- NENHUM código existente lê ainda essas colunas. Default 'shared' garante
-- backward compatibility total.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS database_strategy text NOT NULL DEFAULT 'shared',
  ADD COLUMN IF NOT EXISTS database_url text NULL;

-- Restringe valores possíveis de database_strategy (sem CHECK time-based,
-- então é seguro como CHECK constraint imutável).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenants_database_strategy_check'
  ) THEN
    ALTER TABLE public.tenants
      ADD CONSTRAINT tenants_database_strategy_check
      CHECK (database_strategy IN ('shared', 'dedicated'));
  END IF;
END $$;

-- Comentários para documentação no banco
COMMENT ON COLUMN public.tenants.database_strategy IS
  'Estratégia de banco do tenant: shared (banco compartilhado, padrão) ou dedicated (banco próprio, futuro).';
COMMENT ON COLUMN public.tenants.database_url IS
  'URL de conexão para banco dedicado. NULL quando database_strategy=shared. Não lido pelo runtime atual.';