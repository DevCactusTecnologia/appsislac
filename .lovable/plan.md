
# SISLAC Print Engine 3.0 — Plano de Implementação

Substituir a delegação atual a `window.print()` por um motor determinístico baseado em **Paged.js**, garantindo paginação, cabeçalho/rodapé/marca d'água repetidos e fragmentação consciente de blocos de exame, idênticos em qualquer navegador.

## Escopo travado (constraints)

- `mem://constraints/layout-impressao-travado.md` — margens, rodapé 4mm, assinatura e CSS atual NÃO podem ser alterados arbitrariamente; o novo motor deve **preservar a aparência atual** do laudo e apenas resolver os 10 problemas catalogados em `docs/PRINT-ENGINE/13-problems.md`.
- Apenas o caminho do laudo (`ResultadoDetalhe` → `LaudoPrintPage`) muda. Comprovantes (`comprovantesRender.ts`, `html2pdf.js`), etiquetas e mapa de trabalho ficam intactos.
- Ordem dos exames preservada via `atendimento_exames.ordem` — sem reordenação.

## Arquitetura

```text
ResultadoDetalhe.tsx
  └─ doImprimirLaudo()
      ├─ resolveCustomLayouts()           [inalterado]
      ├─ buildLaudoHtmlPure()             [refator: emite blocos semânticos + classes Paged.js]
      ├─ savePrintContext()               [inalterado]
      └─ window.open('/resultado/:id/print')

LaudoPrintPage.tsx
  ├─ loadPrintContext()
  ├─ <iframe srcDoc={html}>               [HTML agora inclui CSS Paged Media + hooks]
  └─ iframe.onload
      └─ lazy import('pagedjs')           [Previewer dentro do iframe]
          └─ previewer.preview(html, css, container)
              └─ contentWindow.print()    [imprime DOM JÁ paginado]
```

**Paged.js** roda dentro do iframe, transforma o fluxo HTML em N elementos `.pagedjs_page` reais (um por folha A4). A partir daí, `window.print()` apenas materializa esse DOM já paginado — o Chrome deixa de decidir.

## Mudanças por arquivo

### Novos
- `src/domains/print/pagedEngine.ts` — wrapper lazy do Paged.js (`import('pagedjs')`), hooks de medição e numeração.
- `src/domains/print/pagedHooks.ts` — handlers `beforeParsed`/`afterPageLayout` para: (a) marcar `.exame-bloco` como `break-inside: avoid`, (b) registrar páginas para QA, (c) garantir distância constante do topo.
- `src/domains/print/pagedStyles.ts` — CSS Paged Media (`@page`, `@top-center`, `@bottom-right`, `running()`, `counter(page) "/" counter(pages)`).
- `docs/PRINT-ENGINE/16..25-*.md` — 10 relatórios de implementação/validação.

### Modificados
- `src/pages/ResultadoDetalhe/services/laudoHtmlBuilder.ts`
  - Cabeçalho/rodapé/marca d'água saem de `<thead>/<tfoot>/::before` e viram `position: running(header|footer|watermark)` referenciados em `@page`.
  - `<table class="laudo-a4-page">` vira `<main class="laudo-body">` (fluxo natural); Paged.js cuida da fragmentação.
  - Cada exame envelopado em `<section class="exame-bloco" data-exame-id>` com `break-inside: avoid`.
  - Adiciona classe `.exame-fragmentavel` em tabelas longas (permite quebra apenas entre linhas).
- `src/pages/LaudoPrintPage.tsx`
  - Após `iframe.onload`, injeta script que dinamicamente importa Paged.js, executa `Previewer.preview()` e só então chama `print()`.
  - Mostra spinner "Paginando…" enquanto Paged.js processa (típico <500ms para laudos comuns).
- `src/lib/watermark.ts`
  - Marca d'água passa a ser um `<div class="watermark">` referenciado por `position: running(watermark)` no `@page`. CSS `body::before`/`.laudo-a4-page::before` removidos.

### Removidos / depreciados
- `<thead>/<tfoot>` com `display: table-{header,footer}-group` (substituídos por running elements).
- Hacks `print-color-adjust: exact !important` redundantes.
- `printHtmlInHiddenFrame` (caminho legado multi-laudo) permanece, mas também passa por Paged.js — uma única fonte de paginação.
- Código CSS específico do Chrome que perde função (catalogado em relatório 16).

## Dependência

- `pagedjs` (~150KB gzip) — adicionado com `bun add pagedjs`.
- **Lazy load**: import dinâmico dentro do iframe da página de impressão. **Zero impacto no bundle inicial** do SISLAC.

## Resolução dos 10 problemas (P1–P10 de `13-problems.md`)

| # | Problema | Resolução |
|---|---|---|
| P1 | Marca d'água não repete | `running(watermark)` em `@page` |
| P2 | Exame > 1 página quebra silenciosamente | `.exame-fragmentavel` com `break-inside: auto` em tabelas + `break-before: avoid` no título |
| P3 | `pageMargins` do último layout sobrescreve | Agregação por named pages (`@page exame-xyz`) |
| P4 | Sem numeração | `@bottom-right { content: "Página " counter(page) " de " counter(pages) }` |
| P5 | `print-color-adjust` ausente | Aplicado globalmente em `@page` |
| P6 | sessionStorage estoura | HTML emitido sem inlining de imagens grandes (logo continua data URL, mas medido) |
| P7 | Diálogo do navegador | Mitigado: Paged.js renderiza no DOM antes do print — desligar "Gráficos de fundo" não afeta running elements |
| P8 | Sem instrumentação | Hook `afterPageLayout` registra `pageCount` + alertas |
| P9 | Re-parse DOMPurify | Sanitização única antes do Previewer |
| P10 | Fonte forçada | Mantido (trade-off conhecido), documentado |

## Validação (relatório 24)

Cenários obrigatórios, executados via Playwright headless contra preview local:
- 1 / 3 / 10 / 50 exames
- Exame pequeno / médio / maior que página A4
- 3 layouts científicos distintos (hemograma, urina, parasitologia)
- Múltiplas assinaturas
- Marca d'água ligada/desligada
- Cabeçalho 30mm / 60mm

Cada cenário gera PDF via `page.pdf()` headless + screenshot página a página. Snapshots salvos em `e2e/print-engine/__snapshots__/`. Comparação visual confirma:
1. Cabeçalho idêntico em todas as páginas.
2. Rodapé idêntico em todas as páginas.
3. Marca d'água centralizada em todas as páginas.
4. Numeração "X de Y" presente.
5. Distância topo→primeiro-exame constante.
6. Nenhum exame começando nos últimos 30mm quando caberia inteiro na próxima.

## Critérios de aceitação (resposta direta exigida)

Todos serão respondidos no `25-executive-report.md` com evidência (screenshot + arquivo).

## Entregáveis

1. Código implementado e validado.
2. 10 relatórios em `docs/PRINT-ENGINE/16..25-*.md`.
3. Suite Playwright `e2e/print-engine.spec.ts`.
4. Declaração oficial: *"Motor de Impressão do SISLAC consolidado como Print Engine profissional."*

## Riscos conhecidos

- **Paged.js + iframe srcDoc**: precisa importar via `<script type="module">` injetado no documento do iframe (não no shell). Validado no spike conceitual.
- **Compatibilidade com Layouts Científicos (CKEditor)**: tabelas inline do CKEditor podem ter `display: table` rígido — pode exigir CSS adicional `break-inside: auto` direcionado.
- **Tempo de paginação**: 50 exames ~ 800ms. Aceitável (spinner exibido).

Aprove para eu prosseguir com a implementação completa em uma única passada (instalação da dep + refator do builder + page + watermark + testes + 10 relatórios).
