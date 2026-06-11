-- Modos suportados por tenant para envio de WhatsApp
DO $$ BEGIN
  CREATE TYPE public.whatsapp_modo AS ENUM ('simples', 'cloud_api', 'zapi');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.tenant_whatsapp_config
  ADD COLUMN IF NOT EXISTS modo public.whatsapp_modo NOT NULL DEFAULT 'simples',
  ADD COLUMN IF NOT EXISTS numero_simples text,
  ADD COLUMN IF NOT EXISTS zapi_instance_id text,
  ADD COLUMN IF NOT EXISTS zapi_token text,
  ADD COLUMN IF NOT EXISTS zapi_client_token text;

COMMENT ON COLUMN public.tenant_whatsapp_config.modo IS
  'Modo de envio do WhatsApp escolhido pelo laboratório: simples (wa.me), cloud_api (Meta) ou zapi (Z-API).';
COMMENT ON COLUMN public.tenant_whatsapp_config.numero_simples IS
  'Telefone WhatsApp do laboratório usado no modo Simples (apenas display/fallback).';
COMMENT ON COLUMN public.tenant_whatsapp_config.zapi_instance_id IS 'ID da instância Z-API.';
COMMENT ON COLUMN public.tenant_whatsapp_config.zapi_token IS 'Token da instância Z-API.';
COMMENT ON COLUMN public.tenant_whatsapp_config.zapi_client_token IS 'Client-Token de segurança da Z-API (header Client-Token).';
