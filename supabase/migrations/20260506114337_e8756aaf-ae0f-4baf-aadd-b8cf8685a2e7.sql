ALTER VIEW public.exames_publicos_view SET (security_invoker = off);
GRANT SELECT ON public.exames_publicos_view TO anon, authenticated;