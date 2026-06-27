-- AI-SISLAC 2.0 Core Consolidation: remove tabelas órfãs do Assistente
-- ai_threads, ai_messages, ai_user_preferences, ai_metrics_daily (zero consumidores, zero linhas)
-- Mantém ai_audit (única exigida pela Etapa 9 — auditoria de execução de Tools)

DROP TABLE IF EXISTS public.ai_messages CASCADE;
DROP TABLE IF EXISTS public.ai_threads CASCADE;
DROP TABLE IF EXISTS public.ai_user_preferences CASCADE;
DROP TABLE IF EXISTS public.ai_metrics_daily CASCADE;