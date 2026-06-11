
DROP POLICY IF EXISTS anyone_insert_signup_attempts ON public.signup_attempts;

CREATE POLICY anon_insert_signup_attempts
ON public.signup_attempts
FOR INSERT
TO anon
WITH CHECK (
  motivo IS NOT NULL
  AND length(btrim(motivo)) > 0
  AND (
    coalesce(btrim(nome_lab), '')   <> ''
    OR coalesce(btrim(cnpj), '')     <> ''
    OR coalesce(btrim(whatsapp), '') <> ''
    OR coalesce(btrim(admin_email),'') <> ''
    OR coalesce(btrim(admin_nome), '') <> ''
  )
);
