# Sprint 2 — Split dos monolitos (ResultadoDetalhe + NovoAtendimento)

## Princípios inegociáveis

1. **Zero mudança de comportamento**: rotas (`/resultados/:id`, `/atendimentos/novo`, `/atendimentos/:id/editar`), props públicas, ordem de hooks, queries, mutations, RPCs, subscriptions Realtime, atalhos de teclado, layout de impressão e CSS de laudo permanecem idênticos.
2. **Layout de impressão do laudo é congelado por memória** (`constraints/layout-impressao-travado.md`). Nenhum ajuste de margens, rodapé (4mm), assinatura ou CSS de impressão neste sprint.
3. **Refatoração mecânica, não conceitual**. Só extraímos o que é seguro extrair; não reescrevemos lógica.
4. **Cada extração compila e roda antes da próxima**. Passos pequenos, sempre buildáveis.
5. **Sem alterar a ordem dos hooks** dentro do componente principal — o React exige isso.

## O que NÃO faremos neste sprint

- Não trocaremos stores por Context/Redux/Zustand.
- Não introduziremos novas libs.
- Não moveremos regra de negócio já testada (`formula.ts`, `pricing.ts`, `buildExamesCobranca.ts`).
- Não mexeremos em `laudoHtmlBuilder.ts`, `historicoResultados.ts`, `laudoBatchPdf.ts`, `pagedjsRuntime`.
- Não tocaremos em `PagamentoDialog`, `ParametrosDialog`, `VariacaoMatrizDialog` (já são componentes separados).

---

## Parte A — ResultadoDetalhe.tsx (3.129 → alvo ≤ 900 LOC)

Estrutura já existente em `src/pages/ResultadoDetalhe/`: `formula.ts`, `helpers.ts`, `services/`, `statusHelpers.ts`, `types.ts`, `ParamTypedInput.tsx`, `LayoutScientificFormRenderer.tsx`.

### Extrações previstas (nesta ordem)

1. **`ResultadoDetalhe/hooks/useResultadoData.ts`** — carrega paciente, atendimento, exames, layouts, parâmetros críticos, mapa de análise, histórico. Encapsula `reloadExames` + hidratação inicial.
2. **`ResultadoDetalhe/hooks/useResultadoRealtime.ts`** — canal Supabase para `atendimento_exames`, invalidação e refetch controlado.
3. **`ResultadoDetalhe/hooks/useAuditoriaDupla.ts`** — estado de analista/liberador, validação de senha, popups de "salvo/liberado".
4. **`ResultadoDetalhe/hooks/useResultadoImpressao.ts`** — estado `printDialog`, resolução de layouts custom, chamada ao builder. Sem tocar no builder.
5. **`ResultadoDetalhe/components/ResultadoHeader.tsx`** — cabeçalho (paciente, prioridade, jejum, contadores).
6. **`ResultadoDetalhe/components/ExameSidebar.tsx`** — lista lateral com busca/filtros/contadores.
7. **`ResultadoDetalhe/components/ExamePanel.tsx`** — painel central de digitação (envolve `ParamTypedInput` + `LayoutScientificFormRenderer` já existentes).
8. **`ResultadoDetalhe/components/ResultadoActions.tsx`** — barra de ações (salvar, liberar, retificar, cancelar, recoleta, imprimir).
9. **`ResultadoDetalhe/components/dialogs/`** — extrair 8 diálogos internos (retificar, cancelar, importar, confirmar liberar, recoleta, crítico, entrega, alterar analista). Um arquivo por diálogo.

### Resultado esperado
```text
ResultadoDetalhe.tsx (~700-900 LOC)
└── orquestra hooks + compõe <Header/> <Sidebar/> <Panel/> <Actions/> <Dialogs/>
```

---

## Parte B — NovoAtendimento.tsx (2.829 → alvo ≤ 800 LOC)

Estrutura já existente: `DropdownStatus.tsx`, `buildExamesCobranca.ts`, `helpers.ts`, `highlightMatch.tsx`, `pricing.ts`, `services/`, `types.ts`.

### Extrações previstas

1. **`NovoAtendimento/hooks/useAtendimentoForm.ts`** — estado do wizard/formulário, hidratação em modo edição.
2. **`NovoAtendimento/hooks/useExamesSelecionados.ts`** — add/remove/edit de exames, cálculo de preço via `pricing.ts`.
3. **`NovoAtendimento/hooks/useAtendimentoSubmit.ts`** — chamada à edge `create-atendimento` / `update-atendimento`, tratamento de erro, navegação.
4. **`NovoAtendimento/hooks/usePagamentoInline.ts`** — integra `PagamentoDialog` + PIX BRCode + confirmação.
5. **`NovoAtendimento/components/PacienteSection.tsx`** — busca/seleção/criação inline de paciente.
6. **`NovoAtendimento/components/ConvenioSection.tsx`** — convênio + tabela + validade de carteirinha.
7. **`NovoAtendimento/components/ExamesSection.tsx`** — grid de exames com filtros por convênio.
8. **`NovoAtendimento/components/ResumoFinanceiro.tsx`** — totalizadores, descontos, cobrança destino.
9. **`NovoAtendimento/components/AcoesAtendimento.tsx`** — botões finalizar / salvar rascunho / cancelar / imprimir orçamento.

### Resultado esperado
```text
NovoAtendimento.tsx (~600-800 LOC)
└── orquestra hooks + compõe <Paciente/> <Convenio/> <Exames/> <Resumo/> <Acoes/> + <PagamentoDialog/>
```

---

## Roteiro de execução (em ondas, cada onda buildável)

| Onda | Escopo | Verificação |
|---|---|---|
| 1 | Extrair hooks de dados de `ResultadoDetalhe` (A1, A2) | `tsgo` limpo, abrir `/resultados/:id` no preview via Playwright |
| 2 | Extrair componentes visuais de `ResultadoDetalhe` (A5–A8) | idem |
| 3 | Extrair diálogos de `ResultadoDetalhe` (A9) | idem + testar 1 diálogo (retificar) |
| 4 | Extrair hooks de `NovoAtendimento` (B1–B4) | `tsgo` limpo, abrir `/atendimentos/novo` |
| 5 | Extrair seções de `NovoAtendimento` (B5–B9) | idem + testar edição de atendimento existente |

**Regra de parada dentro do sprint**: se uma onda quebrar comportamento, revertê-la antes de continuar. Nenhuma onda é iniciada se a anterior não estiver verde.

---

## Detalhes técnicos

- **Path**: novos arquivos em `src/pages/ResultadoDetalhe/{hooks,components,components/dialogs}` e `src/pages/NovoAtendimento/{hooks,components}`.
- **Imports**: arquivo principal continua exportando `default` na mesma rota — nada muda em `App.tsx`.
- **Ordem dos hooks**: os novos hooks (`useResultadoData` etc.) são chamados na mesma ordem que o código original, sem reordenar.
- **Estado compartilhado entre subcomponentes**: passado via props explícitas (não Context) para manter simplicidade e rastreabilidade. Sem "prop drilling" além de 1 nível (o componente pai orquestra).
- **Tipos**: reaproveitar `types.ts` já existente; adicionar tipos novos apenas quando necessário.
- **Nada de `as any` novo**. Se aparecer um tipo difícil, isolar num TODO comentado — sem introduzir dívida.
- **Verificação por onda**: build TypeScript + smoke via Playwright headless nas rotas afetadas (screenshot + console errors).

## Fora de escopo (Sprint 3+)

- Tipar `queryPatterns.ts` e `comprovantesRender.ts`.
- Regra ESLint `max-lines: 500`.
- Split de `SorotecaEstrutura`, `Soroteca`, `RegistrarColeta`, `SuperAdminTenantDetalhe`, `Index`.
