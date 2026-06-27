# 01 — Inventário do Motor de Impressão

> Fase: OLHOU. Análise estritamente read-only. Nenhum arquivo alterado.

## Arquivos do pipeline (laudo de resultado)

| Camada | Arquivo | Linhas | Responsabilidade |
|---|---|---:|---|
| Entry UI | `src/pages/ResultadoDetalhe.tsx` | 2.791 | Botão "Imprimir"; orquestra `resolveCustomLayouts` + `buildLaudoHtml` + `savePrintContext` + `window.open('/resultado/:id/print')` |
| Builder HTML | `src/pages/ResultadoDetalhe/services/laudoHtmlBuilder.ts` | 506 | Monta o `<style>` + `<table class="laudo-a4-page">` com `thead`/`tbody`/`tfoot` (CSS de impressão CONGELADO por constraint) |
| Contexto | `src/domains/print/printContext.ts` | 100 | SSOT — grava HTML em `sessionStorage` (TTL 15min, chave única) para passar para a aba dedicada |
| Página dedicada | `src/pages/LaudoPrintPage.tsx` | 165 | Lê `PrintContext`, renderiza HTML em `<iframe srcDoc>`, dispara `window.print()` no `load` |
| Iframe oculto (fallback) | `src/lib/printHtml.ts` | 120 | Modo "por solicitante" (múltiplos laudos) — escreve no `contentDocument`, chama `print()`, restaura `document.title` no `afterprint` |
| Shell A4 (outros docs) | `src/lib/printShell.ts` | 68 | `wrapA4Document()` para comprovantes / orçamentos / declarações |
| Marca d'água | `src/lib/watermark.ts` | 98 | `buildWatermarkCss()` — CSS `::before` em `body` e `.laudo-a4-page` |
| Cabeçalho/Rodapé padrão | `src/lib/documentoRenderer.ts` | — | `renderCabecalhoPadrao` / `renderRodapePadrao` a partir de `documento_templates` |
| Layout científico | `src/lib/laudoLayout.ts` | 284 | Resolve template HTML por exame + substitui placeholders `##CHAVE##` |
| Sanitização | `src/lib/sanitizeHtml.ts` | — | `sanitizeHtmlForPrint()` preserva `<style>` interno |
| Comprovantes (caminho separado) | `src/domains/result/services/comprovantesRender.ts` | — | **único consumidor de `html2pdf.js`** (lazy import). Não impacta o laudo. |

## Dependências externas

- `html2pdf.js@^0.14.0` — usado **apenas** em comprovantes (PDF para storage). Não participa do laudo.
- `dompurify` — sanitização.
- Nenhuma biblioteca PDF nativa (jspdf, pdfkit, puppeteer, wkhtmltopdf, Paged.js).

## Conclusão da Etapa 1

O motor de impressão de laudo é **100% HTML + CSS interpretado pelo motor de impressão nativo do navegador (Chrome `window.print()`)**.
Não existe biblioteca PDF intermediária no caminho do laudo — o PDF é produzido pelo próprio Chrome via "Salvar como PDF".
