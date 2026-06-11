-- Recria com security_invoker para respeitar RLS do usuário consultante
ALTER VIEW public.financeiro_entradas SET (security_invoker = on);