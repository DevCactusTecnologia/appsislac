UPDATE public.atendimento_exames SET valor_original = 10.00 WHERE atendimento_id = 7 AND nome_exame = 'TEMPO DE COAGULACAO';
UPDATE public.atendimento_exames SET valor_original = 12.00 WHERE atendimento_id = 7 AND nome_exame = 'ACIDO URICO';
UPDATE public.atendimento_exames SET valor_original = 10.00 WHERE atendimento_id = 7 AND nome_exame = 'TEMPO DE SANGRAMENTO';
UPDATE public.atendimento_exames SET valor_original = 50.00 WHERE atendimento_id = 7 AND nome_exame = 'COLESTEROL TOTAL E FRAÇÕES';
UPDATE public.atendimento_exames SET valor_original = 12.00 WHERE atendimento_id = 7 AND nome_exame = 'GLICEMIA DE JEJUM';
SELECT nome_exame, valor, valor_original FROM public.atendimento_exames WHERE atendimento_id=7 ORDER BY ordem;