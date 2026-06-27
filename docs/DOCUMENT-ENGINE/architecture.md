# Document Engine 3.0 — Arquitetura

## Princípio

O Document Engine é a camada que **o SISLAC controla**. Ele decide como o
documento é composto e paginado. O navegador apenas materializa o DOM já
paginado em folhas físicas.

A biblioteca **Paged.js** é a tecnologia escolhida para a fase de
renderização — mas é detalhe de implementação. Trocá-la não impacta os
demais módulos.

## Camadas

```text
ResultadoDetalhe
   │  buildLaudoHtml(args)
   ▼
DocumentEngine (façade)
   │  compose(semanticDoc) → composedDoc
   ▼
LayoutEngine        — geometria A4 (margens 4/11/4/11 travadas)
PaginationEngine    — regras CSS de fragmentação e quebra
DocumentComposer    — assembla blocos em HTML + CSS final
   │  composedDoc { html, css, geometry, watermark, title }
   ▼
DocumentRenderer (facade do adapter ativo)
   │
   ▼
RenderAdapter (interface)
   │
   ▼
PagedRenderer  ← ÚNICO arquivo que importa "pagedjs"
   │
   ▼
DOM já paginado em <.pagedjs_page>
   │
   ▼
window.print()  → PDF
```

## Regra de ouro

`import "pagedjs"` ocorre EXCLUSIVAMENTE em
`src/domains/print/document-engine/adapters/PagedRenderer.ts`.

Toda a aplicação consome apenas:

```ts
import { renderDocument } from "@/domains/print/document-engine";
```

## Arquivos

| Arquivo | Papel |
|---|---|
| `types.ts` | Tipos públicos (SemanticDocument, ComposedDocument, blocos) |
| `LayoutEngine.ts` | Geometria de página (margens, área útil) |
| `PaginationEngine.ts` | CSS de @page + regras de quebra |
| `DocumentComposer.ts` | Assembla blocos → HTML + CSS |
| `adapters/RenderAdapter.ts` | Contrato oficial do renderer |
| `adapters/PagedRenderer.ts` | Implementação Paged.js (lazy) |
| `adapters/DocumentRenderer.ts` | Façade — escolhe o adapter ativo |
| `index.ts` | Barrel da API pública |

## Substituindo o Paged.js no futuro

1. Criar `adapters/MeuRenderer.ts` implementando `RenderAdapter`.
2. Trocar a instância em `DocumentRenderer.ts#getActiveAdapter`.
3. **Pronto.** Nenhum outro arquivo precisa mudar.
