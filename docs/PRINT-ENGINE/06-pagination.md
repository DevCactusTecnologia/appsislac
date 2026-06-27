# 06 — Paginação

## Quem decide quando uma página termina?

**O motor de impressão do navegador (Chrome).** Não há:
- Algoritmo próprio.
- Medição de altura de elementos (`getBoundingClientRect`).
- Biblioteca de paginação (Paged.js, jsPDF autotable).
- Cálculo de "quantos exames cabem por página".

Só existem **hints CSS** entregues ao navegador:

```css
@page { size: A4; margin: 4mm 11mm 4mm 11mm; }
.exame-bloco { page-break-inside: avoid; break-inside: avoid; }
.assinatura-bloco { page-break-inside: avoid; break-inside: avoid; }
.exame-bloco + .assinatura-bloco { page-break-before: avoid; break-before: avoid; }
```

O navegador percorre o fluxo do `<tbody>` e decide quebrar quando encontra:
- altura útil esgotada;
- um `break-inside: avoid` que não cabe → empurra para a próxima página.

## Apenas overflow automático?

**Sim, na prática.** O SISLAC não mede, não pré-calcula, não particiona. Entrega o HTML inteiro e confia no `print engine` do Chromium para fragmentar.

## Consequências

| Cenário | Comportamento esperado |
|---|---|
| Exame pequeno (cabe inteiro) | OK, vai junto |
| Exame grande (>1 página) | `page-break-inside: avoid` é ignorado pelo Chrome quando o bloco é maior que uma página → quebra "onde der" |
| Cabeçalho alto | Sobra menos área útil em todas as páginas |
| Sequência de exames pequenos | Chrome empacota o máximo possível por página |
| Sem números de página | Não há `counter(page)` no `@page` |

## Risco crítico

A combinação `<table>` com `thead`/`tfoot` que se repetem por página é o **único** mecanismo que garante cabeçalho/rodapé em todas as folhas. Se algum exame for movido para fora dessa `<table>` (ex.: refator futuro), a repetição quebra silenciosamente.
