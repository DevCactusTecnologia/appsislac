-- Auditoria do override manual de PDF
ALTER TABLE public.atendimento_exames
  ADD COLUMN IF NOT EXISTS pdf_override_uploaded_by uuid,
  ADD COLUMN IF NOT EXISTS pdf_override_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS pdf_override_motivo text,
  ADD COLUMN IF NOT EXISTS pdf_override_replaced_path text;

CREATE TABLE IF NOT EXISTS public.pdf_override_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  atendimento_exame_id bigint NOT NULL,
  acao text NOT NULL CHECK (acao IN ('SET','REPLACE','CLEAR')),
  storage_path_novo text,
  storage_path_anterior text,
  provider_pdf_id uuid,
  protocolo_externo text,
  motivo text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pdf_override_audit_tenant
  ON public.pdf_override_audit(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pdf_override_audit_ae
  ON public.pdf_override_audit(atendimento_exame_id);

ALTER TABLE public.pdf_override_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pdf_override_audit_select" ON public.pdf_override_audit;
CREATE POLICY "pdf_override_audit_select"
ON public.pdf_override_audit FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR tenant_id = public.current_tenant_id()
);

DROP POLICY IF EXISTS "pdf_override_audit_insert" ON public.pdf_override_audit;
CREATE POLICY "pdf_override_audit_insert"
ON public.pdf_override_audit FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id = public.current_tenant_id()
);

-- update/delete bloqueados (auditoria imutável)
DROP POLICY IF EXISTS "pdf_override_audit_no_update" ON public.pdf_override_audit;
CREATE POLICY "pdf_override_audit_no_update"
ON public.pdf_override_audit FOR UPDATE
TO authenticated
USING (false);

DROP POLICY IF EXISTS "pdf_override_audit_no_delete" ON public.pdf_override_audit;
CREATE POLICY "pdf_override_audit_no_delete"
ON public.pdf_override_audit FOR DELETE
TO authenticated
USING (public.is_super_admin(auth.uid()));