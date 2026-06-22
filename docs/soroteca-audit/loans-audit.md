# Soroteca — Empréstimos

## Workflow
`PENDENTE → APROVADO → RETIRADO → DEVOLVIDO` (ou `REJEITADO` / `CANCELADO`).

## Operações (`sorotecaEmprestimosStore.ts`)
| Ação | Função | Linha |
|---|---|---|
| Solicitar | `solicitarEmprestimo` | 80 |
| Aprovar | `aprovarEmprestimo` | 134 |
| Rejeitar | `rejeitarEmprestimo` | 153 |
| Registrar retirada | `registrarRetirada` | 181 |
| Registrar devolução | `registrarDevolucao` | 200 |
| Cancelar | `cancelarEmprestimo` | 226 |

## RLS
Todas operações (insert/update) exigem `armazenar_amostra`. Delete só `super_admin`. Política definida em `migration 20260622225429:85-91`.

## Garantia de unicidade
`uniq_emprestimo_amostra_ativo` (PARTIAL WHERE `status IN ('PENDENTE','APROVADO','RETIRADO')`) — uma amostra não pode ter dois empréstimos ativos simultâneos. Garantido no banco.

## Auditoria
- `created_at`, `updated_at` automáticos.
- Histórico de autor por ação: `solicitado_por`, `aprovado_por`, `rejeitado_por`, `retirado_por`, `devolvido_por` + timestamps.
- **Não há** trigger consumindo `audit_logs` para esta tabela.

## Bloqueio de expurgo
- `buscarAmostrasReutilizaveis` (`sorotecaStore.ts:307-315`): **checa** empréstimo ativo e exclui.
- `preverCandidatas` (`sorotecaExpurgoStore.ts:88`): **NÃO checa** empréstimo. Amostra `DISPONIVEL` com empréstimo `RETIRADO` pode entrar no lote de expurgo — **risco operacional**.

## RPC não consumida
`amostra_em_emprestimo_ativo(uuid)` (migration `20260622225429`) está definida mas o frontend não a usa — duplicação lógica entre cliente e banco.
