-- Phase: discount-history
-- Adiciona coluna `valor_original` em atendimento_exames para preservar o
-- valor "cheio" (preço de catálogo no momento da finalização do
-- atendimento), separadamente de `valor` (efetivo, já com desconto
-- distribuído). Permite reconstruir o desconto histórico como linha
-- destacada no modal de pagamento e detalhes — sem alterar a regra de
-- distribuição do desconto entre exames.
--
-- Backfill: registros existentes recebem valor_original = valor
-- (assume "sem desconto" — comportamento conservador para histórico).

ALTER TABLE public.atendimento_exames
  ADD COLUMN IF NOT EXISTS valor_original numeric(12,2);

UPDATE public.atendimento_exames
   SET valor_original = valor
 WHERE valor_original IS NULL;

-- Não tornamos NOT NULL para não quebrar inserts antigos; o app passa a
-- preencher sempre. Trigger garante coerência mínima:
-- valor_original deve ser >= valor (desconto nunca aumenta o preço).
CREATE OR REPLACE FUNCTION public.atendimento_exames_valor_original_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.valor_original IS NULL THEN
    NEW.valor_original := NEW.valor;
  END IF;
  IF NEW.valor_original < NEW.valor THEN
    -- Auto-corrige (em vez de bloquear) — defensivo contra arredondamento.
    NEW.valor_original := NEW.valor;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_atendimento_exames_valor_original_guard
  ON public.atendimento_exames;
CREATE TRIGGER trg_atendimento_exames_valor_original_guard
  BEFORE INSERT OR UPDATE ON public.atendimento_exames
  FOR EACH ROW
  EXECUTE FUNCTION public.atendimento_exames_valor_original_guard();

COMMENT ON COLUMN public.atendimento_exames.valor_original IS
  'Preço "cheio" no momento da finalização (antes do desconto distribuído). Permite reconstruir o desconto histórico (sum(valor_original - valor)).';