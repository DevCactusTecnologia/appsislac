-- Restaura valor_original dos exames do ATD-2026-0000004 (atendimento_id=7)
-- para o preço cheio da tabela "Particular", deixando o `valor` (com acréscimo
-- distribuído) intacto. Isso recupera o subtotal R$94 + acréscimo R$6 = R$100
-- exibido no modal de Pagamento.

UPDATE public.atendimento_exames SET valor_original = 10.00 WHERE atendimento_id = 7 AND nome_exame = 'TEMPO DE COAGULACAO';
UPDATE public.atendimento_exames SET valor_original = 12.00 WHERE atendimento_id = 7 AND nome_exame = 'ACIDO URICO';
UPDATE public.atendimento_exames SET valor_original = 10.00 WHERE atendimento_id = 7 AND nome_exame = 'TEMPO DE SANGRAMENTO';
UPDATE public.atendimento_exames SET valor_original = 50.00 WHERE atendimento_id = 7 AND nome_exame = 'COLESTEROL TOTAL E FRAÇÕES';
UPDATE public.atendimento_exames SET valor_original = 12.00 WHERE atendimento_id = 7 AND nome_exame = 'GLICEMIA DE JEJUM';