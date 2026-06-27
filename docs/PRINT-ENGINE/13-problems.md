# 13 — Problemas Identificados

> Ordem: gravidade ↓. Sem correções aplicadas (constraint @layout-impressao-travado).

## P1 — Marca d'água não se repete por página em laudos multipágina

- **Onde**: `src/lib/watermark.ts` + `.laudo-a4-page::before` em `laudoHtmlBuilder.ts:397`.
- **Causa raiz**: existe **uma única** `<table class="laudo-a4-page">` que se fragmenta em N páginas. O `::before` é pintado uma vez sobre o bounding box da tabela inteira, não por página.
- **Impacto**: marca d'água aparece parcial/ausente em laudos com 2+ páginas.
- **Visível para o cliente final**: sim.

## P2 — Exame maior que uma página quebra silenciosamente

- **Onde**: `.exame-bloco { page-break-inside: avoid }` (linha 373).
- **Causa raiz**: CSS fragmentation ignora `avoid` quando o bloco excede a altura útil.
- **Impacto**: layouts científicos longos (ex.: hemograma extenso, parasitologia com tabelas grandes) podem quebrar no meio de uma tabela.
- **Visível**: depende do exame.

## P3 — `pageMargins` do último layout sobrescreve todos

- **Onde**: `ResultadoDetalhe.tsx:989-993`.
- **Causa raiz**: loop atribui `pageMargins = entry.margins` sem agregação.
- **Impacto**: se exames têm margens diferentes, prevalece o do último — pode cortar conteúdo dos demais.

## P4 — Sem numeração de páginas

- **Onde**: `@page` em `laudoHtmlBuilder.ts:143` não usa `@bottom-right { content: counter(page) "/" counter(pages); }`.
- **Causa raiz**: feature nunca implementada.
- **Impacto**: impossível auditar integridade do laudo impresso ("é a página 1 de quantas?").

## P5 — `print-color-adjust: exact` ausente quando marca d'água desligada

- **Onde**: `buildWatermarkCss` retorna `""` se desabilitada; `@page` não define globalmente.
- **Causa raiz**: regra de cor só entra junto com a marca d'água.
- **Impacto**: cores de células / bordas / fundos `#f0f0f8` podem aparecer brancas em alguns navegadores.

## P6 — `sessionStorage` pode estourar com laudos grandes

- **Onde**: `savePrintContext` em `printContext.ts`.
- **Causa raiz**: HTML inteiro (com `data:image` base64 do cabeçalho/logo) gravado num único `setItem`.
- **Impacto**: falha silenciosa (catch vazio) — a aba dedicada abre vazia.

## P7 — Comportamento depende do diálogo do navegador

- **Onde**: motor de impressão = Chrome.
- **Causa raiz**: nenhum controle programático.
- **Impacto**: usuário pode desligar "Gráficos de fundo" (some marca d'água) ou mudar margens (quebra layout).

## P8 — Sem instrumentação de qualidade

- **Onde**: nenhum lugar.
- **Causa raiz**: impossível saber, em runtime, quantas páginas o laudo gerou nem se algum bloco quebrou.
- **Impacto**: regressões visuais só são detectadas pelo cliente.

## P9 — Re-parsing duplo do DOMPurify

- **Onde**: `sanitizeHtmlForPrint` no caminho `useNewTab` + parse do `<iframe srcDoc>`.
- **Impacto**: latência adicional em laudos grandes.

## P10 — Fonte forçada com `!important`

- **Onde**: linhas 171-175 e 192-194 do builder.
- **Impacto**: templates não conseguem usar fontes personalizadas no cabeçalho/rodapé. Trade-off conhecido para estabilidade.
