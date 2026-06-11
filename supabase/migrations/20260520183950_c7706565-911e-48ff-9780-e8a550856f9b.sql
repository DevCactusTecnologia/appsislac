ALTER TABLE public.tenant_lab_config
  DROP COLUMN IF EXISTS print_margin_top,
  DROP COLUMN IF EXISTS print_margin_right,
  DROP COLUMN IF EXISTS print_margin_bottom,
  DROP COLUMN IF EXISTS print_margin_left;