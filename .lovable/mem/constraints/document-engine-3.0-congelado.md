---
name: Document Engine 3.0 — Core congelado
description: Motor oficial de documentos do SISLAC. Paged.js totalmente isolado em adapter; nenhum arquivo fora de adapters/PagedRenderer.ts pode importar a lib.
type: constraint
---

# Document Engine 3.0 — Congelado

A partir desta data o motor de documentos do SISLAC está oficialmente
congelado. Toda evolução ocorre apenas por novos templates/layouts.

## Regras

- ❌ Não criar novas camadas arquiteturais paralelas.
- ❌ Não criar motores alternativos de impressão para laudos.
- ❌ Não importar `pagedjs` fora de
  `src/domains/print/document-engine/adapters/PagedRenderer.ts`.
- ❌ Não introduzir CSS específico de navegador (hacks Chrome/WebKit).
- ✅ Consumir SEMPRE via `renderDocument(...)` de
  `@/domains/print/document-engine`.
- ✅ Trocar a engine de renderização = trocar a instância em
  `DocumentRenderer.ts#getActiveAdapter`. Nenhum outro arquivo muda.

## Estrutura oficial

```
src/domains/print/document-engine/
  types.ts
  LayoutEngine.ts
  PaginationEngine.ts
  DocumentComposer.ts
  adapters/
    RenderAdapter.ts
    PagedRenderer.ts        ← ÚNICO arquivo que conhece Paged.js
    DocumentRenderer.ts
  index.ts
```

Documentação completa em `docs/DOCUMENT-ENGINE/`.
