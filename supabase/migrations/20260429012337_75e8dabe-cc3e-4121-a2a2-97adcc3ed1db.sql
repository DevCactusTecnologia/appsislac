-- Tabela de tentativas falhas de signup (auditoria)
CREATE TABLE IF NOT EXISTS public.signup_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_lab text,
  cnpj text,
  whatsapp text,
  admin_nome text,
  admin_email text,
  motivo text NOT NULL,
  field_errors jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signup_attempts_created_at
  ON public.signup_attempts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signup_attempts_email
  ON public.signup_attempts (admin_email);
CREATE INDEX IF NOT EXISTS idx_signup_attempts_cnpj
  ON public.signup_attempts (cnpj);

ALTER TABLE public.signup_attempts ENABLE ROW LEVEL SECURITY;

-- Inserção pública (a edge function usa service role, mas mantemos política aberta de INSERT
-- para o caso de o INSERT ser executado por chamadas anônimas em situações de contorno).
DROP POLICY IF EXISTS "anyone_insert_signup_attempts" ON public.signup_attempts;
CREATE POLICY "anyone_insert_signup_attempts"
  ON public.signup_attempts
  FOR INSERT
  WITH CHECK (true);

-- Apenas super_admin lê
DROP POLICY IF EXISTS "super_admin_select_signup_attempts" ON public.signup_attempts;
CREATE POLICY "super_admin_select_signup_attempts"
  ON public.signup_attempts
  FOR SELECT
  USING (public.is_super_admin(auth.uid()));

-- Apenas super_admin deleta
DROP POLICY IF EXISTS "super_admin_delete_signup_attempts" ON public.signup_attempts;
CREATE POLICY "super_admin_delete_signup_attempts"
  ON public.signup_attempts
  FOR DELETE
  USING (public.is_super_admin(auth.uid()));