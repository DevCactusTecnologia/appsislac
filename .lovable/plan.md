
# Fatiamento de `Financeiro.tsx` por abas

## Objetivo
Reduzir `src/pages/Financeiro.tsx` (1.899 linhas) para um orquestrador (~300-400 linhas) que carrega 4 sub-componentes de aba, compartilhando estado/filtros via um contexto interno do módulo. Comportamento e UI **idênticos**.

## Estrutura alvo

```text
src/pages/Financeiro/
  page.tsx                       (novo orquestrador, substitui Financeiro.tsx)
  FinanceiroContext.tsx          (novo — estado e filtros compartilhados)
  components/
    CaixaTab.tsx                 (já existe)
    EntradasTab.tsx              (novo)
    SaidasTab.tsx                (novo)
    AReceberTab.tsx              (novo)
    FinanceiroHeader.tsx         (novo — PageHeader + tabs + busca + filtros de período)
    SummaryBar.tsx               (novo — cards de totais por forma de pagamento)
    dialogs/
      EditEntryDialog.tsx        (novo)
      DeleteEntryDialog.tsx      (novo)
      DetailEntryDialog.tsx      (novo)
      PagarDespesaDialog.tsx     (novo)
```

`src/pages/Financeiro.tsx` vira um re-export de `./Financeiro/page` (mantém rota `/financeiro` sem mexer em `App.tsx` — **não é mudança estrutural de rota**).

## Contexto compartilhado (`FinanceiroContext.tsx`)

Expõe um único provider com:

- **Filtros globais**: `searchQuery`, `dateFrom`, `dateTo`, `periodoRapido`, `convenioFilter`, `saidaStatusFilter`, `currentPage` + setters.
- **Dados derivados**: `entradas`, `saidas`, `aReceberRows`, `aReceberConvenioRows`, `allEntries`, `filtered`, `summary`, `caixa*`, `counts` (já calculados via os services existentes).
- **Ações**: `openNovaEntradaSaida(tipo)`, `openEdit(entry)`, `openDelete(protocolo)`, `openDetail(entry)`, `openPagar(saida)`.
- **Dicionários**: `tiposDespesa`, `destinosPagamento`, `formasPagamento` (já vindos de `useDicionario`).

Cada aba consome via `useFinanceiro()` — zero props drilling.

## Distribuição de responsabilidades

| Componente | Conteúdo movido de Financeiro.tsx |
|---|---|
| `FinanceiroHeader` | tabs, busca, calendário from/to, chips de período rápido |
| `EntradasTab` | tabela/lista de `filtered` quando `activeTab="entrada"` + paginação |
| `SaidasTab` | tabela/lista de saídas + filtro de status + ações pagar/editar/excluir |
| `AReceberTab` | sub-abas pacientes/convênios + diálogos `FecharFatura`/`FaturaDetalhe` |
| `CaixaTab` | já existe — passa a consumir contexto |
| `SummaryBar` | cards de `summary.byMethod` + total |
| dialogs/ | 4 diálogos extraídos (cada um ~50-100 linhas) |

## Detalhes técnicos

1. **Não criar barrel** (`index.ts`) — regra do `module-structure-standard.md`.
2. **Manter lazy imports** dos diálogos existentes (`CriarItemDialog`, `FecharFaturaDialog`, `FaturaDetalheDialog`, `NovaEntradaSaidaDialog`).
3. **Realtime/effects** (`subscribeAtendimentos`, `subscribeFinanceiro`, `fetchEntradasView`) ficam no provider — só executa uma vez.
4. **`useEnsureStore`, `useAuth`, `useFeatureFlag`, `useAReceberPacientes`** permanecem no `page.tsx` orquestrador e descem via contexto.
5. **CSS/JSX preservados literalmente** — só recortar.
6. **Sem alteração de comportamento**: handlers continuam chamando os mesmos services puros (`validateSaidaEdit`, `validatePayment`, `computeDetailExames`, etc.).
7. **Verificação**: tsc + abrir cada aba no preview para conferir paridade visual.

## Plano de execução (sequencial, 1 PR mental)

1. Criar `FinanceiroContext.tsx` movendo states/effects/useMemos.
2. Extrair `FinanceiroHeader.tsx` e `SummaryBar.tsx`.
3. Extrair `EntradasTab.tsx` (mais simples — primeiro teste de paridade).
4. Extrair `SaidasTab.tsx` + `dialogs/EditEntryDialog`, `DeleteEntryDialog`, `DetailEntryDialog`, `PagarDespesaDialog`.
5. Extrair `AReceberTab.tsx`.
6. Reescrever `Financeiro.tsx` → `page.tsx` orquestrador com `<FinanceiroProvider>` + switch de aba.
7. Compilar, abrir preview, conferir as 4 abas.

## Resultado esperado

- `page.tsx`: ~300 linhas (header + provider + switch).
- Cada `*Tab.tsx`: 200-400 linhas focadas.
- Cada `dialogs/*.tsx`: 50-120 linhas.
- Zero props drilling além de 1 nível (Tab → Dialog quando dialog é local da aba).

## Riscos / mitigação

- **Risco**: quebrar ordem de hooks ao mover effects. **Mitigação**: copiar effects em bloco para o provider preservando ordem.
- **Risco**: ciclos de import. **Mitigação**: contexto importa dos services; tabs importam contexto + ui; dialogs importam contexto.
- **Risco**: regressão silenciosa em filtros. **Mitigação**: services puros já cobrem a lógica — recorte é mecânico.

## Fora de escopo

- Não mexer em `financeiroStore.ts` nem em services já criados.
- Não alterar rotas em `App.tsx`.
- Não tocar em RLS, edge functions, ou layout impresso (laudo travado).
