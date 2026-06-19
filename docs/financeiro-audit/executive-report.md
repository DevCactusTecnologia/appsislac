# Relatório Executivo — Auditoria do Financeiro SISLAC

Data: 2026-06-19. Modo: somente leitura.

## Como o Financeiro funciona hoje?

O módulo é um **livro de receitas, contas a receber e despesas** acoplado ao módulo de Atendimentos. Tudo o que entra vem de pagamentos avulsos de pacientes (`atendimento_pagamentos`) ou de faturas de convênio quitadas (`convenio_faturas`). Tudo o que sai vem de despesas manuais (`financeiro_saidas`). A aba "Caixa" é um **relatório derivado**, não uma operação com abertura/fechamento.

## Fluxos principais

1. **Particular**: NovoAtendimento → PagamentoDialog → `atendimento_pagamentos` → trigger atualiza status → view `financeiro_entradas`.
2. **Convênio**: NovoAtendimento (cobranca_destino='convenio') → fechamento manual em FecharFaturaDialog → `convenio_faturas` (aberta) → marcar paga → view `financeiro_entradas`.
3. **Despesa**: NovaEntradaSaidaDialog → `financeiro_saidas` → eventualmente "marcar como paga".
4. **Caixa**: tudo agregado em runtime, com saldo acumulado e impressão HTML.
5. **A Receber**: RPC paginado (ou cálculo client em fallback) sobre exames cobrados − pagamentos.

## Regras críticas

- Status de pagamento do atendimento é **autoritativo do banco** (trigger).
- Fatura paga é **imutável** (trigger).
- Protocolos (ATD/FAT/SAI) são **gerados e assinados em DB** com HMAC.
- Roles: `admin` exclui; `gestao_financeira` movimenta; `registrar_pagamento` recebe; `visualizar_financeiro` lê.
- Tudo escopado por `tenant_id = current_tenant_id()` (multi-tenant).

## Entidades principais

`atendimentos`, `atendimento_exames`, `atendimento_pagamentos`, `convenios`, `convenio_faturas`, `convenio_fatura_itens`, `financeiro_saidas`, view `financeiro_entradas`, dicionários em `select_options`.

## O caixa funciona como?

Não funciona como sessão. É um **livro-caixa derivado**: Σ entradas (view) + Σ saídas pagas, ordenado por data, saldo acumulado linha-a-linha. Imprimível, não persistido, sem responsável e sem fechamento.

## O faturamento de convênios funciona como?

Manual. O usuário entra na sub-aba Convênios (A Receber) ou em `/convenios`, escolhe convênio + período, vê itens elegíveis (exames com cobranca_destino='convenio' não faturados), aplica desconto opcional, fecha (`aberta`). Quando recebe, marca como `paga` informando forma e data. Não há recebimento parcial, não há glosa estruturada.

## Está alinhado ao domínio laboratorial?

- **Sim** para o caso comum (paciente paga na recepção; convênio fatura mensal).
- **Parcialmente** para casos sofisticados: glosa, recurso, recebimento parcial de convênio, conciliação bancária, comissão de solicitante, plano de contas.

## O que é simples (e funciona bem)

- Modelo de pagamentos de paciente (`atendimento_pagamentos` + trigger de status).
- View `financeiro_entradas` unificando origens.
- Geração de protocolos com HMAC.
- RLS multi-tenant com permissões granulares.
- Split de derivações puras em `FinanceiroService.ts` (testável).

## O que é complexo (e merece atenção futura)

- Forma de pagamento de despesa codificada em string (`[pgto:X]`).
- Duplicação RPC vs. cálculo client em A Receber.
- Tabelas legadas de dicionários ainda presentes no schema.
- Caixa sem SSOT (sem materialização nem auditoria).
- Estorno e glosa como conceitos ausentes — operação informal.
- 924 linhas em `Financeiro.tsx` mesmo após split parcial.

## O que merece revisão futura (apenas listado, não recomendado executar)

- SSOT para forma de pagamento de saída (coluna dedicada).
- Definição formal de regime de caixa vs. competência (hoje implícito).
- Suporte a glosa e recebimento parcial de fatura.
- Materialização de saldo de caixa para auditoria histórica.
- Eliminação das tabelas legadas dos dicionários ou redirecionamento de uso.

## O que deve permanecer exatamente como está

- Modelo `atendimento_pagamentos` + trigger de recálculo de `status_pagamento`.
- View `financeiro_entradas` como única fonte de leitura de receita realizada.
- Imutabilidade de fatura paga via trigger.
- Geração e assinatura de protocolos no banco.
- Estrutura de RLS e permissões (`visualizar_financeiro`, `gestao_financeira`, `registrar_pagamento`, role `admin`).
- Multi-tenancy via `current_tenant_id()` em todas as queries.
- Split de funções puras em `Financeiro/services/*` — não tem dívida visível.

---

> **Parada da missão**: nenhum código, banco, RLS, RPC, trigger, edge function, rota, store ou componente foi alterado. Os relatórios desta auditoria estão em `docs/financeiro-audit/`.
