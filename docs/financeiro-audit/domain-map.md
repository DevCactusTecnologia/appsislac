# Mapa de Domínio — Financeiro SISLAC

## Entidades existentes hoje

### 1. Atendimento (`atendimentos`)
Cabeçalho clínico-comercial. **Não é entidade financeira pura**, mas é a *origem* de toda receita.
- `status_pagamento`: derivado por trigger (`trg_recompute_on_pagamento_change`) a partir da soma dos pagamentos vs. valor a cobrar do paciente.
- `convenio_id`/`convenio_nome`: define se a receita virá por pagamento direto (Particular) ou via fatura de convênio.

### 2. Item de atendimento (`atendimento_exames`)
Linha cobrável. Define `valor`, `desconto`, `cobranca_destino` (`paciente` | `convenio`) e `convenio_cobranca_id`.
- O **rateio** entre paciente e convênio acontece aqui — não há tabela separada de "co-participação".

### 3. Pagamento de paciente (`atendimento_pagamentos`)
Recebimento avulso vinculado a um atendimento. Campos: `tipo` (forma de pagamento — Dinheiro/PIX/Crédito/Débito/...), `valor`, `data`, `observacao`.
- Imutabilidade prática: trigger de auditoria registra alterações; não há estorno formal — a remoção é DELETE direto (RLS exige role admin).

### 4. Fatura de convênio (`convenio_faturas`)
Agrupamento mensal/periódico de exames com `cobranca_destino='convenio'`. Estados: `aberta` → `paga` | `cancelada`.
- Trigger `protect_convenio_fatura_paga` impede edição depois de `paga`.
- Quando `paga`, a fatura aparece como **uma única linha** na view `financeiro_entradas` (origem `fatura_convenio`).

### 5. Item de fatura (`convenio_fatura_itens`)
Vínculo N:1 entre `atendimento_exames` e `convenio_faturas`, com snapshot de `valor`. Não há tracking de glosa/recurso/contestação — a coluna `valor` na fatura é a verdade.

### 6. Saída / Despesa (`financeiro_saidas`)
Lançamento manual de despesa. Campos: `protocolo`, `descricao`, `valor`, `tipo_despesa`, `destino_pagamento`, `data_vencimento`, `foi_pago`, `data_pagamento`.
- Forma de pagamento (PIX/Dinheiro/etc) **não tem coluna própria** — é codificada no fim de `descricao` no formato `[pgto:PIX]` (ver `encodePagamento` em `financeiroStore.ts`).

### 7. Convênio (`convenios`)
Cadastro do pagador. Flags relevantes:
- `libera_fluxo_sem_pagamento` — permite avançar coleta/análise sem quitar.
- `prazo_faturamento_dias` — sugestão para fechamento de fatura.

### 8. Dicionários financeiros (`select_options`, categorias `financeiro_*`)
Listas configuráveis por tenant: tipos de despesa, destinos de pagamento, formas de pagamento.

### 9. Orçamento (`orcamentos`, `orcamento_exames`)
Pré-venda. Não gera recebimento até virar atendimento.

### 10. Entrada Financeira (view `financeiro_entradas`)
**Não é entidade física** — é projeção UNION de pagamentos + faturas pagas. É a "tabela" lida pela aba Entradas.

## Entidades que **NÃO** existem hoje

Importante para a auditoria, pois costumam aparecer em ERPs financeiros e foram pesquisadas:

| Conceito | Existe? | Observação |
|----------|---------|------------|
| Caixa (sessão com abertura/fechamento) | ❌ | A aba "Caixa" é um **livro-caixa derivado** (saldo acumulado por data), não uma sessão operacional. |
| Movimento de caixa / Lançamento contábil | ❌ | Movimentos são reconstruídos em memória por `buildCaixaMovimentos`. |
| Conta bancária / Carteira | ❌ | Existe apenas o conceito livre de "destino_pagamento" (string). |
| Centro de custo | ❌ | — |
| Categoria contábil / Plano de contas | ❌ | `tipo_despesa` é o equivalente leve. |
| Estorno / Reversal | ❌ formal | Pagamento é deletado (admin), sem registro vinculado de reversão. |
| Glosa / Recurso de glosa | ❌ | Fatura tem só `aberta`/`paga`/`cancelada`. |
| Contas a pagar com parcelas | ❌ | `financeiro_saidas` é "à vista" (uma data de vencimento, um foi_pago). |
| Recebimento parcial de fatura | ❌ | Fatura é tudo-ou-nada (`paga` define `total`). Apenas atendimentos têm pagamento parcial. |
| Conciliação bancária | ❌ | — |
| Comissão de solicitante | ❌ | — |
| Caixinha por usuário/operador | ❌ | — |

## Responsabilidade de cada entidade (resumo)

- `atendimentos` + `atendimento_exames` → **o quanto deve entrar** (valor a faturar).
- `atendimento_pagamentos` → **quanto entrou avulso** (paciente).
- `convenio_faturas` (+ itens) → **quanto entrará agrupado** (convênio).
- `financeiro_saidas` → **o que saiu / vai sair**.
- `financeiro_entradas` (view) → **leitura unificada de receita realizada**.
- A Receber = (a faturar de paciente) + (a faturar de convênio aberto), calculado em runtime.
