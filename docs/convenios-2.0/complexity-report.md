# Convênios 2.0 — Complexidade e Legado

> Apenas inventário. Nada será removido.

## Código potencialmente morto / órfão

| Item | Status | Onde |
|---|---|---|
| `fetchSaldoEmAbertoPorConvenio` (em `convenioFaturasStore.ts`) | Exportado, sem callers ativos após Fase 7 (substituído por `useAReceberConvenios`). Permanece como fallback. | `src/data/convenioFaturasStore.ts:223-275` |
| Tabelas `financeiro_tipos_despesa`, `financeiro_destinos_pagamento`, `financeiro_formas_pagamento` | Sem referências no código atual; mantidas com RLS por compatibilidade histórica. | banco |
| Página `/convenios` (`src/pages/Convenios.tsx`) | Wrapper de 19 linhas que apenas renderiza o `ConveniosTab` de Configurações. Duplica navegação. | `src/pages/Convenios.tsx` |
| `ConvenioExamesPanel` (539 linhas) | Funcional, mas concentra muita lógica (cobertura, busca, edição inline). Candidato a split. | `src/components/configuracoes/ConvenioExamesPanel.tsx` |

## Stores / RPCs / Queries paralelas

1. **Saldo em aberto por convênio**:
   - SSOT: `financeiro_a_receber_v2(p_tipo='convenio')` (RPC).
   - Legado: `fetchSaldoEmAbertoPorConvenio` (Map em memória).
   - **Mesma intenção, dois caminhos.**
2. **Itens faturáveis vs A Receber**:
   - `fetchItensFaturaveis` (front): exige `status='finalizado'` e período do atendimento.
   - `financeiro_a_receber_v2`: não exige `finalizado`, sem período.
   - **Critérios de elegibilidade divergentes.**

## Cálculos paralelos

- `criarFatura` recalcula `subtotal/total` no front. Banco não tem trigger de validação.
- `computePainelKpis.ts` historicamente somava arrays para o KPI; agora usa `aReceberTotais.qtdConvenios`. O cálculo antigo foi neutralizado mas o tipo `conveniosPendentes` continua exposto.

## Relatórios paralelos

- Não existem relatórios concorrentes — o domínio nunca teve relatórios formais.

## Tabelas sem uso (não remover)

- Triplete legado financeiro citado acima.
- Não foram detectadas tabelas órfãs em `convenios*`.

## Fluxos abandonados

- Coluna `assinatura_protocolo` em `convenio_faturas`: gerada e gravada por trigger, mas a UI não tem botão "verificar autenticidade da fatura". A função `validate_protocolo_fatura` existe e nunca é chamada pelo cliente.
- `prazo_faturamento_dias` e `dias_retorno` em `convenios`: persistidos mas nunca consumidos para alertas/previsão.
- Status `cancelada`: existe, mas após cancelar a fatura desaparece do fluxo (não é exibida proeminentemente nem auditada).

## Componentes grandes (atenção)

| Arquivo | Linhas | Comentário |
|---|---|---|
| `ConveniosTab.tsx` (Configurações) | 571 | CRUD + cobertura juntas. |
| `ConvenioExamesPanel.tsx` | 539 | Cobertura por convênio. |
| `FecharFaturaDialog.tsx` | 313 | Wizard implícito (criar → marcar paga). Fluxo bipolar mascarado em um só dialog. |
| `ConveniosTab.tsx` (Financeiro) | 280 | OK; bem segregado. |

## Resumo

- 1 store legada exportada sem uso direto.
- 1 página redundante.
- 3 tabelas legadas no banco.
- 2 colunas órfãs (`prazo_faturamento_dias`, `dias_retorno`).
- 1 trigger de assinatura sem verificador na UI.
- 2 critérios de elegibilidade divergentes.
- 0 estorno / glosa / reapresentação formal.
