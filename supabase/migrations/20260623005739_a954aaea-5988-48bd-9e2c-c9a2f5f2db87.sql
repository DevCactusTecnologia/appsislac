CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  prof_perfil TEXT;
  extras TEXT[];
  revoked TEXT[];
  default_perms TEXT[];
BEGIN
  SELECT perfil, permissoes_extras, permissoes_revogadas
    INTO prof_perfil, extras, revoked
    FROM public.profiles WHERE user_id = _user_id;

  IF prof_perfil IS NULL THEN RETURN FALSE; END IF;

  IF _permission = ANY(revoked) THEN RETURN FALSE; END IF;
  IF _permission = ANY(extras)  THEN RETURN TRUE;  END IF;

  default_perms := CASE prof_perfil
    WHEN 'admin' THEN ARRAY[
      'visualizar_dashboard','cadastrar_paciente','editar_paciente','visualizar_pacientes',
      'criar_atendimento','editar_atendimento','cancelar_atendimento','visualizar_atendimentos',
      'registrar_coleta','analisar_amostra','liberar_resultado','imprimir_laudo',
      'consultar_resultados','lab_apoio_acesso',
      'gestao_financeira','registrar_pagamento','visualizar_financeiro',
      'criar_orcamento','visualizar_orcamentos',
      'gestao_usuarios','gestao_unidades','gestao_convenios','gestao_exames',
      'configuracoes_sistema','auditoria','impressao_geral',
      'integracoes.gerenciar',
      'solicitacoes_site_acesso','relatorios_producao','relatorios_ocorrencias',
      'relatorios_recoletas','mapa_trabalho_acesso',
      'gerenciar_soroteca','armazenar_amostra'
    ]
    WHEN 'analista' THEN ARRAY[
      'visualizar_dashboard','visualizar_pacientes','visualizar_atendimentos',
      'analisar_amostra','liberar_resultado','imprimir_laudo','registrar_coleta',
      'consultar_resultados','lab_apoio_acesso','mapa_trabalho_acesso',
      'armazenar_amostra'
    ]
    WHEN 'recepcionista' THEN ARRAY[
      'visualizar_dashboard','cadastrar_paciente','editar_paciente','visualizar_pacientes',
      'criar_atendimento','editar_atendimento','visualizar_atendimentos',
      'registrar_coleta','registrar_pagamento','criar_orcamento','visualizar_orcamentos',
      'consultar_resultados','solicitacoes_site_acesso'
    ]
    WHEN 'financeiro' THEN ARRAY[
      'visualizar_dashboard','visualizar_pacientes','visualizar_atendimentos',
      'gestao_financeira','registrar_pagamento','visualizar_financeiro',
      'criar_orcamento','visualizar_orcamentos',
      'consultar_resultados','relatorios_producao'
    ]
    ELSE ARRAY[]::TEXT[]
  END;

  RETURN _permission = ANY(default_perms);
END;
$function$;