-- Drop the guard trigger that forces valor_original >= valor.
-- Acréscimo is a legitimate case where valor > valor_original (preço cheio).
-- The application is now the SSOT for `valor_original` (preço cheio antes de
-- desconto/acréscimo distribuído).
DROP TRIGGER IF EXISTS trg_atendimento_exames_valor_original_guard ON public.atendimento_exames;
DROP FUNCTION IF EXISTS public.atendimento_exames_valor_original_guard();

-- Restore valor_original to full table prices for ATD-2026-0000004.
UPDATE public.atendimento_exames SET valor_original = 10.00 WHERE atendimento_id = 7 AND nome_exame = 'TEMPO DE COAGULACAO';
UPDATE public.atendimento_exames SET valor_original = 12.00 WHERE atendimento_id = 7 AND nome_exame = 'ACIDO URICO';
UPDATE public.atendimento_exames SET valor_original = 10.00 WHERE atendimento_id = 7 AND nome_exame = 'TEMPO DE SANGRAMENTO';
UPDATE public.atendimento_exames SET valor_original = 50.00 WHERE atendimento_id = 7 AND nome_exame = 'COLESTEROL TOTAL E FRAÇÕES';
UPDATE public.atendimento_exames SET valor_original = 12.00 WHERE atendimento_id = 7 AND nome_exame = 'GLICEMIA DE JEJUM';