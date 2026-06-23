# Relatório Executivo — Estoque 2.0 (Fase 1)

## Verdade em uma frase
O Estoque atual é **pequeno, funcional e quase minimalista** — está mais próximo do ideal SISLAC ("olhou, entendeu, resolveu") do que se imagina. Não precisa ser reescrito; precisa ser **fechado nos furos**, **simplificado em 3 pontos** e **acordado em 2 automações**.

## SSOT do Estoque
| Pergunta | Resposta |
|---|---|
| Onde fica o saldo? | `estoque_lotes.quantidade_atual` (escrito pela trigger). |
| Saldo por insumo? | Derivado: SUM dos lotes ativos do insumo. |
| Histórico? | `estoque_movimentacoes` (imutável por RLS, mas deletável). |
| Catálogo? | `estoque_insumos` + `estoque_fornecedores`. |

## Módulos realmente usados
- ✅ Insumos · Lotes · Movimentações · Fornecedores · DecisionPanel · Histórico (drawer).

## Módulos que NÃO agregam valor (ou são potenciais excessos)
- ❌ RPC `estoque_marcar_lotes_vencidos` nunca chamada.
- ❌ Edição direta de `quantidade_atual` no `LoteDialog` (gera divergência silenciosa).
- ❌ Policy de DELETE em `estoque_movimentacoes` (quebra auditoria).
- ⚠ Índices subutilizados (`_categoria`, `_nome` em insumos).

## Duplicações
- Criar lote com qtd>0 + movimentação automática → **intencional**, manter.
- Fornecedor cadastrável em 2 lugares (Configurações + inline em Lote/Insumo) → **intencional**, manter.
- Status do lote tem 4 fontes (trigger / RPC morta / edição manual / cálculo no front) → **simplificar para 2**: trigger (`esgotado`) + cron diário (`vencido`). Eliminar edição manual de status.

## Código morto
- 1 RPC (`estoque_marcar_lotes_vencidos`).
- 0 componente, store, hook ou service órfão.

## Riscos operacionais (ordenados por gravidade)
1. **Edição direta de `quantidade_atual` no LoteDialog** → saldo diverge do histórico, sem rastro.
2. **Admin pode deletar movimentações** → trilho de auditoria comprometível.
3. **Lotes vencidos nunca são marcados** no banco — só visualmente no app.
4. **Sem `created_by` real** nas movimentações (`usuario_email` é cliente-side, falsificável).
5. **Excluir insumo CASCADE em lotes** → perda de histórico vinculado.

## Complexidade excessiva?
**Não.** O módulo tem ~1.700 LOC, 4 tabelas, 1 trigger, 1 RPC, 0 edge function. Está bem dimensionado.

## É intuitivo?
- Operador treinado: **sim**.
- Operador novo: **parcialmente** (4 botões no header, conceito de "ajuste negativo" obscuro, status do lote com semântica ambígua).

## O que REMOVER
- Edição manual de `quantidade_atual` no `LoteDialog` (substituir por "Ajustar saldo" que abre `MovimentacaoDialog 'ajuste'`).
- Policy de DELETE em `estoque_movimentacoes` (ou restringir a super_admin).
- RPC `estoque_marcar_lotes_vencidos` — *ou* ativar via cron diário (recomendado) *ou* deletar.
- Índices `_categoria` e `_nome` em insumos se não houver query que os use.

## O que SIMPLIFICAR
1. Tipo "ajuste" → trocar por "Definir saldo" (operador informa saldo final, sistema calcula delta).
2. `status` do lote → unificar fontes; congelar texto livre com CHECK CONSTRAINT.
3. KPIs → fundir "Vencidos" + "Vencendo" em um único KPI "Validade crítica" (clicável para abrir lista). Reduz de 5 para 4 cards.

## O que MANTER
- DecisionPanel (Inteligência) — joia do módulo, alinhado com a filosofia.
- KPI + filtro inteligente (toggle).
- Drawer de Histórico fora da rota principal.
- 4 tipos de movimentação como conceito; 1 trigger única para aplicar.
- RLS atual de SELECT/INSERT/UPDATE.

## O que NUNCA deveria ter sido criado
Nada explicitamente. O módulo evitou armadilhas comuns de ERP (não criou pedidos, cotações, inventário cíclico, transferência inter-unidades). **Esse foi um acerto.**

## O que NUNCA deveria ser criado agora
- Módulo de compras formal (sem demanda).
- Inventário cíclico com fechamento (sem demanda).
- Transferência inter-unidades (sem demanda).
- Vínculo automático com `atendimento_exames` (rever só se o laboratório pedir).

## Como transformar o estoque em "simples e operacional"
1. Fechar os 5 riscos acima.
2. Adicionar cron diário `estoque_marcar_lotes_vencidos` + notificação WhatsApp/email proativa para itens críticos.
3. Tornar `quantidade_atual` read-only no UI; toda mudança passa pelo `MovimentacaoDialog`.
4. Reduzir 1 KPI + reformular "ajuste" para "Definir saldo".
5. Cobrir com 2 a 3 testes E2E: criar lote → consumir → esgotar → registrar ajuste → deletar e validar histórico.

## Estado de aprovação
**Auditoria entregue. Aguardando aprovação explícita para iniciar Fase 2 (refatoração).**
Nenhuma alteração de código, schema, RLS, trigger ou UI foi realizada nesta fase.
