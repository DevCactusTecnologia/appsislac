DO $$
DECLARE r INTEGER;
BEGIN
  UPDATE public.atendimento_exames SET valor_original = 10.00 WHERE atendimento_id = 7 AND nome_exame = 'TEMPO DE COAGULACAO';
  GET DIAGNOSTICS r = ROW_COUNT;
  RAISE NOTICE 'updated TEMPO COAG: %', r;
  UPDATE public.atendimento_exames SET valor_original = 12.00 WHERE atendimento_id = 7 AND nome_exame = 'ACIDO URICO';
  GET DIAGNOSTICS r = ROW_COUNT;
  RAISE NOTICE 'updated ACIDO: %', r;
  UPDATE public.atendimento_exames SET valor_original = 10.00 WHERE atendimento_id = 7 AND nome_exame = 'TEMPO DE SANGRAMENTO';
  UPDATE public.atendimento_exames SET valor_original = 50.00 WHERE atendimento_id = 7 AND nome_exame = 'COLESTEROL TOTAL E FRAÇÕES';
  UPDATE public.atendimento_exames SET valor_original = 12.00 WHERE atendimento_id = 7 AND nome_exame = 'GLICEMIA DE JEJUM';
END $$;
SELECT id, atendimento_id, nome_exame, valor, valor_original FROM public.atendimento_exames WHERE atendimento_id=7 ORDER BY ordem;