CREATE OR REPLACE FUNCTION public._calc_dv_amostra(_digitos text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
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