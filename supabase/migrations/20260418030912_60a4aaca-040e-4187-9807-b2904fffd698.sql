-- Remove configuração e validador específico de retenção de PDFs
DELETE FROM public.app_settings WHERE key = 'pdf_retention_days';
DELETE FROM public.app_settings_audit WHERE key = 'pdf_retention_days';

DROP TRIGGER IF EXISTS validate_app_setting_trigger ON public.app_settings;
DROP FUNCTION IF EXISTS public.validate_app_setting();