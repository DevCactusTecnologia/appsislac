# Elementos Permanentes (Cabeçalho, Rodapé, Marca d'Água)

## Cabeçalho

Reproduzido em todas as páginas pelo mecanismo `<thead>` da
`<table class="laudo-a4-page">`. O CSS aplica
`display: table-header-group !important` — comportamento padrão de
CSS-Fragmentation, suportado por Chrome e por Paged.js.

Altura constante: o cabeçalho usa o template institucional
(`renderCabecalhoPadrao`) e o CSS travado em
`mem://constraints/layout-impressao-travado.md` zera margens/paddings
herdados do CKEditor.

## Rodapé

Reproduzido em todas as páginas via `<tfoot>` com
`display: table-footer-group !important`. Ocupa altura fixa
(rodapé de 4mm + conteúdo institucional do template).

## Marca d'Água

Antes (Print Engine legado): aplicada via `body::before` +
`.laudo-a4-page::before`. Aparecia apenas na primeira página.

Agora (Document Engine 3.0): o `PagedRenderer.injectWatermark()`
**percorre cada elemento `.pagedjs_page`** depois da paginação e injeta
um `<div class="sislac-watermark">` posicionado em `inset: 0` dentro do
`pagedjs_pagebox`. Resultado: marca d'água em **todas** as páginas, com
posição, escala, opacidade e rotação idênticas.

### Spec da marca d'água

```ts
interface WatermarkSpec {
  enabled: boolean;       // ativa/desativa
  url: string | null;     // data URL ou URL pública
  opacity: number;        // 0.02 – 0.5
  sizePct: number;        // % da largura da página (10–100)
  rotation: number;       // graus (-180 a 180)
}
```

A spec viaja no `PrintContext.watermark` (snapshot do
`tenant_lab_config.watermark` no momento da impressão).
