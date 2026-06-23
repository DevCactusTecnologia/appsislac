
-- Revogar EXECUTE de PUBLIC (que cobre anon) e reconceder só a authenticated.
DO $$
DECLARE
  sig text;
  sigs text[] := ARRAY[
    'public.caixa_abrir(text, numeric, text)',
    'public.caixa_fechar(bigint, text)',
    'public.competencia_abrir(text)',
    'public.competencia_esta_fechada(uuid, text)',
    'public.competencia_fechar(text, text)',
    'public.competencia_reabrir(text, text)',
    'public.convenio_fatura_cancelar(bigint, text)',
    'public.convenio_fatura_glosar(bigint, text, jsonb)',
    'public.convenio_fatura_reapresentar(bigint, bigint[], text, date, date)',
    'public.convenio_fatura_recalc(bigint)',
    'public.desfazer_movimentacao(uuid)',
    'public.financeiro_estornar(text, bigint, text)',
    'public.mover_amostra(uuid, uuid, text, uuid, text)',
    'public.recompute_atendimento_totais(bigint)',
    'public.soroteca_caminho_posicao(uuid)'
  ];
BEGIN
  FOREACH sig IN ARRAY sigs LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', sig);
  END LOOP;
END $$;
