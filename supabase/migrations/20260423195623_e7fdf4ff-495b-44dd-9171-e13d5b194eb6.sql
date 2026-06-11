-- Tabela de sequência diária por tenant para códigos de amostra
CREATE TABLE IF NOT EXISTS public.amostra_sequence (
  tenant_id uuid NOT NULL,
  dia date NOT NULL,
  ultimo_numero integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, dia)
);

ALTER TABLE public.amostra_sequence ENABLE ROW LEVEL SECURITY;

-- Apenas leitura para autenticados do tenant; escrita feita exclusivamente pela função SECURITY DEFINER
CREATE POLICY "amostra_sequence_select" ON public.amostra_sequence
  FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()) OR tenant_id = current_tenant_id());

-- Função: calcula dígito verificador (Luhn-like simplificado mod 10) sobre os dígitos
CREATE OR REPLACE FUNCTION public._calc_dv_amostra(_digitos text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  soma int := 0;
  i int;
  d int;
  peso int;
BEGIN
  FOR i IN 1..length(_digitos) LOOP
    d := substring(_digitos FROM i FOR 1)::int;
    peso := CASE WHEN (i % 2) = 1 THEN 3 ELSE 1 END;
    soma := soma + (d * peso);
  END LOOP;
  RETURN ((10 - (soma % 10)) % 10)::text;
END;
$$;

-- Função RPC: gera próximo código de amostra sequencial por dia + DV
-- Formato: A-YYYYMMDD-NNNNNN-D
CREATE OR REPLACE FUNCTION public.gerar_codigo_amostra(_tenant_id uuid, _data date DEFAULT CURRENT_DATE)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _proximo int;
  _ymd text;
  _seq text;
  _base text;
  _dv text;
BEGIN
  -- upsert atômico: incrementa contador do dia
  INSERT INTO public.amostra_sequence (tenant_id, dia, ultimo_numero)
  VALUES (_tenant_id, _data, 1)
  ON CONFLICT (tenant_id, dia)
  DO UPDATE SET
    ultimo_numero = amostra_sequence.ultimo_numero + 1,
    updated_at = now()
  RETURNING ultimo_numero INTO _proximo;

  _ymd := to_char(_data, 'YYYYMMDD');
  _seq := lpad(_proximo::text, 6, '0');
  _base := _ymd || _seq;
  _dv := public._calc_dv_amostra(_base);

  RETURN 'A-' || _ymd || '-' || _seq || '-' || _dv;
END;
$$;

-- Permissão de execução para usuários autenticados
GRANT EXECUTE ON FUNCTION public.gerar_codigo_amostra(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public._calc_dv_amostra(text) TO authenticated;