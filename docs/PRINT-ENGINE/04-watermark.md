# 04 — Marca d'água

## Como funciona

Arquivo: `src/lib/watermark.ts` (98 linhas). Configuração persistida em `tenant_lab_config.watermark` (jsonb) e replicada no `LabConfig` local.

CSS aditivo, sem tocar em nenhuma regra existente:

```css
body { position: relative; }
body::before {
  content: ""; position: fixed; inset: 0;       /* documentos via wrapA4Document */
  background-image: url("data:image/...");
  background-size: 60% auto;
  opacity: 0.08; transform: rotate(0deg);
  -webkit-print-color-adjust: exact;
}
.laudo-a4-page { position: relative; }
.laudo-a4-page::before { ...; position: absolute; inset: 0; }  /* cada folha do laudo */
.laudo-a4-page > * { position: relative; z-index: 1; }
```

## Características

| Pergunta | Resposta |
|---|---|
| Tipo | **CSS `::before` com `background-image`** (data URL ou URL pública) |
| Background? | Sim (`background-image`). |
| Imagem `<img>`? | Não, é background. |
| Canvas / SVG / PDF Layer? | Não. |
| Aplica em todas as páginas? | **No laudo, depende.** Ver problema abaixo. |

## Problema crítico identificado

`body::before { position: fixed }` cobre toda a viewport impressa — **mas só dispara em documentos onde o conteúdo está direto em `body`** (comprovantes via `wrapA4Document`).

Para o laudo, o motor usa `.laudo-a4-page::before { position: absolute; inset: 0 }`. Como existe **uma única `<table class="laudo-a4-page">`** que se expande por N páginas (não uma `.laudo-a4-page` por folha), o `::before` cobre apenas o **bounding box da tabela inteira**. Ele é pintado **uma vez** e clipado pelo motor de impressão ao renderizar cada folha — na prática, **a marca d'água aparece centralizada no documento, não centralizada em cada página**.

Em laudos curtos (1 página) o efeito é correto. Em laudos com 2+ páginas, a marca d'água tende a aparecer:
- página 1 — só a metade superior (ou parcial);
- página 2 — só a metade inferior;
- página 3+ — vazio.

Validar visualmente com `printable.length` alto antes de qualquer correção.

## Recomendação (sem implementar)

Marca d'água por página exige **uma das três** abordagens:
1. Quebrar o documento em múltiplas `.laudo-a4-page` reais (1 por folha) — requer paginação calculada (Paged.js ou cálculo manual).
2. Usar `@page { background-image: ... }` — suportado parcialmente, sem rotação.
3. Voltar a `body::before { position: fixed }` desde que o `body` represente cada página impressa (o motor de print do Chrome re-aplica `position: fixed` por página).
