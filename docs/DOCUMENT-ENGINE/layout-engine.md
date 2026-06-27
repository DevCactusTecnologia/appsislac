# LayoutEngine

Responsabilidade única: resolver a geometria da página A4.

## API

```ts
import { resolveGeometry, usefulWidthMm, usefulHeightMm } from "@/domains/print/document-engine";

const g = resolveGeometry({ top: 4, right: 11, bottom: 4, left: 11 });
// → { marginTopMm: 4, marginRightMm: 11, marginBottomMm: 4, marginLeftMm: 11 }

usefulWidthMm(g);  // 188mm
usefulHeightMm(g); // 289mm
```

## Constraint

As margens padrão 4/11/4/11mm estão travadas
(`mem://constraints/layout-impressao-travado.md`). O LayoutEngine apenas
valida — não pode alterar arbitrariamente.

## Área útil

Cabeçalho, rodapé e marca d'água **NÃO** disputam espaço com a área útil:

- Cabeçalho fica em `<thead>` — ocupa o topo de cada página.
- Rodapé fica em `<tfoot>` — ocupa a base de cada página.
- Marca d'água é injetada como overlay `position: absolute; inset: 0` no
  `pagedjs_pagebox` — não consome espaço de fluxo.

O corpo (`<tbody>`) recebe a altura restante e o PaginationEngine fragmenta
exames conforme cabem.
