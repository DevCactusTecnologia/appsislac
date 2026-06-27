# Developer Guide — Document Engine 3.0

## Como adicionar um novo tipo de documento

Hoje o motor é exercitado pelo laudo (`ResultadoDetalhe` →
`LaudoPrintPage`). Para acoplar comprovantes, mapas etc.:

1. Construa um `ComposedDocument`:

```ts
import { compose, resolveGeometry, type SemanticDocument } from "@/domains/print/document-engine";

const doc: SemanticDocument = {
  title: "Comprovante 123",
  geometry: resolveGeometry(),
  header: { kind: "header", html: headerHtml },
  footer: { kind: "footer", html: footerHtml },
  watermark: { enabled: false, url: null, opacity: 0, sizePct: 60, rotation: 0 },
  body: items.map(i => ({ kind: "exam", id: String(i.id), html: i.html, unbreakable: true })),
  css: extraCss,
};
const composed = compose(doc);
```

2. Renderize:

```ts
import { renderDocument } from "@/domains/print/document-engine";

const host = document.getElementById("paged-host")!;
const { pageCount } = await renderDocument(composed, host);
window.print();
```

## Boas práticas

- ✅ Cada bloco indivisível recebe a classe `exame-bloco` (ou
  `assinatura-bloco`).
- ✅ Tabelas que podem ultrapassar uma página recebem a classe
  `exame-fragmentavel` — quebrarão apenas entre `<tr>`.
- ✅ Imagens muito grandes devem ter `max-height` definido em CSS para
  não estourar a página.
- ❌ Nunca importe `pagedjs` diretamente — sempre via
  `renderDocument(...)`.
- ❌ Nunca use `window.print()` sem antes invocar `renderDocument(...)` —
  o navegador voltaria a decidir a paginação.

## Substituindo o adapter

1. Crie `adapters/MyRenderer.ts` implementando `RenderAdapter`.
2. Em `adapters/DocumentRenderer.ts`, troque
   `_adapter = new PagedRenderer()` por `_adapter = new MyRenderer()`.
3. Nenhum outro arquivo precisa ser modificado.

## Debug

```ts
import { activeAdapterName } from "@/domains/print/document-engine";
console.log("[Document Engine]", activeAdapterName()); // "pagedjs"
```

`PagedRenderer.render()` devolve `{ pageCount }` — útil para
instrumentação e validação visual.
