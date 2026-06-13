-- Migração C.2: Remoção de tabelas órfãs
-- Tabelas: tuss_catalogo (vazia, substituída por exames_catalogo.tuss)
--         signup_rate_limit (vazia, substituída por public_rate_limits)
-- Impacto: ZERO funcional — nenhum código lê/escreve nelas.
-- Ganho:   −2 tabelas, −3 policies.

-- 1. Remover políticas RLS
DROP POLICY IF EXISTS "tuss_catalogo_select_public" ON public.tuss_catalogo;
DROP POLICY IF EXISTS "tuss_catalogo_select_authenticated" ON public.tuss_catalogo;
DROP POLICY IF EXISTS "signup_rate_limit_select" ON public.signup_rate_limit;

-- 2. Remover tabelas
DROP TABLE IF EXISTS public.tuss_catalogo;
DROP TABLE IF EXISTS public.signup_rate_limit;