CREATE TYPE public.payment_provider AS ENUM ('mercado_pago', 'infinitepay');
CREATE TYPE public.gateway_environment AS ENUM ('sandbox', 'producao');

CREATE TABLE public.tenant_payment_gateways (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenant_registry(tenant_id) ON DELETE CASCADE,
    provider public.payment_provider NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT false,
    is_default BOOLEAN NOT NULL DEFAULT false,
    environment public.gateway_environment NOT NULL DEFAULT 'sandbox',
    access_token TEXT,
    public_key TEXT,
    webhook_secret TEXT,
    handle TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, provider)
);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_payment_gateways TO authenticated;
GRANT ALL ON public.tenant_payment_gateways TO service_role;

-- Enable RLS
ALTER TABLE public.tenant_payment_gateways ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage their tenant payment gateways" 
ON public.tenant_payment_gateways 
FOR ALL 
TO authenticated 
USING (
    tenant_id = (SELECT public.current_tenant_id())
    OR 
    public.is_super_admin()
)
WITH CHECK (
    tenant_id = (SELECT public.current_tenant_id())
    OR 
    public.is_super_admin()
);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column() 
RETURNS TRIGGER AS $$ 
BEGIN 
    NEW.updated_at = now(); 
    RETURN NEW; 
END; 
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_tenant_payment_gateways_updated_at ON public.tenant_payment_gateways;
CREATE TRIGGER update_tenant_payment_gateways_updated_at 
BEFORE UPDATE ON public.tenant_payment_gateways 
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to ensure only one default per tenant
CREATE OR REPLACE FUNCTION public.handle_default_payment_gateway() 
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_default THEN
        UPDATE public.tenant_payment_gateways 
        SET is_default = false 
        WHERE tenant_id = NEW.tenant_id AND id <> NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_handle_default_payment_gateway ON public.tenant_payment_gateways;
CREATE TRIGGER trigger_handle_default_payment_gateway
BEFORE INSERT OR UPDATE OF is_default ON public.tenant_payment_gateways
FOR EACH ROW WHEN (NEW.is_default = true)
EXECUTE FUNCTION public.handle_default_payment_gateway();