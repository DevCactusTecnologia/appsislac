# Regras de Negócio — Financeiro (estado atual)

## Recebimentos (entradas)

- **Como é criado um recebimento de paciente?**
  - INSERT em `atendimento_pagamentos` (vínculo obrigatório a `atendimento_id`).
  - Forma de pagamento: campo `tipo` (string livre, validada contra `select_options.financeiro_forma_pagamento`).
  - Não existe recebimento "solto" (sem atendimento) hoje.
- **Status de pagamento do atendimento** é recalculado por trigger `trg_recompute_on_pagamento_change`:
  - Soma `valor` de `atendimento_pagamentos` para o atendimento.
  - Compara contra Σ `(atendimento_exames.valor − desconto)` onde `cobranca_destino='paciente'`.
  - Define `status_pagamento` como `Pago`, `Parcial` ou `Pendente` (rótulos no front podem variar).
- **Desconto**: redistribuído proporcionalmente entre `atendimento_exames.desconto` (cliente em `Index.tsx`). Não há coluna `desconto_total` no atendimento.
- **Recebimento de fatura de convênio**: ocorre por UPDATE em `convenio_faturas.status='paga'` + `data_pagamento` + `forma_pagamento`. Não há lançamento separado em `atendimento_pagamentos`.

## Faturamento de Convênio

- Itens elegíveis: `atendimento_exames` com `cobranca_destino='convenio'`, `convenio_cobranca_id=X`, sem `convenio_fatura_itens` ainda (não faturados).
- `convenio_faturas.subtotal` = Σ valores brutos selecionados; `desconto` é manual; `total = subtotal − desconto`.
- Status: `aberta` (default) → `paga` | `cancelada`.
- Após `paga`, trigger `protect_convenio_fatura_paga` bloqueia UPDATE/DELETE de campos sensíveis.
- **Não há recebimento parcial de fatura** — fatura é tudo-ou-nada.
- **Não há tracking de glosa** — se o convênio pagar menos, hoje a operação é: cancelar a fatura e refaturar, ou aceitar o desconto manualmente antes de marcar `paga`.

## Pagamento de Despesas (saídas)

- INSERT em `financeiro_saidas` exige: `protocolo` (provisório, substituído por trigger), `data`, `descricao`, `valor`, `tenant_id`.
- Forma de pagamento (PIX/Dinheiro/Crédito/Débito): **codificada como sufixo `[pgto:X]`** dentro de `descricao` (não há coluna). Função `encodePagamento`/`decodePagamento` em `financeiroStore.ts`.
- `foi_pago=true` exige `data_pagamento` (validado em `validateSaidaEdit.ts` no client; banco aceita `null`).
- `data` (timestamp) é setada como `data_pagamento` (se foi_pago) ou `data_vencimento` (se não) — usada como "data efetiva" no livro-caixa.

## Caixa

- **Não há abertura nem fechamento.** A aba é uma projeção:
  - Entradas: linhas da view `financeiro_entradas`.
  - Saídas: `financeiro_saidas` com `foi_pago=true`.
  - Saldo inicial: soma de tudo anterior ao `dateFrom` filtrado.
  - Saldo final = inicial + entradas − saídas (no período).
- Impressão: HTML montado em `buildLivroCaixaHtml` e enviado a `printHtmlInHiddenFrame`.

## Estornos

- **Não há entidade de estorno.**
- Para reverter um pagamento de paciente: DELETE em `atendimento_pagamentos` (RLS exige `admin` + `current_tenant_id()`). Trigger de auditoria preserva o histórico em `atendimento_audit`.
- Para reverter fatura paga: barrado por `protect_convenio_fatura_paga`. Caminho operacional: cancelar (UPDATE para `cancelada` antes do trigger atuar) — passo prático costuma ser via correção manual em DB ou criar fatura nova compensatória.

## Cancelamentos

- Atendimento cancelado: `status_atendimento='Cancelado'`. O cliente filtra esses fora dos cálculos de A Receber (ver `buildAReceberRowsFromAtendimentos`). Pagamentos prévios continuam existindo em `atendimento_pagamentos`, mas o atendimento não conta como receita prevista.
- Fatura cancelada: `status='cancelada'` libera os itens para refaturamento (não há FK barrando).

## Descontos

- **No paciente**: distribuídos linha-a-linha em `atendimento_exames.desconto`.
- **Na fatura de convênio**: campo `convenio_faturas.desconto` (escalar). Não impacta `atendimento_exames`.
- Não há regra de desconto máximo por usuário/role.

## Geração de protocolos

- `ATD-AAAA-NNNNNNN` (atendimento), `FAT-AAAA-NNNNNNN` (fatura), `SAI-AAAA-NNNNNNN` (saída), assinados via HMAC e validados por trigger. Cliente envia provisório (`*-TMP-...`) e o oficial volta no INSERT.

## Tabela de preço (precificação)

- Sequência de fallback: `getPrecoExame(nome, tabelaConvenio)` → `getPrecoExame(nome, "Própria")` → `0`.
- Tabela do convênio resolvida por `getTabelaByConvenioNome(convenioNome)` (CBHPM/TUSS/Própria/personalizada).

## A Receber

- **Pacientes** (`a_receber_pacientes_page` RPC ou cálculo client):
  - Total a receber = Σ `(atendimento_exames where cobranca_destino='paciente') − atendimento_pagamentos.valor`.
  - Status `parcial` se já pagou algo, `pendente` se zero.
  - Excluídos: atendimentos cancelados.
- **Convênios** (`buildAReceberConvenioRows` + `fetchSaldoEmAbertoPorConvenio`):
  - Saldo = Σ valores de `atendimento_exames where cobranca_destino='convenio'` ainda não vinculados a fatura paga.

## Listas/Dicionários

- Persistência canônica: `select_options` (categoria + label + sistema/ativo/ordem).
- "Sistema" (`sistema=true`) bloqueia exclusão na UI.
- Tabelas `financeiro_tipos_despesa` / `financeiro_destinos_pagamento` / `financeiro_formas_pagamento` ainda existem com RLS, mas o **código atual não as utiliza** (resíduo histórico).
