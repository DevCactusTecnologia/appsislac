-- Rename existing 'codigo' to 'lab_code' if it exists
DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'codigo') THEN
    ALTER TABLE public.tenants RENAME COLUMN codigo TO lab_code;
  END IF;
END $$;

-- Ensure lab_code column exists if it didn't (just in case)
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS lab_code TEXT;

-- Create sequence for lab_code starting at 1001
CREATE SEQUENCE IF NOT EXISTS tenants_lab_code_seq START 1001;

-- Update existing tenants that don't have a lab_code
UPDATE public.tenants SET lab_code = nextval('tenants_lab_code_seq')::text WHERE lab_code IS NULL;

-- Make lab_code NOT NULL and UNIQUE
ALTER TABLE public.tenants ALTER COLUMN lab_code SET NOT NULL;
ALTER TABLE public.tenants ADD CONSTRAINT tenants_lab_code_unique UNIQUE (lab_code);

-- Ensure slug is URL safe (lowercase, no spaces)
-- The existing column already exists and has a unique constraint based on \d output
-- but let's enforce lowercase on insert/update via trigger or constraint
ALTER TABLE public.tenants ADD CONSTRAINT tenants_slug_lowercase_chk CHECK (slug = lower(slug));

-- Function to handle lab_code auto-generation and immutability
CREATE OR REPLACE FUNCTION public.handle_tenant_identifiers()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-generate lab_code if not provided
  IF NEW.lab_code IS NULL THEN
    NEW.lab_code := nextval('tenants_lab_code_seq')::text;
  END IF;

  -- Auto-generate slug if not provided (from name)
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := lower(regexp_replace(NEW.nome, '[^a-zA-Z0-9]+', '-', 'g'));
    -- Trim trailing hyphens
    NEW.slug := regexp_replace(NEW.slug, '-+$', '');
    -- Trim leading hyphens
    NEW.slug := regexp_replace(NEW.slug, '^-+', '');
  END IF;

  -- Ensure slug is lowercase
  NEW.slug := lower(NEW.slug);

  -- Prevent lab_code updates (immutable requirement)
  IF TG_OP = 'UPDATE' THEN
    IF OLD.lab_code IS DISTINCT FROM NEW.lab_code THEN
      RAISE EXCEPTION 'O campo lab_code é imutável após a criação.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for identification logic
DROP TRIGGER IF EXISTS tr_tenant_identifiers ON public.tenants;
CREATE TRIGGER tr_tenant_identifiers
BEFORE INSERT OR UPDATE ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.handle_tenant_identifiers();

-- Grant access to authenticated users to read tenants (needed for resolution)
GRANT SELECT ON public.tenants TO authenticated;
GRANT SELECT ON public.tenants TO anon;
GRANT ALL ON public.tenants TO service_role;
