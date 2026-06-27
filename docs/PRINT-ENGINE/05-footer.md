# 05 — Rodapé

## Como funciona

- **Fonte**: template HTML em `documento_templates` (tipo `rodape`) via `renderRodapePadrao()`.
- **Inserção**: dentro de `<tfoot><tr><td>` da `<table class="laudo-a4-page">` (linhas 495-503).
- **Repetição**: `table > tfoot { display: table-footer-group !important; }` (linha 153) — o navegador reserva espaço e repete o `tfoot` no **final de cada página** durante a impressão.
- **Margem inferior do `@page`**: `4mm` (constraint travada — `mem://constraints/layout-impressao-travado.md`).

## Bloco de assinatura

Linhas 481-492 do `laudoHtmlBuilder.ts`: bloco "CONFERIDO E LIBERADO POR…" + imagem/carimbo + nome + conselho. Está dentro do `<tbody>` (corpo), **não** no `<tfoot>` — só aparece **uma vez**, ao final do último exame, com `page-break-inside: avoid`. Não é repetido por página.

## Características

| Pergunta | Resposta |
|---|---|
| Como é renderizado? | HTML dentro de `<tfoot>` com CSS `display: table-footer-group`. |
| Como calcula posição? | Não calcula — é o motor do navegador que reserva a faixa inferior. |
| Repetido em todas as páginas? | Sim (mecânica nativa de `tfoot`). |
| Suporta múltiplas páginas? | Sim. |
| Suporta número de páginas (X/Y)? | **Não.** `@page { @bottom-right { content: counter(page) }` não é usado. |
| Suporta assinatura? | Sim, mas no **corpo** (só no último exame), não no rodapé fixo. |

## Riscos

1. **Sem numeração de páginas** — impossível auditar "página 1 de 3" no laudo impresso.
2. Como `tfoot` precisa "caber" no final de cada página, se o template for alto demais ele compete com a área útil — não há limite.
3. A assinatura no `<tbody>` pode, em teoria, ficar isolada em uma página final só com ela (`page-break-inside: avoid` é respeitado mas não força que fique junto do último exame; só `exame-bloco + assinatura-bloco { page-break-before: avoid }` tenta — linha 390).
