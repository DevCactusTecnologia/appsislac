
-- FASE 1 — SECURITY DEFINER VIEWS → INVOKER
ALTER VIEW public.exames_publicos_view       SET (security_invoker = on);
ALTER VIEW public.financeiro_entradas        SET (security_invoker = on);
ALTER VIEW public.vw_coleta_diaria           SET (security_invoker = on);
ALTER VIEW public.vw_coletas_operacionais    SET (security_invoker = on);
ALTER VIEW public.vw_liberacao_diaria        SET (security_invoker = on);
ALTER VIEW public.vw_producao_diaria         SET (security_invoker = on);
ALTER VIEW public.vw_producao_operacional    SET (security_invoker = on);

-- FASE 2 — SEARCH_PATH MUTÁVEL
ALTER FUNCTION public.whatsapp_outbox_touch() SET search_path = public;

-- FASE 3a — Trigger functions: revogar EXECUTE de roles da API
REVOKE EXECUTE ON FUNCTION public.aplicar_expurgo_amostra()                  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_convenio_competencias()              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_convenio_glosas()                    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.block_delete_use_estorno()                 FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.convenio_fatura_set_competencia()          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_fatura_competencia_fechada()         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_fatura_item_competencia_fechada()    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_glosa_competencia_fechada()          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.profiles_guard_self_update()               FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_audit_convenio_faturas()                FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_convenio_fatura_itens_recalc()          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_convenio_fatura_recalc_on_desconto()    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_recompute_totais_on_exame()            FROM PUBLIC, anon, authenticated;

-- FASE 3b — RPCs operacionais: revogar EXECUTE de anon (mantém authenticated)
REVOKE EXECUTE ON FUNCTION public.caixa_abrir(text, numeric, text)                                       FROM anon;
REVOKE EXECUTE ON FUNCTION public.caixa_fechar(bigint, text)                                             FROM anon;
REVOKE EXECUTE ON FUNCTION public.competencia_abrir(text)                                                FROM anon;
REVOKE EXECUTE ON FUNCTION public.competencia_esta_fechada(uuid, text)                                   FROM anon;
REVOKE EXECUTE ON FUNCTION public.competencia_fechar(text, text)                                         FROM anon;
REVOKE EXECUTE ON FUNCTION public.competencia_reabrir(text, text)                                        FROM anon;
REVOKE EXECUTE ON FUNCTION public.convenio_fatura_cancelar(bigint, text)                                 FROM anon;
REVOKE EXECUTE ON FUNCTION public.convenio_fatura_glosar(bigint, text, jsonb)                            FROM anon;
REVOKE EXECUTE ON FUNCTION public.convenio_fatura_reapresentar(bigint, bigint[], text, date, date)       FROM anon;
REVOKE EXECUTE ON FUNCTION public.convenio_fatura_recalc(bigint)                                         FROM anon;
REVOKE EXECUTE ON FUNCTION public.desfazer_movimentacao(uuid)                                            FROM anon;
REVOKE EXECUTE ON FUNCTION public.financeiro_estornar(text, bigint, text)                                FROM anon;
REVOKE EXECUTE ON FUNCTION public.mover_amostra(uuid, uuid, text, uuid, text)                            FROM anon;
REVOKE EXECUTE ON FUNCTION public.recompute_atendimento_totais(bigint)                                   FROM anon;
REVOKE EXECUTE ON FUNCTION public.soroteca_caminho_posicao(uuid)                                         FROM anon;

-- Funções públicas-by-design — explicita intenção.
GRANT EXECUTE ON FUNCTION public.lookup_paciente_publico(uuid, text)   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_published_tenant_page(uuid, text) TO anon, authenticated;

-- FASE 4 — PACIENTES: índice composto para ORDER BY nome
CREATE INDEX IF NOT EXISTS idx_pacientes_tenant_nome_asc
  ON public.pacientes (tenant_id, nome);
