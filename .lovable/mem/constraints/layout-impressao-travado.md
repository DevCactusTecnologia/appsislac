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
- **Cabeçalho**: repetido em toda página via `<thead>` da tabela principal, com 16px de gap antes do conteúdo (espaçamento mora no `thead`, não no `tbody`).
- **Rodapé**: bloco `<div class="laudo-a4-rodape-fixed">` com `position: fixed; bottom: 0`. Chrome reaplica em cada página na mesma posição física. Altura reservada via `padding-bottom: 32mm` no `body`. Margem inferior do rodapé travada em 4mm.
- **Marca d'água**: única, via `body::before` com `position: fixed` (ver `src/lib/watermark.ts`). Proibido reativar `.laudo-a4-page::before` no escopo do laudo (duplica a marca).
- **Quebra de página**: blocos de exame usam `page-break-inside: avoid`. Ordem dos exames respeita a ordem do pedido.
- **CSS `@page`**: `size: A4; margin: ...` mantido como está. Não trocar por Paged.js, não reintroduzir Document Engine 3.0.
- **Motor**: `window.print()` em iframe oculto. Document Service / Browserless / PDF backend só com aprovação explícita.

## Antes de mexer
Pedir confirmação literal do usuário citando este arquivo. Pequenas mudanças cosméticas também exigem autorização.
