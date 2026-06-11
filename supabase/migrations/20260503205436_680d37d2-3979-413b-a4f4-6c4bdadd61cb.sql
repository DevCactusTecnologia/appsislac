DROP INDEX IF EXISTS public.idx_tabela_preco_tabela_nome;

ALTER TABLE public.tabela_preco_itens
  DROP COLUMN IF EXISTS codigo_exame,
  DROP COLUMN IF EXISTS nome_exame,
  DROP COLUMN IF EXISTS porte;

CREATE INDEX IF NOT EXISTS idx_tabela_preco_tabela_exame
  ON public.tabela_preco_itens(tabela, exame_id);