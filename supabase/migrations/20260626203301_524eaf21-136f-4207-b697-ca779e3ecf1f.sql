INSERT INTO public.saas_settings (key, value)
VALUES ('elevenlabs_config', jsonb_build_object('voiceId','7iqXtOF3wl3pomwXFY7G','modelId','eleven_multilingual_v2','apiKey',''))
ON CONFLICT (key) DO UPDATE
SET value = public.saas_settings.value
         || jsonb_build_object(
              'voiceId', COALESCE(public.saas_settings.value->>'voiceId','7iqXtOF3wl3pomwXFY7G'),
              'modelId', COALESCE(public.saas_settings.value->>'modelId','eleven_multilingual_v2')
            );