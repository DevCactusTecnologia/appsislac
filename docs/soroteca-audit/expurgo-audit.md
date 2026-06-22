# Soroteca — Expurgo Programado

## Workflow
`PROGRAMADO → EM_EXECUCAO → CONCLUIDO` | `PROGRAMADO → CANCELADO`.

## Operações
| Ação | Função | Linha |
|---|---|---|
| Prever candidatas | `preverCandidatas` | `sorotecaExpurgoStore.ts:88` |
| Criar lote | `criarLote` | 121 |
| Listar lotes | `listarLotes` | 187 |
| Obter lote | `obterLote` | 195 |
| Listar itens | `listarItens` | 201 |
| Iniciar execução | `iniciarExecucao` | 214 |
| Executar item | `executarItem` | 225 |
| Pular item | `pularItem` | 246 |
| Concluir | `concluirLote` | 268 |
| Cancelar | `cancelarLote` | 279 |

## Trigger `aplicar_expurgo_amostra`
Disparado em `expurgo_itens` quando `status` muda para `EXECUTADO`. Efeitos:
1. `UPDATE amostras SET status='DESCARTADA'`.
2. `UPDATE amostra_alocacoes SET retirada_em=now()` onde `retirada_em IS NULL`.
3. `UPDATE expurgo_lotes SET total_executados += 1`.

## Histórico de duas versões
- Primeira versão (`migration 20260622225950`) usa `ativa = true/false`, mas a coluna **não existe** em `amostra_alocacoes` → trigger quebrado.
- Segunda versão (`migration 20260622230056`) reescreve com `retirada_em IS NULL` — correta. `CREATE OR REPLACE` sobrescreve no banco; o código antigo permanece no arquivo da migration mas sem efeito.

## Reversão
**Não existe.** Nenhuma RPC ou botão UI desfaz o expurgo. Uma vez `EXECUTADO`, status `DESCARTADA` é permanente.

## Riscos operacionais
- `preverCandidatas` não filtra amostras com empréstimo ativo (ver `loans-audit.md`).
- Sem reversão → erro humano é definitivo.
- Sem confirmação dupla obrigatória na UI antes de executar todos os itens em lote.

## Consistência física
A trigger libera a posição (`retirada_em`) ao mesmo tempo que descarta a amostra — UNIQUE PARTIAL `uniq_posicao_ativa` é respeitado.
