
-- 1) Adiciona coluna exame_id (FK -> exames_catalogo)
ALTER TABLE public.tabela_preco_itens
  ADD COLUMN IF NOT EXISTS exame_id uuid REFERENCES public.exames_catalogo(id) ON DELETE CASCADE;

-- 2) Backfill: tenta vincular pelas linhas existentes via nome_exame (case-insensitive) por tenant
UPDATE public.tabela_preco_itens t
SET exame_id = e.id
FROM public.exames_catalogo e
WHERE t.exame_id IS NULL
  AND t.tenant_id = e.tenant_id
  AND lower(trim(t.nome_exame)) = lower(trim(e.nome));

-- 3) Limpa placeholders (valor=0 sem vínculo OU valor=0 da Própria sem uso real)
DELETE FROM public.tabela_preco_itens
WHERE valor = 0 AND tabela = 'Própria';

-- 4) Remove órfãos restantes (linhas que não conseguiram vincular ao catálogo)
DELETE FROM public.tabela_preco_itens
WHERE exame_id IS NULL;

-- 5) Torna exame_id obrigatório a partir de agora
ALTER TABLE public.tabela_preco_itens
  ALTER COLUMN exame_id SET NOT NULL;

-- 6) Torna nome_exame / codigo_exame nullable (legacy / cache desnormalizado)
ALTER TABLE public.tabela_preco_itens ALTER COLUMN nome_exame DROP NOT NULL;
ALTER TABLE public.tabela_preco_itens ALTER COLUMN codigo_exame DROP NOT NULL;

-- 7) Garante unicidade (tenant_id, tabela, exame_id) — impede duplicação
CREATE UNIQUE INDEX IF NOT EXISTS uq_tabela_preco_tenant_tabela_exame
  ON public.tabela_preco_itens (tenant_id, tabela, exame_id);

-- 8) Índice de performance
CREATE INDEX IF NOT EXISTS idx_tabela_preco_exame_tabela
  ON public.tabela_preco_itens (exame_id, tabela);
