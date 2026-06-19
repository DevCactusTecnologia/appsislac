# Mapa de Domínio — Financeiro SISLAC

## Entidades reais (no banco)

### 1. Atendimento (`atendimentos`)
Cabeçalho do encontro com o paciente. Campos relevantes para o financeiro:
- `protocolo` (ATD-AAAA-NNNNNNN), `data`, `paciente_nome`, `convenio_nome`
- `status_atendimento` (inclui valor "Cancelado" — exclui do financeiro)
- `status_pagamento` (recalculado por trigger)
- `valor_total`, `valor_pago`, `desconto` (snapshot calculado pelo trigger)

**Responsabilidade:** ser o "documento mestre" do qual derivam tanto a operação clínica quanto o lançamento financeiro do paciente.

### 2. Exame de atendimento (`atendimento_exames`)
Linha de cobrança por exame.
- `valor` (preço congelado), `cobranca_destino` ∈ {`paciente`, `convenio`}
- `convenio_cobranca_id` (quando convênio)
- `status` (operacional: `pendente`/`coletado`/`em_analise`/`finalizado`/`cancelado`)
- `tipo_processo` (INTERNO/TERCEIRIZADO), `lab_apoio_id`

**Responsabilidade:** unidade granular de faturamento. É ela que entra em fatura de convênio ou compõe o saldo do paciente.

### 3. Pagamento de atendimento (`atendimento_pagamentos`)
Recebimento avulso (à vista, parcial ou complementar) feito pelo paciente.
- `tipo` (forma: PIX, Dinheiro, Crédito, Débito, etc.), `valor`, `data`, `observacao`
- Trigger `trg_recompute_on_pagamento_change` recalcula `status_pagamento` do atendimento.

**Responsabilidade:** registrar o caixa (regime de caixa) por paciente. É a fonte canônica das "Entradas" particulares.

### 4. Fatura de Convênio (`convenio_faturas`)
Agrupa N exames de N atendimentos de UM convênio em UM período.
- `codigo` (FAT-AAAA-NNNNNNN, atribuído por trigger)
- `periodo_inicio`, `periodo_fim`, `subtotal`, `desconto`, `total`
- `status` ∈ {`aberta`, `paga`, `cancelada`}
- `forma_pagamento`, `data_pagamento`

**Responsabilidade:** documento de cobrança consolidada do convênio. Quando `paga`, vira UMA linha agregada de "Entrada" (regime de caixa).

### 5. Item de Fatura (`convenio_fatura_itens`)
Vínculo `fatura_id` ↔ `atendimento_exame_id` + `valor` congelado.

**Responsabilidade:** marcar quais exames estão "presos" em uma fatura (impede dupla cobrança). O saldo em aberto por convênio é exatamente: exames com `cobranca_destino='convenio'` e status≠cancelado **não vinculados** a nenhuma fatura.

### 6. Saída / Despesa (`financeiro_saidas`)
Lançamento de despesa, com regime de competência (vencimento) **e** caixa (pagamento).
- `protocolo` (SAI-AAAA-NNNNNNN)
- `valor`, `data_vencimento`, `foi_pago`, `data_pagamento`
- `tipo_despesa`, `destino_pagamento` (campos textuais que referenciam dicionários)
- A **forma de pagamento** é serializada dentro de `descricao` no formato `"...texto... [pgto:PIX]"` (ver complexity-report).

**Responsabilidade:** despesas operacionais do laboratório.

### 7. Dicionários (`select_options`)
Categorias usadas pelo financeiro:
- `financeiro_tipo_despesa`
- `financeiro_destino_pagamento`
- `financeiro_forma_pagamento`

`sistema=true` => imutável. RLS exige `gestao_financeira` para escrita.

### 8. View `financeiro_entradas`
**Não é tabela** — é a fonte agregada da aba "Entradas":
```
SELECT pagamento (origem='pagamento') FROM atendimento_pagamentos JOIN atendimentos
UNION ALL
SELECT fatura  (origem='fatura_convenio') FROM convenio_faturas WHERE status='paga' JOIN convenios
```

## Entidades **derivadas** (apenas em código, não persistidas)

| Conceito | Onde mora | Como é calculado |
|---|---|---|
| **A Receber (paciente)** | RPC `a_receber_pacientes_page` ou `buildAReceberRowsFromAtendimentos` | `Σ atendimento_exames(cobranca_destino='paciente').valor − Σ atendimento_pagamentos.valor` |
| **A Receber (convênio)** | `fetchSaldoEmAbertoPorConvenio` em `convenioFaturasStore` | Exames `cobranca_destino='convenio'`, status≠cancelado, **não-faturados** |
| **Caixa / Livro-Caixa** | `buildCaixaMovimentos` (cliente) | Entradas (view) + Saídas pagas, ordenadas por data, saldo acumulado calculado client-side |
| **KPIs por aba** | `computeEntradaCounts` / `computeAReceberCounts` / `computeSaidaCounts` | Reduções sobre as listas em memória |

## Conceitos **inexistentes** no sistema atual

> Auditados explicitamente para registro:

- **Glosa** — não existe campo, tabela ou fluxo dedicado. Cancelamentos de fatura simplesmente liberam os exames para nova fatura (`cancelar_destruirItens` em `cancelarFatura`).
- **Estorno formal de pagamento** — não há fluxo dedicado; o que existe é UPDATE em `atendimento_pagamentos` (com permissão `registrar_pagamento`) e DELETE (com role `admin`).
- **Centro de custo** — não modelado.
- **Categoria contábil / plano de contas** — não modelado. Existem apenas `tipo_despesa` (Fixa/Variável + livre) e `destino_pagamento` (Governo/Fornecedor/etc.) como atributos textuais de despesa.
- **Caixa físico (sessão de caixa, abertura/fechamento)** — **não existe**. "Caixa" no SISLAC é puramente um livro-caixa em **regime de caixa**, calculado on-the-fly a partir de entradas + saídas pagas. Não há `cash_session`/`abertura`/`fechamento`/`saldo_inicial_persistido`.
- **Conta bancária** — não modelado. Forma de pagamento é apenas um rótulo textual.
- **Conciliação bancária** — não existe.
- **Recorrência de despesa** — não existe (toda saída é manual e única).

## Resumo de responsabilidades

| Domínio | Quem é responsável |
|---|---|
| Receber dinheiro de paciente | `atendimento_pagamentos` (escrita via `update_atendimento_tx`) |
| Faturar convênio | `convenio_faturas` + `convenio_fatura_itens` (escrita direta com RLS `gestao_financeira`) |
| Pagar despesa | `financeiro_saidas` + flag `foi_pago` |
| Apresentar entradas | view `financeiro_entradas` (read-only) |
| Apurar a receber | RPC `a_receber_pacientes_page` (pacientes) + cálculo de saldo de exames não-faturados (convênios) |
| Apurar caixa | Cálculo client-side em `buildCaixaMovimentos` |
