-- 1. Novas colunas na solicitações públicas
ALTER TABLE public.solicitacoes_publicas
  ADD COLUMN IF NOT EXISTS tipo_atendimento text NOT NULL DEFAULT 'laboratorio',
  ADD COLUMN IF NOT EXISTS unidade_id text;

ALTER TABLE public.solicitacoes_publicas
  DROP CONSTRAINT IF EXISTS solicitacoes_publicas_tipo_atend_chk;
ALTER TABLE public.solicitacoes_publicas
  ADD CONSTRAINT solicitacoes_publicas_tipo_atend_chk
  CHECK (tipo_atendimento IN ('laboratorio', 'domiciliar'));

-- 2. View pública de unidades ativas
CREATE OR REPLACE VIEW public.unidades_publicas
WITH (security_invoker = off) AS
SELECT
  id,
  tenant_id,
  nome,
  tipo,
  endereco,
  cidade,
  estado,
  telefone
FROM public.unidades
WHERE ativo = true;

GRANT SELECT ON public.unidades_publicas TO anon, authenticated;

-- 3. Função pública para autopreencher por CPF
CREATE OR REPLACE FUNCTION public.lookup_paciente_publico(
  p_tenant_id uuid,
  p_cpf text
)
RETURNS TABLE (
  nome text,
  telefone text,
  celular text,
  email text,
  data_nascimento date,
  sexo text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.nome, p.telefone, p.celular, p.email, p.data_nascimento, p.sexo
  FROM public.pacientes p
  WHERE p.tenant_id = p_tenant_id
    AND regexp_replace(coalesce(p.cpf, ''), '\D', '', 'g')
        = regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g')
    AND length(regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g')) = 11
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_paciente_publico(uuid, text) TO anon, authenticated;