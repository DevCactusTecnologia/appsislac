-- LGPD: consentimento na tabela de pacientes
ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS consentimento_lgpd BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consentimento_em TIMESTAMPTZ;

COMMENT ON COLUMN public.pacientes.consentimento_lgpd IS
  'Indica se o paciente (ou responsável legal) aceitou a Política de Privacidade no cadastro.';
COMMENT ON COLUMN public.pacientes.consentimento_em IS
  'Timestamp do aceite da Política de Privacidade (LGPD).';

-- Backup: log de restores
CREATE TABLE IF NOT EXISTS public.backup_restores_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  executado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  executado_por TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sucesso','falha','parcial','simulado')),
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.backup_restores_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_select_backup_restores_log" ON public.backup_restores_log;
CREATE POLICY "super_admin_select_backup_restores_log"
  ON public.backup_restores_log FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "super_admin_insert_backup_restores_log" ON public.backup_restores_log;
CREATE POLICY "super_admin_insert_backup_restores_log"
  ON public.backup_restores_log FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Performance: índices em tenant_id (financeiro_entradas é VIEW, pulado)
CREATE INDEX IF NOT EXISTS idx_identidade_confirmacoes_tenant
  ON public.identidade_confirmacoes(tenant_id);

CREATE INDEX IF NOT EXISTS idx_orientacoes_entregues_tenant
  ON public.orientacoes_entregues(tenant_id);

CREATE INDEX IF NOT EXISTS idx_app_settings_audit_tenant
  ON public.app_settings_audit(tenant_id);