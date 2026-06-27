-- Remove vestígios da integração ElevenLabs (substituída pelo Lovable AI Gateway).
DELETE FROM public.saas_settings WHERE key = 'elevenlabs_config';
