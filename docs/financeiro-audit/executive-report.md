# Relatório Executivo — Auditoria do Financeiro SISLAC

> Auditoria somente leitura, em 19/06/2026. Conclusões refletem o estado atual; nenhuma alteração foi feita.

## 1. Como o financeiro funciona hoje (em uma página)

O módulo `/financeiro` é uma rota single-page com 5 abas (`Entradas`, `A Receber`, `Saídas`, `Caixa`, `Integrações`) que **derivam** sua informação de quatro tabelas-base do Postgres:

- `atendimento_pagamentos` — recebimentos de paciente (regime de caixa).
- `convenio_faturas` + `convenio_fatura_itens` — faturamento em lote do convênio.
- `financeiro_saidas` — despesas (com regime de competência via `data_vencimento` + caixa via `foi_pago`/`data_pagamento`).
- `select_options` — dicionários (tipo de despesa, destino, forma).

Uma view `financeiro_entradas` unifica `atendimento_pagamentos` + faturas pagas como UMA fonte de leitura para a aba Entradas. Duas RPCs (`a_receber_pacientes_page`, `financeiro_resumo`) cuidam do que precisa de paginação/agregação. Mutations passam por `update_atendimento_tx` (transacional, com RBAC reforçado pela edge function `update-atendimento`) ou direto na tabela com RLS quando se trata de saída/fatura.

**Caixa não é persistido.** Não existe abertura/fechamento de caixa: a aba Caixa é uma agregação client-side em tempo real de Entradas + Saídas pagas, com saldo acumulado calculado linha a linha.

## 2. Fluxos principais

1. **Particular**: NovoAtendimento → `create_atendimento_tx` → `atendimento_pagamentos` → trigger recalcula `status_pagamento` → view `financeiro_entradas` → aba Entradas.
2. **Convênio**: NovoAtendimento (cobrança=convênio) → operacional finaliza → A Receber Convênios → `criarFatura` → `marcarFaturaPaga` → view `financeiro_entradas` (linha agregada).
3. **Despesa**: aba Saídas → `addSaida` → trigger atribui protocolo `SAI-...` → marcação como paga → entra no Caixa.
4. **Caixa**: derivação client-side a cada render.

## 3. Regras críticas (que não devem ser quebradas)

- `status_pagamento` do atendimento é **propriedade exclusiva** do trigger `trg_recompute_on_pagamento_change`.
- Códigos de documento (ATD/FAT/SAI) são **sempre** atribuídos pelo banco; cliente envia placeholders `*-TMP-*`.
- Toda tabela financeira é multi-tenant via `tenant_id` + RLS com `current_tenant_id()` + `is_super_admin()`.
- Fatura `status='paga'` é **imutável** pelo trigger `protect_convenio_fatura_paga`.
- Itens `select_options.sistema=true` não podem ser deletados (trigger).
- DELETE em qualquer tabela financeira exige `app_role='admin'`.

## 4. Entidades principais

| Entidade | Persistência | Papel |
|---|---|---|
| Atendimento | `atendimentos` | Documento mestre |
| Exame de atendimento | `atendimento_exames` | Linha de cobrança granular |
| Pagamento | `atendimento_pagamentos` | Recebimento de paciente |
| Fatura de Convênio | `convenio_faturas` (+ `_itens`) | Cobrança consolidada do convênio |
| Saída/Despesa | `financeiro_saidas` | Despesa operacional |
| Dicionários | `select_options` | Tipo despesa / destino / forma |

Conceitos **não modelados**: glosa formal, estorno formal, conta bancária, plano de contas, centro de custo, sessão/abertura/fechamento de caixa, conciliação bancária, recorrência de despesa.

## 5. Caixa — funciona como?

- 100% derivado, sem persistência.
- Composto por Entradas (view) + Saídas com `foi_pago=true`.
- Saldo inicial = soma dos movimentos com data anterior ao período filtrado.
- Saldo final = saldo inicial + entradas do período − saídas pagas do período.
- Impressão via HTML inline (`buildLivroCaixaHtml` + `printHtmlInHiddenFrame`).
- **Não é histórico imutável**: editar um pagamento antigo recompõe o livro de qualquer data.

## 6. Faturamento de convênio — funciona como?

- Lista de itens faturáveis = exames `cobranca_destino='convenio'` + `status='finalizado'` + convênio escolhido + período + **não vinculados** a nenhuma fatura.
- Criar fatura: header (`status='aberta'`) + itens (vincula `atendimento_exame_id`).
- `total = max(0, subtotal − desconto)` único da fatura (não distribui em itens).
- Marcar paga: UPDATE de header → automaticamente vira linha agregada na view `financeiro_entradas`.
- Cancelar fatura aberta: deleta itens + `status='cancelada'` → exames retornam ao "saldo em aberto".

## 7. Alinhamento ao domínio laboratorial?

**Sim, no essencial.** O modelo respeita as duas dinâmicas reais:

- Particular = pagamento por encontro, com possibilidade de pagamentos parciais e múltiplas formas no mesmo atendimento.
- Convênio = entrega de serviços agora, faturamento depois em lote, recebimento posterior.

A separação `cobranca_destino` no nível do **exame** (e não do atendimento) é correta para a realidade: um único atendimento pode ter exames cobrados do paciente E exames cobrados do convênio.

## 8. O que é simples

- View `financeiro_entradas` como SSOT da aba Entradas.
- RPC `financeiro_resumo` agregando KPIs em DB com filtros padronizados.
- Trigger único recalculando `status_pagamento`.
- Numeração centralizada nos triggers de cada tabela.
- RLS uniforme (`current_tenant_id()` + `is_super_admin()` + `has_permission()`).
- Hooks `useFinanceiroFilters` / `useFinanceiroDialogs` consolidaram o estado da página.

## 9. O que é complexo

- Coexistência de dois caminhos para "A Receber" (RPC vs. legacy in-memory) controlada por feature flags.
- Forma de pagamento de despesa serializada como sufixo em `descricao`, com encoder/decoder e função legada `@deprecated` ainda no mesmo arquivo.
- Caixa puramente derivado em cliente (sem snapshot), com paginação local sobre lista paginada da RPC.
- "Saldo em aberto por convênio" usa critério mais permissivo (`status<>'cancelado'`) que o critério de faturável (`status='finalizado'`) — gera divergência percebida.
- View `financeiro_entradas` não filtra atendimentos cancelados, mas RPC `financeiro_resumo` filtra — KPI do header pode divergir da listagem.
- Distribuição de desconto reaplicada em três camadas (NovoAtendimento, Index, RPC).

## 10. O que merece revisão futura (apenas observado, sem ação)

- Reconciliar exclusão de cancelados entre view e RPC.
- Avaliar coluna estruturada para forma de pagamento da saída (em vez de sufixo `[pgto:]`).
- Avaliar FK ou constraint de integridade entre `financeiro_saidas.tipo_despesa/destino_pagamento` e `select_options`.
- Avaliar remoção da branch legacy de "A Receber" e do helper `buildSaidaFromRow` (deprecated).
- Avaliar snapshot/fechamento de caixa caso o domínio passe a exigir histórico imutável.
- Avaliar consumo direto de `financeiro_resumo` no header (eliminando recálculos client-side redundantes).
- Avaliar filtro `status_atendimento` na view `financeiro_entradas`.

## 11. O que deve permanecer exatamente como está

- Triggers de numeração (ATD/FAT/SAI) — único caminho seguro multi-tenant.
- Trigger `trg_recompute_on_pagamento_change` como dono de `status_pagamento`.
- Edge function `update-atendimento` como gateway transacional para mutações em pagamentos/exames.
- RLS com modelo `current_tenant_id() + has_permission() + is_super_admin()`.
- View `financeiro_entradas` como ponto único de leitura da aba Entradas.
- `cobranca_destino` por exame (granularidade correta).
- Imutabilidade de fatura paga via trigger.
- Bloqueio de DELETE para não-admin nas tabelas financeiras.

---

**Conclusão.** O Financeiro do SISLAC é um módulo **funcionalmente coerente** com o domínio laboratorial e seguro do ponto de vista de RLS/RBAC. As complexidades documentadas são pontuais e **identificáveis sem reescrita**. O caixa é, por design, uma visão derivada — não um livro contábil imutável; isso precisa ficar explícito antes de qualquer evolução.
