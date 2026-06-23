# Auditoria de Saídas — Estoque 2.0

## Como o estoque DIMINUI hoje

| # | Caminho | Tipo | Rastreável? |
|---|---|---|---|
| 1 | Movimentação 'saida' | consumo | ✅ trigger debita lote. |
| 2 | Movimentação 'descarte' | perda/vencido | ✅ trigger debita lote. |
| 3 | Movimentação 'ajuste' com qtd negativa | conferência | ✅ trigger aplica delta literal. |
| 4 | Edição manual de `quantidade_atual` no `LoteDialog` | qualquer | ❌ sem registro em movimentações. |
| 5 | Excluir lote (`excluirLote`) | catastrófico | ⚠ apaga o lote sem registro de baixa. CASCADE pelas FKs preserva integridade, mas `estoque_movimentacoes.lote_id` vira NULL (SET NULL) — o histórico perde o vínculo com o lote. |
| 6 | Excluir insumo | catastrófico | ⚠ CASCADE em `estoque_lotes` apaga todos os lotes do insumo, e as movimentações ficam com `lote_id NULL`. Saldos somem sem trilha. |

## Tipos não implementados
- Transferência entre unidades / pontos de coleta — inexistente.
- Consumo automático ao finalizar exame / atendimento — inexistente.
- Baixa por validade automática — depende da RPC `estoque_marcar_lotes_vencidos` que nunca roda.

## Auditoria
- Tabela `estoque_movimentacoes` registra `usuario_email`, `data`, `motivo`, `observacao`.
- Não há campo de IP nem `created_by uuid` (referência ao `auth.users`).
- Policy de DELETE em `estoque_movimentacoes` permite admin apagar registros do histórico → risco de manipulação.

## Risco de saldo incorreto
| Risco | Severidade | Causa |
|---|---|---|
| Edição direta de `quantidade_atual` | **Alta** | bypass do trigger. |
| Exclusão de lote/insumo desvincula histórico | **Média** | FK SET NULL. |
| Status `vencido` nunca aplicado automaticamente | **Média** | RPC nunca chamada. |
| Sem CHECK em `quantidade_atual >= 0` | **Baixa** | o trigger usa `GREATEST(0, …)` mas updates manuais podem furar. |
| Sem CHECK em `tipo` da movimentação | **Baixa** | qualquer string entra. |

## Respostas diretas
- **Como diminui?** 4 tipos de movimentação + edição direta + exclusão de lote/insumo.
- **Existe auditoria?** Parcial — usuário/data registrados, mas histórico pode ser deletado e bypass via edição existe.
- **Risco de saldo incorreto?** Sim, especialmente em (4), (5), (6).
