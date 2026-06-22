
CREATE TYPE public.notification_mode AS ENUM ('automatic', 'manual');

CREATE TABLE public.tenant_notification_settings (
  tenant_id uuid PRIMARY KEY,
  resultado_pronto_mode public.notification_mode NOT NULL DEFAULT 'automatic',
  recoleta_mode        public.notification_mode NOT NULL DEFAULT 'manual',
  orcamento_mode       public.notification_mode NOT NULL DEFAULT 'manual',
  atendimento_mode     public.notification_mode NOT NULL DEFAULT 'automatic',
  agendamento_mode     public.notification_mode NOT NULL DEFAULT 'automatic',
  consulta_mode        public.notification_mode NOT NULL DEFAULT 'automatic',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.tenant_notification_settings TO authenticated;
GRANT ALL ON public.tenant_notification_settings TO service_role;

ALTER TABLE public.tenant_notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_notification_settings_select_own"
  ON public.tenant_notification_settings FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin());

CREATE POLICY "tenant_notification_settings_insert_own"
  ON public.tenant_notification_settings FOR INSERT TO authenticated
  WITH CHECK (
    (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(), 'configurar_lab'))
    OR public.is_super_admin()
  );

CREATE POLICY "tenant_notification_settings_update_own"
  ON public.tenant_notification_settings FOR UPDATE TO authenticated
  USING (
    (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(), 'configurar_lab'))
    OR public.is_super_admin()
  )
  WITH CHECK (
    (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(), 'configurar_lab'))
    OR public.is_super_admin()
  );

CREATE TRIGGER trg_tenant_notification_settings_updated_at
  BEFORE UPDATE ON public.tenant_notification_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
