# Relatório de Complexidade — Financeiro

> Apenas observação. Nada aqui é prescrição de mudança.

## Duplicações / Caminhos paralelos

1. **A Receber tem 2 implementações vivas**:
   - RPC `a_receber_pacientes_page` (paginado, banco) — `useAReceberPacientes`.
   - `buildAReceberRowsFromAtendimentos` (client, sobre cache) — `FinanceiroService.ts`.
   - Seleção controlada por `useFeatureFlag('paginated_atendimentos')`. Ambas devem retornar números equivalentes; divergência depende de manter as fórmulas em sincronia.
2. **Tabelas legadas**: `financeiro_tipos_despesa`, `financeiro_destinos_pagamento`, `financeiro_formas_pagamento` existem no schema com RLS, mas o código lê/escreve em `select_options`. Risco: alguém usar a tabela errada (são hoje "tabelas mortas para o app, vivas para o DB").
3. **`buildSaidaFromRow` (deprecated) vs. `buildSaidaFromRowDecoded`** em `financeiroStore.ts`: ambas no arquivo; só a segunda é usada em runtime.
4. **`saidaToEntry` (em helpers) + manipulação direta de `FinanceiroSaida`**: existem dois "shapes" para a mesma despesa (storage shape com `dd/mm/yyyy` strings + entry shape genérico).

## Regras codificadas em strings (frágeis)

- Forma de pagamento de saída em sufixo `[pgto:X]` na descrição (`encodePagamento`/`decodePagamento`).
- Cliente da saída extraído por split em `" — "`.
- Datas no shape de UI são `dd/mm/yyyy` (string), convertidas múltiplas vezes (`ddmmyyyyToISO`, `parseDate`, `formatDateOnlyBR`, `formatDateBR`).

## Cálculos repetidos em locais diferentes

- Soma de pagamentos do paciente: feita em `FinanceiroService.buildAReceberRowsFromAtendimentos`, no trigger `trg_recompute_on_pagamento_change` (banco), e no `Index.handlePagamentoConfirm` (UI).
- Distribuição de desconto: `Index.tsx` (paciente) e `FecharFaturaDialog`/`convenioFaturasStore` (fatura).
- Saldo do caixa: somente client (não há SSOT em DB).

## Funcionalidades pouco utilizadas / mortas

- `buildSaidaFromRow` (legado) — não chamado.
- Tabelas RLS legadas de dicionários financeiros — não tocadas pelo código atual.
- `IntegracoesWebhookPanel` aparece como aba do Financeiro condicional a permissão; é financeiramente irrelevante hoje (gerencia integrações de laudo, não recebimentos).

## Pontos onde a tela mistura responsabilidades

- `Financeiro.tsx` (924 linhas) ainda concentra lazy loading de dialogs, decisões de contexto e roteamento entre abas, apesar do split parcial.
- "Caixa" e "Entradas" compartilham a mesma fonte (`financeiro_entradas`) mas com apresentações divergentes.

## Fluxos sem contraparte explícita

- Cancelamento de atendimento já com pagamento: o pagamento permanece em `atendimento_pagamentos`, mas o atendimento sai do A Receber. O efeito em "receita realizada" é silencioso (continua como entrada).
- Fatura `cancelada` após `paga`: bloqueado por trigger; reverter requer intervenção fora-do-app.
- Pagamento por meio múltiplo numa mesma fatura: não suportado (`forma_pagamento` é string única).
