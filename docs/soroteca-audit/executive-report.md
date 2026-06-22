# Soroteca — Resumo Executivo

> Auditoria 100% leitura concluída. Nada foi alterado. Aguardando aprovação explícita para próxima fase.

## SSOT
- **Amostras:** `src/data/sorotecaStore.ts`.
- **Estrutura física:** `src/data/sorotecaEstruturaStore.ts`.
- **Empréstimos:** `src/data/sorotecaEmprestimosStore.ts`.
- **Expurgo:** `src/data/sorotecaExpurgoStore.ts`.
- **Materiais:** `src/data/materiaisAmostraStore.ts` (com lista hardcoded paralela em `sorotecaStore.ts:39-44`).

Stores não se sobrepõem — separação por domínio funcionou.

## Módulos maduros (preservar)
Criação de amostras, código de barras com DV, RLS multi-tenant, pesquisa avançada paginada com debounce, triagem HID (funcional), empréstimos com UNIQUE PARTIAL, estrutura física com constraints de conflito, catálogo de materiais com seed e trigger de sincronização.

## Módulos incompletos
1. Edição inline de local/galeria/posição (`atualizarLocal/Galeria/Posicao` mortos).
2. Reutilização de amostra no `NovoAtendimento` (`reutilizarAmostra` morto).
3. Timeline real via `audit_logs` (hoje é sintética).
4. Reversão de expurgo (inexistente).
5. Mapeamento de `gerenciar_soroteca` e `armazenar_amostra` em `has_permission()`.
6. Bloqueio de expurgo para amostras com empréstimo ativo (`preverCandidatas` não checa).

## Riscos operacionais
1. **Permissões não mapeadas** — usuários não-admin recebem erro 403 silencioso ao armazenar/emprestar/expurgar.
2. **Amostra emprestada pode entrar em lote de expurgo** — `preverCandidatas` não exclui empréstimos ativos.
3. **Expurgo sem reversão** — erro humano é definitivo.

## Dívida técnica concreta
- Até 6 pré-queries sequenciais em `buscarAmostrasAvancado` (autor já marcou para virar RPC).
- HID duplicado em dois componentes.
- `MATERIAIS_NAO_REUTILIZAVEIS` hardcoded ignora `materiais_amostra.reutilizavel`.
- `getAmostraDetalhe` faz 6 queries por modal aberto.
- `listarEmprestimos` com `limit(500)` sem paginação real.

## Código morto encontrado
`atualizarLocal/Galeria/Posicao`, `reutilizarAmostra`, `listarAmostras`. Detalhes em `dead-code-report.md`.

## Duplicação
Listener HID em `Soroteca.tsx` e `SorotecaTriagem.tsx`; bloqueio de empréstimo ativo (client vs RPC); listas de materiais hardcoded.

## Gargalo de performance
`getAmostraDetalhe` (6 roundtrips por modal) e `buscarAmostrasAvancado` (até 6 pré-queries).

## O modelo suporta crescimento?
Schema sim — índices adequados, UNIQUE PARTIALs atômicos, RLS multi-tenant. Frontend estressa acima de ~10k amostras pelos pré-filtros client-side.

## Próxima evolução recomendada (não implementar sem aprovação)
1. **Mapear `gerenciar_soroteca` e `armazenar_amostra`** no `has_permission()` — elimina bloqueio RLS silencioso.
2. **Adicionar check de empréstimo ativo em `preverCandidatas`** — fecha buraco operacional do expurgo.
3. **Extrair hook `useHidScanner`** — remove duplicação real.
4. **Migrar `buscarAmostrasAvancado` para RPC** com joins server-side.
5. **Substituir `MATERIAIS_NAO_REUTILIZAVEIS`** por leitura de `materiais_amostra.reutilizavel`.
6. **Avaliar timeline real consumindo `audit_logs`** (requer triggers explícitos nas tabelas da Soroteca).

## Critério de parada
Auditoria concluída. **PARADA.** Aguardo aprovação explícita para iniciar qualquer correção.

## Relatórios produzidos
- `inventory-report.md`
- `domain-map.md`
- `sample-lifecycle.md`
- `physical-structure-audit.md`
- `triagem-audit.md`
- `materials-audit.md`
- `search-audit.md`
- `loans-audit.md`
- `expurgo-audit.md`
- `timeline-audit.md`
- `security-audit.md`
- `performance-audit.md`
- `dead-code-report.md`
- `executive-report.md`
