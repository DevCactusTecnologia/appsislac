# Fluxos Reais de Negócio — Financeiro SISLAC

> Cada diagrama descreve **o que acontece hoje**, não o que deveria. Setas indicam dependências de dados e gatilhos.

## Fluxo A — Atendimento Particular

```
NovoAtendimento.tsx (UI: paciente, exames, pagamento opcional)
        │
        ▼ submit
edge function: create-atendimento
        │
        ▼ RPC
create_atendimento_tx (Postgres, transacional)
   ├─ INSERT atendimentos                (status_pagamento inicial)
   ├─ INSERT atendimento_exames N×       (valor congelado, cobranca_destino='paciente')
   └─ INSERT atendimento_pagamentos M×   (cada forma adicionada no PagamentoDialog)
        │
        ▼ trigger AFTER INSERT em atendimento_pagamentos
trg_recompute_on_pagamento_change
   └─ recalcula atendimentos.status_pagamento (Pendente / Parcial / Pago)
        │
        ▼ realtime + subscribeAtendimentos
view financeiro_entradas (UNION ALL com pagamentos)
        │
        ▼ refreshEntradas() na rota /financeiro
Aba "Entradas" exibe a linha (regime de caixa)
```

Pagamento posterior (paciente volta para quitar):
- Aba **A Receber** → "Pagar" → abre `NovaEntradaSaidaDialog (tipo=entrada, protocolo)` → grava em `atendimento_pagamentos` via `update_atendimento_tx` (RBAC `registrar_pagamento`).

Cancelamento do atendimento:
- `update_atendimento_tx(_cancelar_tudo=true, _motivo_cancel)` → `status_atendimento='Cancelado'` → A Receber e Entradas filtram `<> 'Cancelado'` (RPC `financeiro_resumo` e `buildAReceberRowsFromAtendimentos`).

## Fluxo B — Atendimento por Convênio (faturamento em lote)

```
NovoAtendimento.tsx
   └─ exames com cobranca_destino='convenio', convenio_cobranca_id=X
        │
        ▼ create_atendimento_tx
atendimento_exames (status inicial 'pendente'; sem pagamento associado)
        │
        ▼ operacional
status_atendimento_exames evolui: pendente → coletado → em_analise → finalizado
        │
        ▼ Aba "A Receber" sub-tab "Convênios"
fetchSaldoEmAbertoPorConvenio() ⇒ exames(cobranca_destino='convenio',
                                         status<>'cancelado',
                                         NÃO em convenio_fatura_itens)
        │
        ▼ usuário clica "Fechar fatura"
FecharFaturaDialog → criarFatura()
   ├─ INSERT convenio_faturas (status='aberta', codigo provisório FAT-TMP-)
   │      └─ trigger convenio_fatura_assign_codigo substitui por FAT-AAAA-NNNNNNN
   └─ INSERT convenio_fatura_itens (vincula atendimento_exame_id + valor)
        │
        ▼ usuário recebe pagamento do convênio
marcarFaturaPaga(faturaId, formaPagamento, dataPagamentoISO)
   └─ UPDATE convenio_faturas SET status='paga', forma_pagamento, data_pagamento
        │
        ▼ trigger protect_convenio_fatura_paga
        (impede mutações destrutivas em fatura paga)
        │
        ▼ view financeiro_entradas reflete a fatura como 1 linha agregada
        (origem='fatura_convenio', cliente=convênio.nome, valor=fatura.total)
        │
        ▼ Aba "Entradas" (regime de caixa)
```

Cancelamento de fatura aberta:
- `cancelarFatura(id)` → DELETE `convenio_fatura_itens WHERE fatura_id=id` + UPDATE status='cancelada' → exames voltam a aparecer na lista de "saldo em aberto" do convênio.

## Fluxo C — Despesas / Saídas

```
Aba "Saídas" → botão "Nova"
   └─ NovaEntradaSaidaDialog (tipo='saida')
        │
        ▼ addSaida() em financeiroStore.ts
INSERT financeiro_saidas
   ├─ protocolo provisório SAI-TMP-... → trigger financeiro_saida_assign_protocolo
   │   substitui por SAI-AAAA-NNNNNNN
   ├─ tipo_despesa, destino_pagamento (livres + dicionário)
   ├─ valor, data_vencimento (regime de competência)
   ├─ foi_pago (boolean), data_pagamento (regime de caixa quando pago)
   └─ descricao codifica forma de pagamento: "...texto... [pgto:PIX]"
        │
        ▼ subscribeFinanceiro → atualiza saidasList in-memory
Aba "Saídas" mostra com KPIs: vencidas, vencendo7, pagas, pendentes
        │
        ▼ usuário clica "Pagar" (uma ou várias selecionadas)
PagarDespesaDialog ou marcarSaidasComoPagas (batch)
   └─ updateSaida(protocolo, { foiPago:'Sim', dataPagamento, pagamento })
        │
        ▼ Aba "Caixa"
buildCaixaMovimentos filtra saídas com foiPago='Sim' e mostra como saída de caixa
```

Edição: `EditEntryDialog` → `validateSaidaEdit` → `updateSaida` (UPDATE direto em `financeiro_saidas`).
Exclusão: `removeSaida` (DELETE; requer role `admin` por RLS).

## Fluxo D — Livro-Caixa

> Não há "abertura/fechamento de caixa". É puramente uma visão derivada.

```
Aba "Caixa" (activeTab='caixa')
   │
   ▼ buildCaixaMovimentos(entradas, saidas)
       ├─ entradas → todas as linhas da view financeiro_entradas (filterEntradasPagas)
       └─ saidas filtradas por foiPago='Sim'
   │
   ▼ filterCaixaMovimentos(period, search)
   ▼ computeCaixaSaldoInicial = Σ movimentos ANTES de dateFrom
   ▼ applyCaixaSaldoAcumulado linha a linha
   ▼ computeCaixaTotais (totalEntradas, totalSaidas, saldoFinal)
   │
   ▼ render tabela + impressão (buildLivroCaixaHtml → printHtmlInHiddenFrame)
```

## Fluxo E — Listas / Dicionários

```
Aba Saídas / Dialog Nova Saída
   ▼ usuário digita novo "tipo de despesa"
   ▼ openCriar('tipo_despesa', typed)
   ▼ CriarItemDialog → createItem()
   ▼ INSERT select_options (categoria='financeiro_tipo_despesa', sistema=false)
   ▼ invalidateDicionarios() → React Query refetch
   ▼ dropdowns atualizam
```

Exclusão: `deleteItem` ⇒ DELETE em `select_options`. Items `sistema=true` são bloqueados por trigger `protect_financeiro_listas_sistema`.

## Fluxo F — Integrações de pagamento (gateways/webhooks)

A aba "Integrações" só está visível com permissão `gestao_financeira` ou `visualizar_financeiro`. Renderiza `IntegracoesWebhookPanel` — visualização do **histórico** de webhooks de gateways em `tenant_payment_gateways`/`gatewayWebhookHistory`. **Não há geração de cobrança PIX/cartão automática** dentro do módulo Financeiro hoje (a infraestrutura existe em `tenant_payment_gateways`/`comprovante_links` e é usada por outros pontos do sistema).
