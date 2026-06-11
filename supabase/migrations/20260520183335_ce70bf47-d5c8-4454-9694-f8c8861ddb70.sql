ALTER TABLE public.tenant_lab_config
  ADD COLUMN IF NOT EXISTS print_margin_top numeric NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS print_margin_right numeric NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS print_margin_bottom numeric NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS print_margin_left numeric NOT NULL DEFAULT 10;