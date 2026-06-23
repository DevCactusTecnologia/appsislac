# Auditoria de Entradas — Estoque 2.0

## Como o estoque AUMENTA hoje

| # | Caminho | Onde | Rastreável? |
|---|---|---|---|
| 1 | Criar lote com `quantidade_inicial > 0` | `LoteDialog` → `salvarLote()` → `registrarMovimentacao('entrada', motivo='Entrada inicial do lote')` | ✅ Sim — gera linha em `estoque_movimentacoes`. |
| 2 | Movimentação manual tipo `entrada` | `MovimentacaoDialog` | ✅ Sim — passa pela mesma trigger. |
| 3 | **Editar `quantidade_atual` diretamente no LoteDialog** | `LoteDialog` em modo edição | ❌ **NÃO** — update direto na tabela `estoque_lotes`, NÃO gera movimentação, NÃO passa pelo trigger. **Saldo diverge do histórico.** |
| 4 | Ajuste positivo | `MovimentacaoDialog` tipo `ajuste` qtd>0 | ✅ Sim. |

## Duplicações
- (1) e (2) coexistem sem conflito (atalho explícito ao criar lote).
- (3) é uma porta dos fundos não intencional. Único furo de auditoria sério do módulo.

## Pedidos de compra / recebimento separado
Não existem. Toda entrada é tratada como "criar lote" ou "movimentação de entrada".
Para um laboratório pequeno isto é adequado; para qualquer operação com NF + conferência → insuficiente.

## Risco de auditoria
- O caminho (3) permite que um admin "ajuste" o saldo sem deixar registro no histórico. Em conjunto com a ausência de update policy em `estoque_movimentacoes` (existe só select/insert/delete), o trilho de auditoria fica frágil: deletar movimentações é permitido a qualquer admin.

## Respostas diretas
- **Como o estoque aumenta?** Criando lote (com qtd inicial) ou registrando movimentação 'entrada'.
- **Existe duplicação?** Sim, mas controlada — exceto pelo bypass via edição de `quantidade_atual`.
- **Existe entrada sem rastreabilidade?** SIM: edição direta de `quantidade_atual` no LoteDialog não gera movimentação.
