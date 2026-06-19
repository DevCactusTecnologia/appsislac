# Regras de Negócio — Financeiro SISLAC

> Levantadas a partir de código + RPCs + triggers + RLS. Sem inferência.

## R1 — Recebimento (paciente / particular)

- Toda entrada de paciente é uma linha em `atendimento_pagamentos`.
- Trigger `trg_recompute_on_pagamento_change` é **a fonte da verdade** do `status_pagamento` do atendimento (não confiar em status calculado em outro lugar).
- Permissão exigida para INSERT/UPDATE: `registrar_pagamento`.
- DELETE só com `app_role = 'admin'`.
- Cancelamento do atendimento (`status_atendimento='Cancelado'`) **exclui** o atendimento dos cálculos de "A Receber" e do `financeiro_resumo` — pagamentos já lançados continuam fisicamente em `atendimento_pagamentos` mas a view `financeiro_entradas` reflete-os porque o JOIN não filtra por status (verificado no `pg_get_viewdef`). Ver complexity-report.
- "Pagamento efetuado" como `status_pagamento` é o filtro usado por `filterEntradasPagas` para a aba Entradas. Pagamentos parciais aparecem em A Receber, **não** em Entradas (regime de caixa estrito por status).
- Valor pago > valor total não é bloqueado em código nem em CHECK constraint (auditado).

## R2 — Recebimento (convênio)

- Convênio é **faturado em lote**, nunca recebido por exame individual.
- Um exame só é faturável se: `cobranca_destino='convenio'`, `status='finalizado'`, `convenio_cobranca_id = X`, e **não vinculado** a nenhuma `convenio_fatura_itens`.
- Saldo em aberto do convênio (`fetchSaldoEmAbertoPorConvenio`) tem regra MAIS PERMISSIVA: `status <> 'cancelado'` (incluindo pendente/coletado/em_analise). Ou seja, "saldo em aberto" exibe potencial; "faturável" exige `finalizado`.
- Ao criar fatura: `subtotal = Σ itens.valor`, `total = max(0, subtotal − desconto)`.
- Permissão exigida (RLS):
  - SELECT: `visualizar_financeiro`
  - INSERT/UPDATE: `gestao_financeira`
  - DELETE: `app_role = 'admin'`
- Código de fatura é **sempre** atribuído pelo banco via trigger `convenio_fatura_assign_codigo`. Cliente envia `FAT-TMP-...` que é descartado.
- `protect_convenio_fatura_paga` (trigger) impede mudanças destrutivas em fatura `status='paga'`.
- Marcar como paga ⇒ UPDATE com `forma_pagamento`, `data_pagamento`. **Não cria linha em `atendimento_pagamentos`** — a entrada no caixa vem da view `financeiro_entradas` (UNION ALL).
- Cancelar fatura: DELETE itens + UPDATE status='cancelada'. Os exames retornam ao "saldo em aberto" do convênio.

## R3 — Despesas / Saídas

- Protocolo `SAI-AAAA-NNNNNNN` atribuído por trigger no INSERT (`financeiro_saida_assign_protocolo`).
- Após atribuição, `protect_financeiro_saida_protocolo` impede alteração do protocolo.
- Campo `foi_pago` é boolean simples — não há histórico de pagamentos parciais de uma despesa.
- Forma de pagamento é codificada na `descricao` como sufixo `[pgto:FORMA]` (ver decode/encode em `financeiroStore.ts`). Não existe coluna dedicada em `financeiro_saidas`.
- Validação cliente (`validateSaidaEdit`):
  - `dataVencimento` obrigatória, formato `dd/mm/yyyy`.
  - Se `foiPago='Sim'` ⇒ `dataPagamento` obrigatória.
- Validação cliente (`validatePayment`): `payData` válida, `payForma` selecionada.
- Permissão (RLS de `financeiro_saidas`):
  - SELECT: `visualizar_financeiro`
  - INSERT/UPDATE: `gestao_financeira`
  - DELETE: `app_role = 'admin'`

## R4 — Caixa / Livro-Caixa

- Caixa é **derivado**, não persistido. Não existe sessão de caixa.
- Composição: `Entradas (view financeiro_entradas filtrada por status='Pagamento efetuado')` + `Saídas com foi_pago=true`.
- Saídas pendentes **não** afetam o caixa (apenas as pagas).
- Saldo inicial = `Σ movimentos com data < dateFrom` (entrada-saida). Sem dateFrom → 0.
- Saldo final = saldo inicial + total entradas no período − total saídas no período.
- Não há fechamento, lacre, hash de fechamento, ou bloqueio temporal.

## R5 — Glosa / Estorno / Conciliação

- **Glosa**: inexistente. Não há campo, tabela ou fluxo. Cancelamento de fatura é a única forma de "desfazer" cobrança convênio.
- **Estorno de pagamento**: não há flag/registro de estorno. Operacionalmente:
  - UPDATE em `atendimento_pagamentos` (mesma permissão de criar) — alteração in-place.
  - DELETE em `atendimento_pagamentos` (apenas `admin`).
  - Trigger recalcula `status_pagamento` automaticamente.
- **Conciliação bancária**: inexistente.

## R6 — Cancelamento de atendimento

- `update_atendimento_tx(_cancelar_tudo=true, _motivo_cancel=texto)` — exige permissão `cancelar_atendimento`.
- A RPC marca atendimento e exames como cancelados (verificado pela edge function que mapeia para esta permissão quando `cancelar_tudo=true` ou `motivo_cancel` não vazio).
- Pagamentos previamente lançados **permanecem** em `atendimento_pagamentos`.
- Cálculo de A Receber filtra `status_atendimento <> 'Cancelado'`.

## R7 — Descontos

Dois pontos de desconto independentes:

1. **Atendimento (paciente)**: `desconto` distribuído entre `examesCobranca` (excluindo destino=convênio) — implementado em `distribuirDescontoEntreExames`. Persiste via `update_atendimento_tx` com `examesCobranca` recalculados.
2. **Fatura de convênio**: `convenio_faturas.desconto` é único, do total da fatura. `total = max(0, subtotal − desconto)`.

## R8 — Tenancy

- TODA tabela financeira tem `tenant_id NOT NULL`.
- Toda policy usa `current_tenant_id()` + `is_super_admin()`.
- View `financeiro_entradas` propaga `tenant_id` em ambos os ramos do UNION (filtragem via RLS das tabelas-base).
- RPCs financeiras usam `current_tenant_id()` para isolar (verificado em `financeiro_resumo` e `a_receber_pacientes_page`).

## R9 — Numeração e protocolos

| Documento | Padrão | Origem |
|---|---|---|
| Atendimento | `ATD-AAAA-NNNNNNN` | trigger no atendimentos |
| Fatura | `FAT-AAAA-NNNNNNN` | `convenio_fatura_assign_codigo` |
| Saída | `SAI-AAAA-NNNNNNN` | `financeiro_saida_assign_protocolo` |
| Pagamento | `id` bigserial (sem protocolo público) | sequência |
| Item de fatura | `id` bigserial | sequência |

Cliente nunca define o número final — sempre placeholder `*-TMP-*` que é substituído pelo banco.

## R10 — Dicionários `select_options`

- Itens `sistema=true` são imutáveis (trigger `protect_financeiro_listas_sistema`).
- `nomeJaExiste` valida duplicidade case-insensitive + sem-acento client-side.
- RLS específica por categoria exige `gestao_financeira` para escrita (migration 20260613).
- Categorias usadas: `financeiro_tipo_despesa`, `financeiro_destino_pagamento`, `financeiro_forma_pagamento`.
