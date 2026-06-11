-- Public bucket to host shareable PDFs (receipts and budgets)
INSERT INTO storage.buckets (id, name, public)
VALUES ('comprovantes', 'comprovantes', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone can read (public bucket; required so the WhatsApp link works)
CREATE POLICY "Public read access for comprovantes"
ON storage.objects
FOR SELECT
USING (bucket_id = 'comprovantes');

-- Anyone (anon + authenticated) can upload — system has no Supabase auth yet
CREATE POLICY "Anyone can upload comprovantes"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'comprovantes');