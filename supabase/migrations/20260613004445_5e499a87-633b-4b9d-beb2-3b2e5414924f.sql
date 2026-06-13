
-- Harden select_options with per-category permission checks before
-- refactoring legacy stores to write here. Without this, any authenticated
-- user in the tenant could mutate restricted dictionary categories.

DROP POLICY IF EXISTS select_options_insert_tenant ON public.select_options;
DROP POLICY IF EXISTS select_options_update_tenant ON public.select_options;
DROP POLICY IF EXISTS select_options_delete_tenant ON public.select_options;

-- Helper expression rationale (inlined per policy):
--   * motivo_cancelamento / recoleta_motivo  → super_admin only
--     (covered by existing select_options_super_admin_all; deny here)
--   * financeiro_*                            → has_permission('gestao_financeira')
--   * other categories (e.g. canais_comunicacao) → keep tenant CRUD

CREATE POLICY select_options_insert_tenant
ON public.select_options
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id IS NOT NULL
  AND tenant_id = current_tenant_id()
  AND CASE categoria
    WHEN 'motivo_cancelamento'           THEN false
    WHEN 'recoleta_motivo'               THEN false
    WHEN 'financeiro_destino_pagamento'  THEN has_permission(auth.uid(), 'gestao_financeira')
    WHEN 'financeiro_forma_pagamento'    THEN has_permission(auth.uid(), 'gestao_financeira')
    WHEN 'financeiro_tipo_despesa'       THEN has_permission(auth.uid(), 'gestao_financeira')
    ELSE true
  END
);

CREATE POLICY select_options_update_tenant
ON public.select_options
FOR UPDATE
TO authenticated
USING (
  tenant_id IS NOT NULL
  AND tenant_id = current_tenant_id()
  AND CASE categoria
    WHEN 'motivo_cancelamento'           THEN false
    WHEN 'recoleta_motivo'               THEN false
    WHEN 'financeiro_destino_pagamento'  THEN has_permission(auth.uid(), 'gestao_financeira')
    WHEN 'financeiro_forma_pagamento'    THEN has_permission(auth.uid(), 'gestao_financeira')
    WHEN 'financeiro_tipo_despesa'       THEN has_permission(auth.uid(), 'gestao_financeira')
    ELSE true
  END
)
WITH CHECK (
  tenant_id IS NOT NULL
  AND tenant_id = current_tenant_id()
  AND CASE categoria
    WHEN 'motivo_cancelamento'           THEN false
    WHEN 'recoleta_motivo'               THEN false
    WHEN 'financeiro_destino_pagamento'  THEN has_permission(auth.uid(), 'gestao_financeira')
    WHEN 'financeiro_forma_pagamento'    THEN has_permission(auth.uid(), 'gestao_financeira')
    WHEN 'financeiro_tipo_despesa'       THEN has_permission(auth.uid(), 'gestao_financeira')
    ELSE true
  END
);

CREATE POLICY select_options_delete_tenant
ON public.select_options
FOR DELETE
TO authenticated
USING (
  tenant_id IS NOT NULL
  AND tenant_id = current_tenant_id()
  AND CASE categoria
    WHEN 'motivo_cancelamento'           THEN false
    WHEN 'recoleta_motivo'               THEN false
    WHEN 'financeiro_destino_pagamento'  THEN has_permission(auth.uid(), 'gestao_financeira')
    WHEN 'financeiro_forma_pagamento'    THEN has_permission(auth.uid(), 'gestao_financeira')
    WHEN 'financeiro_tipo_despesa'       THEN has_permission(auth.uid(), 'gestao_financeira')
    ELSE true
  END
);
