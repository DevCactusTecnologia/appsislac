-- ============================================================================
-- Onda 1 — Esqueleto semântico do fluxo Web → Solicitação → Pagamento → Atendimento
-- ============================================================================

-- Origem do atendimento
ALTER TABLE public.atendimentos
  ADD COLUMN IF NOT EXISTS origem_atendimento text NOT NULL DEFAULT 'INTERNO';

ALTER TABLE public.atendimentos
  DROP CONSTRAINT IF EXISTS atendimentos_origem_chk;
ALTER TABLE public.atendimentos
  ADD CONSTRAINT atendimentos_origem_chk
  CHECK (origem_atendimento IN ('INTERNO','WEB_AUTO','WEB_APROVADO','AGENDAMENTO'));

CREATE INDEX IF NOT EXISTS idx_atendimentos_origem
  ON public.atendimentos(tenant_id, origem_atendimento);

-- Pagamento na solicitação pública
ALTER TABLE public.solicitacoes_publicas
  ADD COLUMN IF NOT EXISTS payment_provider text,
  ADD COLUMN IF NOT EXISTS payment_intent_id text,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS payment_paid_at timestamptz;

ALTER TABLE public.solicitacoes_publicas
  DROP CONSTRAINT IF EXISTS solicitacoes_payment_status_chk;
ALTER TABLE public.solicitacoes_publicas
  ADD CONSTRAINT solicitacoes_payment_status_chk
  CHECK (payment_status IN ('NONE','PENDING','PAID','EXPIRED','FAILED','REFUNDED'));

-- Idempotência: um intent_id é único por tenant (impede duplo atendimento)
CREATE UNIQUE INDEX IF NOT EXISTS uq_solicitacoes_payment_intent
  ON public.solicitacoes_publicas(tenant_id, payment_intent_id)
  WHERE payment_intent_id IS NOT NULL;

-- ============================================================================
-- Onda 2 — Vitrine inteligente: modo de publicação + toggles globais
-- ============================================================================

-- Modo de publicação por exame da vitrine
ALTER TABLE public.exames_publicos
  ADD COLUMN IF NOT EXISTS modo_publicacao text NOT NULL DEFAULT 'INFORMAR';

ALTER TABLE public.exames_publicos
  DROP CONSTRAINT IF EXISTS exames_publicos_modo_chk;
ALTER TABLE public.exames_publicos
  ADD CONSTRAINT exames_publicos_modo_chk
  CHECK (modo_publicacao IN ('COMPRAR','AGENDAR','INFORMAR'));

-- Atualiza a view pública (mantém security_invoker=off por enquanto — risco aceito)
DROP VIEW IF EXISTS public.exames_publicos_view;
CREATE VIEW public.exames_publicos_view AS
  SELECT
    ep.id           AS publico_id,
    ep.tenant_id,
    ep.exame_id,
    ep.destaque,
    ep.ordem,
    ep.modo_publicacao,
    ec.nome,
    ec.categoria,
    ec.material,
    ec.preparo_paciente AS preparo,
    ec.requer_jejum,
    COALESCE(tpi.valor, 0::numeric) AS valor
  FROM exames_publicos ep
  JOIN exames_catalogo ec
    ON ec.id = ep.exame_id
   AND ec.tenant_id = ep.tenant_id
   AND ec.ativo = true
  LEFT JOIN tabela_preco_itens tpi
    ON tpi.exame_id = ep.exame_id
   AND tpi.tenant_id = ep.tenant_id
   AND tpi.tabela = 'Própria'
   AND tpi.ativo = true
  WHERE ep.ativo = true;

-- Toggles centrais por tenant (na própria tabela tenant_settings_public)
ALTER TABLE public.tenant_settings_public
  ADD COLUMN IF NOT EXISTS permitir_compra_online   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS permitir_agendamento     boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS exigir_aprovacao_manual  boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_criar_atendimento   boolean NOT NULL DEFAULT false;

-- ============================================================================
-- IA-first governance (header documental)
-- ============================================================================
COMMENT ON COLUMN public.atendimentos.origem_atendimento IS
'Origin of the attendance. INTERNO=desk operator. WEB_AUTO=auto-converted from paid web request. WEB_APROVADO=approved by reception. AGENDAMENTO=scheduled appointment. Source of truth for badges in /atendimentos and /solicitacoes-site.';

COMMENT ON COLUMN public.solicitacoes_publicas.payment_intent_id IS
'External payment provider intent/preference id. Unique per tenant — guarantees idempotent webhook processing (no duplicate attendance from replay).';

COMMENT ON COLUMN public.exames_publicos.modo_publicacao IS
'How this exam shows on the public site. COMPRAR=adds to cart and triggers checkout. AGENDAR=requests scheduling without payment. INFORMAR=catalog only, no action.';