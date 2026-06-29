-- ============================================================================
-- Teste automatizado: edição de atendimento preserva estado clínico
-- ----------------------------------------------------------------------------
-- A lógica completa vive na função SECURITY DEFINER
--   public.__test_update_atendimento_tx_state(uuid)
-- (criada na migration 20260629_*_test_update_atendimento_preserves_state).
--
-- Cenários cobertos:
--   1. Editar cabeçalho (solicitante) reenviando a mesma lista de exames
--      → IDs, status, timestamps, resultados e analista PRESERVADOS.
--   2. Adicionar 1 exame novo (payload com 4 itens)
--      → 3 originais intactos; novo entra como `pendente`.
--   3. Remover 1 exame (payload com 3 itens, sem o 1º)
--      → exame removido some; os outros 2 mantêm estado.
--
-- Execução:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/update_atendimento_tx_preserves_state.sql
--
-- A função usa BEGIN/EXCEPTION (savepoint implícito do PL/pgSQL) e levanta
-- exceção sentinela ao final → todo o setup é revertido. Nada persiste.
-- ============================================================================

\echo
\echo '── Rodando teste: update_atendimento_tx preserves clinical state ──'

SELECT public.__test_update_atendimento_tx_state();

\echo
\echo '✅ Teste passou: edição de atendimento NÃO destrói coletas/análises/resultados.'
