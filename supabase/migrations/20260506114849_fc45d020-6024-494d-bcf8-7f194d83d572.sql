ALTER VIEW public.tenant_public SET (security_invoker = off);
GRANT SELECT ON public.tenant_public TO anon, authenticated;