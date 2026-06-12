# FASE 2 — Component Boundaries

Mapeamento dos blocos visuais independentes dentro de cada hotspot. Cada bloco
é candidato natural a um componente puro de apresentação (consome props/contexto;
não introduz nova regra de negócio).

## ResultadoDetalhe.tsx

```
ResultadoDetalhe/
  index.tsx                    # orquestrador (state owners, hooks de domínio)
  components/
    LaudoHeader.tsx            # identificação do paciente + protocolo + datas
    LaudoActionsBar.tsx        # botões: salvar, liberar, retificar, imprimir, WhatsApp
    ExamesSidebar.tsx          # lista de exames do atendimento + status badges
    ParametrosPanel.tsx        # grid de parâmetros (ParamTypedInput por linha)
    ReferenciasPanel.tsx       # bandas de referência resolvidas (sexo/idade)
    AssinaturaBlock.tsx        # bloco de assinatura digital (read-only)
    AnexosPanel.tsx            # imagens/PDFs anexos
    HistoricoRetificacoes.tsx  # timeline de retificações
    AuditTrailPanel.tsx        # eventos auditados
    PrintLayoutFrame.tsx       # CONGELADO — só wrapper; layout interno intocado
    dialogs/
      LiberarTodosDialog.tsx
      RetificarDialog.tsx
      CancelarLiberacaoDialog.tsx
      AnexarArquivoDialog.tsx
```

> Restrição: `PrintLayoutFrame` apenas isola o markup. O CSS de impressão,
> margens, rodapé e assinatura permanecem **literalmente** como hoje.

## NovoAtendimento.tsx

```
NovoAtendimento/
  index.tsx                          # wizard owner + persistência
  components/
    WizardStepper.tsx                # barra superior de progresso
    steps/
      PacienteStep.tsx               # busca/cadastro + dados do paciente
      ExamesStep.tsx                 # seleção de exames + filtros por convênio
      ConvenioStep.tsx               # convênios aplicáveis + cobrança híbrida
      PagamentoStep.tsx              # forma, parcelas, descontos
      ResumoStep.tsx                 # confirmação + impressão de etiquetas
    PacienteAutocomplete.tsx
    ExameRow.tsx                     # linha da tabela de exames (preço/origem)
    CobrancaBadge.tsx                # paciente vs convênio
    DescontoControls.tsx
    EtiquetasPreview.tsx
    dialogs/
      NovoPacienteDialog.tsx
      AlertaDebitosDialog.tsx
      RecoletaDialog.tsx
```

## Financeiro.tsx

Já em conformidade arquitetural. Boundary atual:

```
src/pages/Financeiro.tsx               # orquestrador (924 linhas)
src/pages/Financeiro/
  FinanceiroContext.tsx                # SSOT da página
  hooks/
    useFinanceiroDialogs.ts
    useFinanceiroFilters.ts
  components/
    EntradasTab.tsx
    SaidasTab.tsx
    AReceberTab.tsx
    CaixaTab.tsx
    EntradasSaidasTable.tsx
```

Componentes ainda **não** extraídos, mas com fronteira clara dentro do orquestrador:

- `FinanceiroHeader` — título + ações (Nova entrada/saída, exportar)
- `KpisStrip` — tira superior com totais consolidados
- `PeriodoFiltro` — date range + atalhos (hoje/7d/mês/ano)
- `FaturaDetalheDialog` (já é componente próprio)
- `FecharFaturaDialog` (já é componente próprio)

## Critério para extração

1. Componente possui fronteira visual evidente (caixa, painel, dialog).
2. Não introduz nova regra de negócio (só recebe props/contexto).
3. Não quebra a constraint de layout de impressão.
4. Mantém os mesmos `data-testid`, classes e ordem do DOM.
