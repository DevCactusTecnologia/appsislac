-- Permite apenas a troca inicial de um código automático LAB### para o código
-- operacional oficial informado no provisionamento. Depois disso, segue imutável.

CREATE OR REPLACE FUNCTION public.tenant_registry_lab_code_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.lab_code IS NULL OR btrim(NEW.lab_code) = '' THEN
      NEW.lab_code := public.generate_next_lab_code();
    ELSE
      NEW.lab_code := upper(regexp_replace(NEW.lab_code, '[^A-Za-z0-9]', '', 'g'));
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.lab_code IS NOT NULL THEN
      NEW.lab_code := upper(regexp_replace(NEW.lab_code, '[^A-Za-z0-9]', '', 'g'));
    END IF;

    IF NEW.lab_code IS DISTINCT FROM OLD.lab_code THEN
      IF OLD.lab_code ~ '^LAB[0-9]+$' THEN
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'lab_code é imutável após a criação do laboratório';
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;