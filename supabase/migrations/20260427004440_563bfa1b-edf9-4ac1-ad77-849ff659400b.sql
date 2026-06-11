-- Backup dos códigos regulatórios preenchidos por IA antes da limpeza
CREATE TABLE IF NOT EXISTS public.exames_catalogo_codigos_backup_ia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  exame_id uuid NOT NULL,
  nome text NOT NULL,
  mnemonico text NOT NULL DEFAULT '',
  codigo_cbhpm text NOT NULL DEFAULT '',
  codigo_tuss text NOT NULL DEFAULT '',
  codigo_loinc text NOT NULL DEFAULT '',
  codigo_sus text NOT NULL DEFAULT '',
  porte_cbhpm text NOT NULL DEFAULT '-',
  backup_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.exames_catalogo_codigos_backup_ia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "backup_codigos_select"
  ON public.exames_catalogo_codigos_backup_ia
  FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (
      tenant_id = public.current_tenant_id()
      AND public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  );

-- Sem políticas INSERT/UPDATE/DELETE → apenas migrações podem gravar (registro histórico imutável)

CREATE INDEX IF NOT EXISTS idx_backup_codigos_tenant
  ON public.exames_catalogo_codigos_backup_ia (tenant_id);
CREATE INDEX IF NOT EXISTS idx_backup_codigos_exame
  ON public.exames_catalogo_codigos_backup_ia (exame_id);

-- Popular o backup com os dados atuais (apenas exames que tenham algum código preenchido)
INSERT INTO public.exames_catalogo_codigos_backup_ia
  (tenant_id, exame_id, nome, mnemonico, codigo_cbhpm, codigo_tuss, codigo_loinc, codigo_sus, porte_cbhpm)
SELECT
  tenant_id, id, nome, mnemonico, codigo_cbhpm, codigo_tuss, codigo_loinc, codigo_sus, porte_cbhpm
FROM public.exames_catalogo
WHERE codigo_cbhpm <> ''
   OR codigo_tuss <> ''
   OR codigo_loinc <> ''
   OR codigo_sus <> ''
   OR (porte_cbhpm <> '' AND porte_cbhpm <> '-');