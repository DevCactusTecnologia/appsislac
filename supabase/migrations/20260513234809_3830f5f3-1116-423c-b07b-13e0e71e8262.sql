-- Onda B: RBAC contextual operacional
-- Princípio: quem tem permissão operacional sobre atendimentos/exames
-- também precisa enxergar essas linhas para conseguir operar.
-- Mantém isolamento por tenant + bypass de super_admin. Sem USING(true).

DROP POLICY IF EXISTS atend_select ON public.atendimentos;
CREATE POLICY atend_select ON public.atendimentos
FOR SELECT
USING (
  public.is_super_admin(auth.uid())
  OR (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission(auth.uid(), 'visualizar_atendimentos')
      OR public.has_permission(auth.uid(), 'registrar_coleta')
      OR public.has_permission(auth.uid(), 'analisar_amostra')
      OR public.has_permission(auth.uid(), 'liberar_resultado')
      OR public.has_permission(auth.uid(), 'imprimir_laudo')
      OR public.has_permission(auth.uid(), 'consultar_resultados')
    )
  )
);

DROP POLICY IF EXISTS atex_select ON public.atendimento_exames;
CREATE POLICY atex_select ON public.atendimento_exames
FOR SELECT
USING (
  public.is_super_admin(auth.uid())
  OR (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission(auth.uid(), 'visualizar_atendimentos')
      OR public.has_permission(auth.uid(), 'registrar_coleta')
      OR public.has_permission(auth.uid(), 'analisar_amostra')
      OR public.has_permission(auth.uid(), 'liberar_resultado')
      OR public.has_permission(auth.uid(), 'imprimir_laudo')
      OR public.has_permission(auth.uid(), 'consultar_resultados')
    )
  )
);

-- atendimento_pagamentos PERMANECE inalterado:
-- continua exigindo visualizar_atendimentos OU visualizar_financeiro.
-- Operacional não enxerga financeiro.