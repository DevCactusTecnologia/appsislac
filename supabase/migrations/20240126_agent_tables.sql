-- supabase/migrations/20240126_agent_tables.sql

-- Tabela de auditoria do agent
CREATE TABLE IF NOT EXISTS agent_audit_log (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  prompt TEXT,
  response TEXT,
  status TEXT DEFAULT 'success',
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_audit_tenant ON agent_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agent_audit_user ON agent_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_audit_created ON agent_audit_log(created_at);

-- RLS
ALTER TABLE agent_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view own audit logs"
  ON agent_audit_log FOR SELECT
  USING (user_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin');

-- Tabela de feature flags
CREATE TABLE IF NOT EXISTS feature_flags (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  enabled BOOLEAN DEFAULT FALSE,
  tenant_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(name, tenant_id)
);

-- Adicionar feature flag do agent (se não existir)
INSERT INTO feature_flags (name, enabled, tenant_id)
SELECT 'ai-agent', FALSE, id FROM laboratorios
ON CONFLICT (name, tenant_id) DO NOTHING;

-- RLS
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Anyone can read feature flags"
  ON feature_flags FOR SELECT
  USING (true);

CREATE POLICY IF NOT EXISTS "Only admins can update feature flags"
  ON feature_flags FOR UPDATE
  USING (auth.jwt() ->> 'role' = 'admin');
