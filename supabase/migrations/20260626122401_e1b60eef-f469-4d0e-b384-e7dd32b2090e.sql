
-- ============================================================
-- SISLAC Intelligence Platform — Phase 2.1 Schema
-- ============================================================

-- 1) ai_threads
CREATE TABLE public.ai_threads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  title TEXT,
  module TEXT,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_threads_tenant_user ON public.ai_threads(tenant_id, user_id, last_message_at DESC) WHERE deleted_at IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_threads TO authenticated;
GRANT ALL ON public.ai_threads TO service_role;
ALTER TABLE public.ai_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_threads_select" ON public.ai_threads FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "ai_threads_insert" ON public.ai_threads FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() AND user_id = auth.uid());
CREATE POLICY "ai_threads_update" ON public.ai_threads FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND user_id = auth.uid())
  WITH CHECK (tenant_id = public.current_tenant_id() AND user_id = auth.uid());
CREATE POLICY "ai_threads_delete" ON public.ai_threads FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND user_id = auth.uid());

CREATE TRIGGER update_ai_threads_updated_at BEFORE UPDATE ON public.ai_threads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) ai_messages
CREATE TABLE public.ai_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  thread_id UUID NOT NULL REFERENCES public.ai_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','tool','system')),
  parts JSONB NOT NULL DEFAULT '[]'::jsonb,
  tokens_in INTEGER,
  tokens_out INTEGER,
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_messages_thread ON public.ai_messages(thread_id, created_at);
CREATE INDEX idx_ai_messages_tenant ON public.ai_messages(tenant_id, created_at DESC);
GRANT SELECT, INSERT, DELETE ON public.ai_messages TO authenticated;
GRANT ALL ON public.ai_messages TO service_role;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_messages_select" ON public.ai_messages FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "ai_messages_insert" ON public.ai_messages FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "ai_messages_delete" ON public.ai_messages FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND user_id = auth.uid());

-- 3) ai_audit
CREATE TABLE public.ai_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  thread_id UUID,
  skill TEXT NOT NULL,
  capability TEXT,
  action TEXT,
  status TEXT NOT NULL CHECK (status IN ('ok','error','forbidden','cancelled','needs_approval')),
  duration_ms INTEGER,
  needs_approval BOOLEAN NOT NULL DEFAULT false,
  approved BOOLEAN,
  origin TEXT,
  error_code TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_audit_tenant ON public.ai_audit(tenant_id, created_at DESC);
CREATE INDEX idx_ai_audit_skill ON public.ai_audit(tenant_id, skill, created_at DESC);
GRANT SELECT, INSERT ON public.ai_audit TO authenticated;
GRANT ALL ON public.ai_audit TO service_role;
ALTER TABLE public.ai_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_audit_select" ON public.ai_audit FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "ai_audit_insert" ON public.ai_audit FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

-- 4) ai_user_preferences
CREATE TABLE public.ai_user_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_user_preferences TO authenticated;
GRANT ALL ON public.ai_user_preferences TO service_role;
ALTER TABLE public.ai_user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_user_prefs_select" ON public.ai_user_preferences FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND user_id = auth.uid());
CREATE POLICY "ai_user_prefs_insert" ON public.ai_user_preferences FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() AND user_id = auth.uid());
CREATE POLICY "ai_user_prefs_update" ON public.ai_user_preferences FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND user_id = auth.uid())
  WITH CHECK (tenant_id = public.current_tenant_id() AND user_id = auth.uid());
CREATE POLICY "ai_user_prefs_delete" ON public.ai_user_preferences FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND user_id = auth.uid());

CREATE TRIGGER update_ai_user_prefs_updated_at BEFORE UPDATE ON public.ai_user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) ai_metrics_daily
CREATE TABLE public.ai_metrics_daily (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  user_id UUID,
  day DATE NOT NULL,
  skill TEXT,
  capability TEXT,
  time_saved_seconds INTEGER NOT NULL DEFAULT 0,
  clicks_saved INTEGER NOT NULL DEFAULT 0,
  actions_executed INTEGER NOT NULL DEFAULT 0,
  actions_success INTEGER NOT NULL DEFAULT 0,
  actions_failed INTEGER NOT NULL DEFAULT 0,
  confirmations_requested INTEGER NOT NULL DEFAULT 0,
  confirmations_approved INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id, day, skill, capability)
);
CREATE INDEX idx_ai_metrics_tenant_day ON public.ai_metrics_daily(tenant_id, day DESC);
GRANT SELECT, INSERT, UPDATE ON public.ai_metrics_daily TO authenticated;
GRANT ALL ON public.ai_metrics_daily TO service_role;
ALTER TABLE public.ai_metrics_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_metrics_select" ON public.ai_metrics_daily FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "ai_metrics_insert" ON public.ai_metrics_daily FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "ai_metrics_update" ON public.ai_metrics_daily FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE TRIGGER update_ai_metrics_updated_at BEFORE UPDATE ON public.ai_metrics_daily
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
