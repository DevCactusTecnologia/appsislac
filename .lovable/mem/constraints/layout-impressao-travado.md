---
name: Layout de impressão do laudo — CONGELADO
description: Cabeçalho, rodapé fixo, marca d'água, espaçamentos e CSS de impressão do laudo estão travados — só alterar com autorização expressa do usuário
type: constraint
---

# Layout de impressão do laudo — CONGELADO

Estado validado e aprovado pelo usuário. **Não alterar sem pedido explícito.**

## Arquivos congelados
- `src/pages/ResultadoDetalhe/services/laudoHtmlBuilder.ts`
- `src/lib/laudoLayout.ts`
- `src/lib/layoutScientificRuntime.ts`
- `src/lib/printShell.ts`
- `src/lib/watermark.ts`
- Fluxo de impressão em `src/pages/ResultadoDetalhe.tsx` (iframe oculto + `window.print()`)

## Regras travadas
- **Cabeçalho**: ÚNICO, declarado uma só vez via `<thead>` da tabela principal. O navegador replica visualmente em cada página quando há mais de uma. Espaçamento de 16px antes do conteúdo mora no `thead` (não no `tbody`). Proibido duplicar a marcação do cabeçalho por página.
- **Rodapé**: ÚNICO, bloco `<div class="laudo-a4-rodape-fixed">` com `position: fixed; bottom: 0`. O Chrome reaplica visualmente em cada página na mesma posição física. Altura reservada via `padding-bottom: 32mm` no `body`. Margem inferior travada em 4mm. Proibido duplicar marcação ou voltar a renderizar via `<tfoot>` repetido por página.
- **Marca d'água**: ÚNICA, via `body::before` com `position: fixed` (ver `src/lib/watermark.ts`). O navegador replica em cada página. Proibido reativar `.laudo-a4-page::before` no escopo do laudo (duplica a marca).
- **Quebra de página**: blocos de exame usam `page-break-inside: avoid`. Ordem dos exames respeita a ordem do pedido.
- **CSS `@page`**: `size: A4; margin: ...` mantido como está. Não trocar por Paged.js, não reintroduzir Document Engine 3.0.
- **Motor**: `window.print()` em iframe oculto. Document Service / Browserless / PDF backend só com aprovação explícita.

## Antes de mexer
Pedir confirmação literal do usuário citando este arquivo. Pequenas mudanças cosméticas também exigem autorização.
