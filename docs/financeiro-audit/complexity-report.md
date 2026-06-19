# Relatório de Complexidade — Financeiro SISLAC

> Apenas observação. Nada aqui é recomendação de mudança.

## Duplicações e fluxos paralelos

### D1. Dois caminhos para "A Receber (pacientes)"
- Caminho A (RPC): `useAReceberPacientes` → `a_receber_pacientes_page` + `useFinanceiroResumo` → `financeiro_resumo`.
- Caminho B (legacy): `buildAReceberRowsFromAtendimentos(getAtendimentos())` em cliente, sobre cache de até 100 atendimentos.
- Selecionado por feature flag (`paginated_atendimentos` × `USE_LEGACY_STORE`). Os dois coexistem em `Financeiro.tsx` (lines ~304–350) e ambos são chamados sem short-circuit por causa da regra dos hooks.
- Resultado: branch legacy fica subdimensionado em tenants com volume; o template de `AReceberRow` é mantido idêntico via `buildAReceberRowsFromRpc` (adapter com `atendimento` stub).

### D2. Forma de pagamento serializada na descrição da saída
- `financeiro_saidas.descricao` carrega o sufixo `[pgto:FORMA]` codificado por `encodePagamento` e decodificado por `decodePagamento` em `financeiroStore.ts`.
- Não há coluna estruturada para forma de pagamento de despesa (apesar do dicionário `financeiro_forma_pagamento` existir).
- Função `buildSaidaFromRow` legada existe e usa heurística diferente (`row.destino_pagamento` matching `/PIX|Dinheiro|Crédito|Débito/i`); está marcada `@deprecated`, mas mora no arquivo. Risco de chamada acidental ⇒ valores divergentes.

### D3. Dois receivers de pagamento que escrevem no mesmo lugar
- `PagamentoDialog` (NovoAtendimento, Index) → `update_atendimento_tx` direto.
- `NovaEntradaSaidaDialog (tipo=entrada)` (Financeiro) → grava em `atendimento_pagamentos` por seu próprio caminho.
- Ambos resultam em row em `atendimento_pagamentos`, mas o caminho de cada um é diferente. UX e validações divergem.

### D4. Distribuição de desconto do paciente em três pontos
1. `distribuirDescontoEntreExames` (NovoAtendimento) — origem.
2. Re-redistribuição em `Index.tsx → handlePagamentoConfirm` (correção recente: aplica desconto sobre `examesCobranca`).
3. Persistência via `update_atendimento_tx` (envia `examesCobranca` recalculados + `desconto`).
   Cada um precisa estar consistente; correção feita em uma camada não corrige a outra.

### D5. Paginação local + paginação RPC
- Tabela de A Receber tem `aReceberPaginated` (slice client-side em `Financeiro.tsx`) **mesmo quando** o caminho RPC já paginou via cursor com `pageSize=50`. A RPC retorna ≤50 e o cliente refilra em página de 8.

### D6. KPIs duplicados
- `computeFinanceiroSummary` (header) + `computeEntradaCounts` / `computeAReceberCounts` / `computeSaidaCounts` (chips por aba). Ambos derivam dos mesmos arrays — overhead pequeno, mas duas equações para "quanto entrou".
- Quando o RPC `financeiro_resumo` está ON, o header poderia consumi-lo direto, mas a derivação client continua sendo calculada.

## Regras repetidas / heurísticas frágeis

### R1. Cancelados aparecendo em "Entradas"
- View `financeiro_entradas` não filtra `status_atendimento = 'Cancelado'`. RPC `financeiro_resumo` filtra. Resultado: a aba **Entradas** pode listar pagamentos de atendimentos depois cancelados, mas o header "total recebido" (RPC) os exclui — números divergem.

### R2. "Saldo em aberto por convênio" usa critério mais frouxo que "faturável"
- Saldo em aberto: `status <> 'cancelado'` (qualquer estágio do pipeline, inclusive pendente).
- Faturável: `status = 'finalizado'`.
- O número que recepção/gestor vê em "A Receber Convênios" pode ser muito maior do que o efetivamente faturável agora.

### R3. Saldo de caixa derivado on-the-fly
- Não há snapshot persistido. Edição retroativa de um pagamento muda o livro-caixa de qualquer dia anterior.
- Aceitável por design (regime de caixa), mas é importante registrar: livro-caixa **não é histórico imutável**.

### R4. Dicionários de despesa sem FK
- `financeiro_saidas.tipo_despesa` / `destino_pagamento` são `text` livres, não FK para `select_options`.
- Excluir uma opção do dicionário não impede a coluna existente de continuar referenciando o nome — fica um valor "órfão" exibido normalmente.

### R5. `_idByProtocolo` apenas em memória
- `financeiroStore` mapeia `protocolo → id` em um `Map` no módulo. Se o cache não foi inicializado (`_initFinanceiroStore`) antes de `updateSaida/removeSaida`, lança `"Saída ${protocolo} sem id no cache local"`.
- O lazy-load via `useEnsureStore(["financeiro"])` resolve, mas é um acoplamento implícito.

## Funcionalidades pouco utilizadas / mortas

- **`buildSaidaFromRow` (não-decoded)**: marcado `@deprecated`, ainda no arquivo.
- **`getNextFaturaCodigo`**: marcado `@deprecated` — retorna `FAT-TMP-...` que o banco descarta.
- **`assinatura_protocolo` em `convenio_faturas`**: coluna existe; nenhum fluxo de UI no `/financeiro` parece consumi-la (assinatura digital de fatura). Existe infra de comprovante/assinatura em outras edges (`assinatura-url`, `comprovante-resolve`) que podem ou não ter consumidor neste módulo.
- **Aba "Integrações"** depende de gateways de pagamento configurados (`tenant_payment_gateways`); em tenants sem gateway configurado, fica vazia.
- **Filtros `tipoDespesaFilter` / `destinoPagamentoFilter`** estão presentes no contexto mesmo nas abas que não os usam (Entradas, A Receber, Caixa), porque o filtro vive no header global.

## Tamanho dos arquivos

| Arquivo | Linhas |
|---|---:|
| `Financeiro.tsx` | 924 |
| `FinanceiroService.ts` | 579 |
| `convenioFaturasStore.ts` | 375 |
| `financeiroStore.ts` | 334 |
| `EntradasSaidasTable.tsx` | 271 |
| `AReceberTab.tsx` | 275 |

`Financeiro.tsx` ainda concentra orquestração (estado local + handlers de saída/pay/edit/delete + rendering do header) mesmo após o split em hooks/contexto/tabs. Pode ser observado para refator futuro.

## Funcionalidades que existem em código mas não são primárias

- `imprimirDetalhado` (relatório por filtros) é um botão no header (ícone Printer) ao lado do período rápido — não é um menu nem está documentado em UI. Discoverability baixa.
- "Marcar várias saídas como pagas" via checkbox em massa (`marcarSaidasComoPagas`) — feature útil mas pouco visível, depende de selecionar checkboxes na tabela.
- Drill-down de fatura (`FaturaDetalheDialog`) — só acessível navegando pela aba A Receber → Convênios → Fatura existente.
