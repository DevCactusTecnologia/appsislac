# Fluxos Reais de Negócio — Financeiro

> O que **realmente** acontece hoje, com referências a código e tabelas.

## Fluxo 1 — Atendimento Particular (paciente)

```
NovoAtendimento.tsx (wizard)
  └─ PagamentoDialog (registra formas de pagamento + desconto)
        ↓ res.novosPagamentos[]
  └─ create-atendimento (edge fn) → RPC create_atendimento_tx
        INSERT atendimentos
        INSERT atendimento_exames (com cobranca_destino='paciente')
        INSERT atendimento_pagamentos (cada forma)
        TRIGGER trg_recompute_on_pagamento_change
              → atualiza atendimentos.status_pagamento

Pagamentos posteriores (página /atendimentos):
  PagamentoDialog → INSERT atendimento_pagamentos
        TRIGGER recalcula status_pagamento

Reflexo no Financeiro:
  view financeiro_entradas faz UNION pagamento|fatura_convenio
  → aba Entradas mostra linha com origem='pagamento'
```

**Particularidade**: o desconto é redistribuído proporcionalmente entre `atendimento_exames.desconto` (lógica em `Index.tsx → handlePagamentoConfirm`) — não fica numa coluna global.

## Fluxo 2 — Atendimento Convênio

```
NovoAtendimento (define convenio_id)
  └─ atendimento_exames criados com cobranca_destino='convenio'
       e convenio_cobranca_id = convenio do exame
  → atendimento.status_pagamento depende SÓ do que é cobrado do paciente

Resultados/coleta/análise seguem normalmente
  (status financeiro do paciente independe).

Faturamento (manual, em /financeiro → aba A Receber → sub-aba Convênios
ou em /convenios):
  FecharFaturaDialog
    └─ lista ItemFaturavel (atendimento_exames de cobranca_destino='convenio'
       sem fatura_id), do convênio X, no período P
    └─ seleciona itens, define desconto/observação
    └─ INSERT convenio_faturas (status='aberta')
    └─ INSERT convenio_fatura_itens (snapshot de valor)
    → trigger convenio_fatura_assign_codigo gera FAT-AAAA-NNNNNNN

Pagamento da fatura:
  FaturaDetalheDialog → marca como 'paga'
    UPDATE convenio_faturas SET status='paga', forma_pagamento, data_pagamento
    TRIGGER protect_convenio_fatura_paga (bloqueia edição posterior)
  → fatura aparece em financeiro_entradas com origem='fatura_convenio'
```

## Fluxo 3 — Despesa (Saída)

```
/financeiro → aba Saídas → "Nova Saída" (NovaEntradaSaidaDialog)
  └─ campos: descrição, valor, tipo_despesa, destino_pagamento,
              forma_pagamento (codificada na descricao!), data_vencimento,
              foi_pago + data_pagamento (se sim)
  └─ INSERT financeiro_saidas
       TRIGGER financeiro_saida_assign_protocolo gera SAI-AAAA-NNNNNNN

Quitação posterior (PagarDespesaDialog):
  UPDATE financeiro_saidas SET foi_pago=true, data_pagamento=...
```

> **NÃO há "Lançamento → Vencimento → Pagamento" como estados separados**: a saída nasce já com vencimento e flag `foi_pago`. Não há parcelamento.

## Fluxo 4 — "Caixa"

```
Aba Caixa NÃO abre/fecha sessão. Ela é puramente derivada:

  buildCaixaMovimentos(entradas, saidas_pagas)
    → CaixaMov[] ordenado por data
  applyCaixaSaldoAcumulado(movs, saldoInicial)
    → cada linha recebe saldoAcumulado
  computeCaixaTotais → totalEntradas, totalSaidas, saldoFinal
  buildLivroCaixaHtml → impressão (printHtmlInHiddenFrame)
```

Não existe `caixa.aberto`, não existe operador responsável, não existe sangria/suprimento, não existe fechamento com conferência. **É um relatório**, não uma operação.

## Fluxo 5 — Entrada Manual

`NovaEntradaSaidaDialog` em modo "entrada" também grava em… **`financeiro_saidas`** (com sinal/categorias específicas) **OU** cria um pagamento avulso? Auditoria indica que entradas manuais existem como atalho e dependem do contexto da aba. Veja `business-rules.md`.

## Fluxo 6 — Orçamento → Atendimento

```
/orcamentos → cria orcamentos + orcamento_exames
  (não impacta financeiro até converter)
Conversão: Orçamento → "Gerar Atendimento"
  → cai no Fluxo 1 ou Fluxo 2
```
