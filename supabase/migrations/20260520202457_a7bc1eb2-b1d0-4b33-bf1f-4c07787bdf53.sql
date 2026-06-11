-- Altera o default da coluna config para incluir margens 10mm em todos os lados
ALTER TABLE public.exame_layouts ALTER COLUMN config SET DEFAULT '{"margins":{"top":10,"right":10,"bottom":10,"left":10}}'::jsonb;

-- Atualiza registros existentes com config vazio para ter as margens padrão
UPDATE public.exame_layouts SET config = '{"margins":{"top":10,"right":10,"bottom":10,"left":10}}'::jsonb WHERE config = '{}'::jsonb OR config IS NULL;