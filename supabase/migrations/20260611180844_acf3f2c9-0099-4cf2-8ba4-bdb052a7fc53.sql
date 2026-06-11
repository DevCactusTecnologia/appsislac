
-- P0 #2: OTP attempts counter
ALTER TABLE public.inscricoes
  ADD COLUMN IF NOT EXISTS tentativas_codigo integer NOT NULL DEFAULT 0;

-- P0 #4: WhatsApp idempotency
ALTER TABLE public.whatsapp_mensagens
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_mensagens_idem_uq
  ON public.whatsapp_mensagens (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- P0 #3: Rate limit table (service_role only)
CREATE TABLE IF NOT EXISTS public.public_rate_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scope text NOT NULL,            -- ex: 'comprovante-resolve'
  key text NOT NULL,              -- ex: ip:1.2.3.4 | codigo:ABC123 | cpf:000...
  window_start timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 1,
  blocked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.public_rate_limits TO service_role;

ALTER TABLE public.public_rate_limits ENABLE ROW LEVEL SECURITY;

-- Apenas service_role lê/escreve. Nenhuma policy para authenticated/anon = acesso negado.
CREATE POLICY "rate_limits_service_only_select" ON public.public_rate_limits
  FOR SELECT TO service_role USING (true);
CREATE POLICY "rate_limits_service_only_modify" ON public.public_rate_limits
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE UNIQUE INDEX IF NOT EXISTS public_rate_limits_scope_key_uq
  ON public.public_rate_limits (scope, key);

CREATE INDEX IF NOT EXISTS public_rate_limits_window_idx
  ON public.public_rate_limits (window_start);
