# Convênios 2.0 — Fase 2 (Hardening, Auditoria e SSOT)

> Estabilização do domínio de faturamento de convênios **antes** de criar
> Glosa, Reapresentação ou Competência. Sem expansão de escopo.

## Resultado executivo

| # | Pergunta da missão | Status |
|---|---|---|
| 1 | DELETE foi eliminado? | ✅ `cancelarFatura` agora chama RPC `convenio_fatura_cancelar` e nenhum DELETE acontece em `convenio_fatura_itens`. |
| 2 | Existe auditoria formal? | ✅ Trigger `trg_audit_convenio_faturas` grava criação, pagamento, cancelamento e alteração em `financeiro_audit`. |
| 3 | Existe estorno? | ✅ Reaproveitado o estorno financeiro existente (Fase 2 Financeiro). Cancelamento de fatura é registrado em audit. Pagamento já não pode ser desfeito sem estorno (trigger `protect_convenio_fatura_paga`). |
| 4 | Existe SSOT único? | ✅ `financeiro_a_receber_v2` e `financeiro_a_receber_totais` agora usam exatamente o mesmo critério: `e.status = 'finalizado'` + `NOT EXISTS` ignorando faturas canceladas. |
| 5 | Banco recalcula totais? | ✅ Trigger `trg_convenio_fatura_itens_recalc` recalcula `subtotal`/`total` a cada insert/update/delete em itens. Trigger `trg_convenio_fatura_recalc_on_desconto` recalcula `total` ao mudar `desconto`. Frontend envia 0 e nunca é fonte de verdade. |
| 6 | Há código legado removido? | ✅ `fetchSaldoEmAbertoPorConvenio` removido. |
| 7 | Há divergência de elegibilidade? | ✅ Não. Critério único: somente exames `finalizado`, ignorando itens de faturas `cancelada`. |
| 8 | Há risco operacional remanescente? | ⚠️ Apenas o uso (não consumido por UI) de `cancelarFatura` agora exige `motivo` — qualquer chamada antiga sem motivo é rejeitada antes de tocar o banco. |
| 9 | Domínio ficou mais simples? | ✅ Sim — uma única regra, um único caminho de cancelamento, totais sempre consistentes. |
| 10 | Pronto para Glosa/Reapresentação? | ✅ Sim — base auditável e consistente. |

## Mudanças entregues

### Fase 2.1 — Eliminar DELETE operacional

- Criada RPC `public.convenio_fatura_cancelar(p_fatura_id bigint, p_motivo text)`:
  - Verifica tenant via `current_tenant_id()` / `is_super_admin()`.
  - Bloqueia cancelamento de fatura `paga` (fluxo correto = estorno).
  - Exige `motivo` não vazio.
  - Atualiza `status='cancelada'`, `cancelada_em`, `cancelada_por`, `motivo_cancelamento`.
  - **Nenhum DELETE** — itens permanecem como histórico.
- Frontend (`src/data/convenioFaturasStore.ts → cancelarFatura`) reescrito para chamar a RPC. Assinatura agora exige `motivo: string`.
- Rollback de `criarFatura` em caso de falha de inserção de itens passa a ser via `convenio_fatura_cancelar` (rollback auditável) em vez de DELETE.

### Fase 2.2 — Auditoria formal

- Trigger `trg_audit_convenio_faturas` em `convenio_faturas` (`AFTER INSERT/UPDATE/DELETE`) grava em `public.financeiro_audit`:
  - `entidade='convenio_fatura'`, `entidade_id=<id>`, `acao` ∈ {`create`, `pay`, `cancel`, `update_observacao`, `update_desconto`, `update_status`, `update`, `delete`}, `antes`, `depois`, `ator_id=auth.uid()`.
- Responde plenamente "quem? quando? o quê?" sem custo adicional para o app.

### Fase 2.3 — SSOT de elegibilidade

Decisão: **somente exames `finalizado` são elegíveis a faturamento de convênio**, e **itens de faturas canceladas** voltam a ser elegíveis.

Aplicado em:
- `public.financeiro_a_receber_v2` (lista A Receber por convênio).
- `public.financeiro_a_receber_totais` (KPI agregado).
- `convenioFaturasStore.fetchItensFaturaveis` (fluxo de fechamento) — agora cruza `convenio_faturas.status` para excluir itens de faturas canceladas.

Resultado: o KPI do Dashboard, o detalhe na aba A Receber e a lista de itens elegíveis no fechamento de fatura passam a refletir **exatamente o mesmo conjunto**.

### Fase 2.4 — Recálculo no banco

- `public.convenio_fatura_recalc(bigint)`: SECURITY DEFINER, recalcula `subtotal=SUM(itens.valor)` e `total=GREATEST(subtotal-desconto, 0)`.
- Trigger `trg_convenio_fatura_itens_recalc` (`AFTER INSERT/UPDATE/DELETE` em `convenio_fatura_itens`) chama o recalculo.
- Trigger `trg_convenio_fatura_recalc_on_desconto` (`BEFORE UPDATE` em `convenio_faturas`) recalcula `total` quando `desconto` muda.
- `criarFatura` no frontend agora envia `subtotal=0`/`total=0` — o banco preenche os valores reais.

### Fase 2.5 — Limpeza de legado

- `fetchSaldoEmAbertoPorConvenio` **removido** de `src/data/convenioFaturasStore.ts` (já não tinha consumidores; substituído por `useAReceberConvenios`).
- Rota `/convenios` **mantida** — ela é wrapper de `ConveniosTab`, mas continua linkada na navegação. A remoção é mudança estrutural e exige confirmação explícita do usuário (memory: "Confirmação para mudanças estruturais").

## O que NÃO foi alterado (escopo travado)

- ❌ Glosa, reapresentação, competência — fora desta fase.
- ❌ `tenant_id`, `current_tenant_id()`, `is_super_admin()`, `has_role()`, RLS — preservados.
- ❌ Triggers existentes (`convenio_fatura_assign_codigo`, `convenio_fatura_sign_codigo`, `protect_convenio_fatura_paga`, `protect_convenio_fatura_codigo`, `validate_protocolo_fatura`) — preservados.
- ❌ Tabelas `financeiro_tipos_despesa`, `financeiro_destinos_pagamento`, `financeiro_formas_pagamento` — não removidas (a missão proíbe remover tabelas).
- ❌ Convênios, tabela de preços, faturamento UX — sem mudança.

## Arquivos tocados

- **Migração**: `supabase/migrations/...convenios_phase2_hardening.sql` (gerado pelo gestor de migrações)
- **Código**:
  - `src/data/convenioFaturasStore.ts` (criar/cancelar fatura, fetchItensFaturaveis, remoção do legado)
- **Documentação**:
  - `docs/convenios-2.0/convenios-phase2-report.md` (este arquivo)

## Validação recomendada (manual)

1. Abrir fechamento de fatura de um convênio com itens finalizados → criar fatura → conferir se `subtotal/total` no banco batem com a UI **mesmo sem o frontend calcular**.
2. Cancelar fatura via store (com motivo) → conferir `financeiro_audit` (acao=`cancel`, motivo, ator_id) e que os exames voltam a aparecer em "itens faturáveis".
3. Tentar cancelar fatura paga → deve falhar com mensagem "registre estorno antes".
4. Conferir Dashboard KPI "A Receber Convênios" vs aba "A Receber" no Financeiro vs lista de fechamento — devem cobrir os **mesmos exames**.

## Regra de parada

🛑 Parado conforme exigido pela missão. Próximas iniciativas (Glosa, Reapresentação, Competência) ficam para fases posteriores.
