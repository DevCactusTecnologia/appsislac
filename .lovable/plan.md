## Objetivo

Na página `/impressao-geral`, ao clicar em **Imprimir resultados** dentro do card de resumo, baixar um único arquivo `.pdf` contendo o laudo de cada atendimento com exames liberados/impressos da unidade + data filtradas, ordenado por número do atendimento (ATD-YYYY-XXXXXXX).

## Escopo confirmado

- Filtro: unidade + data exibidas no resumo.
- Inclusão: atendimentos que tenham ≥ 1 exame com `status ∈ {Liberado, Impresso, Digitado}` (resultado pronto, mesmo que o atendimento ainda não esteja marcado como Finalizado).
- Ordenação: pelo número/protocolo do atendimento, crescente.
- Entrega: download forçado de `.pdf` (sem abrir diálogo de impressão).

## Observação importante (fidelidade do layout)

O laudo impresso atual é **vetorial nativo** (HTML+CSS via `printHtmlInHiddenFrame` → diálogo do navegador), com layout congelado por constraint (`mem://constraints/layout-impressao-travado.md`).

Forçar download `.pdf` direto exige rasterizar via `html2canvas` + `jsPDF`. Isso muda o motor de impressão — fontes e quebras de página podem sofrer pequenas variações vs. o laudo individual. Não vou alterar o CSS travado do laudo individual; o lote terá o mesmo HTML, apenas renderizado por outro caminho.

Se preferir preservar 100% da fidelidade vetorial, a alternativa é abrir o diálogo do navegador (usuário clica "Salvar como PDF"). Sigo com download direto conforme escolhido, mas registro o trade-off.

## Implementação

### 1. Dependência
- `bun add jspdf html2canvas`

### 2. Novo módulo `src/lib/laudoBatchPdf.ts`
Função `gerarLaudoLotePdf({ atendimentos, filename })`:
- Para cada atendimento (já ordenado), reaproveita as primitivas existentes:
  - `resolveCustomLayouts(printable)` (mover de `ResultadoDetalhe.tsx` para `src/pages/ResultadoDetalhe/services/resolveCustomLayouts.ts` se ainda inline).
  - `fetchHistoricoPorExame(...)`.
  - `buildLaudoHtml({ paciente, analistaAtual, assinaturaLaudo, getResolvedRef, printable, customByExame, margins, historicoByExameId })`.
- `getResolvedRef`: usa `valoresReferenciaStore` + `resolveReferenciaPorPaciente` (já existe).
- `analistaAtual` / `assinaturaLaudo`: do último analista que liberou cada exame (do `exame.auditoria`).
- Concatena os HTMLs com `<div style="break-after:page;page-break-after:always"></div>` entre atendimentos.

### 3. Render + conversão
- Cria iframe oculto com o HTML batch, espera `fonts.ready` + 2 RAFs.
- Para cada `.laudo-a4-page` (ou `.laudo-page-manual` gerada pelo hook de paginação), chama `html2canvas` (scale 2, backgroundColor `#fff`).
- Adiciona a imagem em página A4 do `jsPDF` (`unit: 'mm', format: 'a4'`).
- `pdf.save(filename)` → download direto. Filename: `Resultados_<Unidade>_<YYYY-MM-DD>.pdf`.

### 4. Filtro dos atendimentos (no `ImpressaoGeral.tsx`)
- Reaproveita o filtro `atendimentosForDate` já calculado no `legacySummary`.
- Aplica `exames.some(e => ['Liberado','Impresso','Digitado'].includes(e.status))` e ordena por `protocolo` asc.
- Caminho server (`useServer`): busca via `getAtendimentos()` mesmo assim para hidratar paciente/exames; se faltar dado local, fallback de loading.

### 5. Ligação do botão
- Em `src/pages/ImpressaoGeral.tsx`, transformar o botão **Imprimir resultados** em handler `onClick={handleImprimirLote}`:
  - estado `gerando: boolean` desabilita botão e troca ícone por spinner.
  - try/catch com toast de erro.
  - se zero atendimentos elegíveis: toast `"Nenhum resultado pronto para impressão"`.

### 6. Telemetria
- `logger.info("ImpressaoGeral", "lote gerado", { unidade, data, totalAtendimentos, totalExames, ms })`.

## Arquivos afetados

```text
src/pages/ImpressaoGeral.tsx        (handler + estado de loading)
src/lib/laudoBatchPdf.ts            (novo — orquestrador batch)
src/pages/ResultadoDetalhe/services/
  resolveCustomLayouts.ts           (extrair de ResultadoDetalhe.tsx se necessário)
package.json                        (jspdf, html2canvas)
```

Nenhuma alteração em `laudoHtmlBuilder.ts`, CSS de impressão ou `ResultadoDetalhe.tsx` (além de exportar helper se preciso).

## Riscos / fora de escopo

- Rasterização pode aumentar tamanho do PDF (≈300–600 KB por página A4 a scale 2).
- Sem marcação `Impresso` automática em lote para evitar efeitos colaterais — o status só muda pelo fluxo individual atual. Posso adicionar opcionalmente depois.
- Sem auditoria por exame de "impressão em lote" nesta primeira entrega.
