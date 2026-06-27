# 02 — Pipeline de Renderização

## Fluxo end-to-end

```
ResultadoDetalhe.tsx (clique "Imprimir")
  └─ executarImpressao()
      └─ doImprimirLaudo(printable, solicitante?, { useNewTab: true })
          ├─ resolveCustomLayouts(printable)
          │    ├─ preloadLayoutsParaExames()       ← exame_layouts
          │    └─ renderExameComLayout()           ← substitui placeholders
          ├─ buildLaudoHtmlPure({...})             ← monta <style> + <table>
          │    ├─ renderCabecalhoPadrao()          ← documento_templates (tipo "cabeçalho")
          │    ├─ renderRodapePadrao()             ← documento_templates (tipo "rodapé")
          │    └─ buildWatermarkCss(labConfig)     ← CSS aditivo
          ├─ sanitizeHtmlForPrint(html)            ← DOMPurify (preserva <style>)
          ├─ savePrintContext({ atendimentoId, html, title, ... })  ← sessionStorage
          └─ window.open('/resultado/:id/print', '_blank')

LaudoPrintPage.tsx (nova aba)
  ├─ loadPrintContext()                            ← lê + valida TTL/id
  ├─ <iframe srcDoc={ctx.html}>                    ← isola @page do shell
  └─ iframe.onload → contentWindow.print()         ← motor de impressão NATIVO do Chrome
      └─ Usuário escolhe "Salvar como PDF" no diálogo do navegador
```

## Modo legado (multi-laudo por solicitante)

Para evitar bloqueio de pop-up ao abrir N abas, o caminho `useNewTab=false`
usa `printHtmlInHiddenFrame()` — cria um `<iframe>` invisível no mesmo
documento, escreve o HTML via `document.write`, dispara `print()` e limpa
no `afterprint`.

## O que NÃO existe no pipeline

- Conversão HTML→PDF programática (sem html2pdf/jspdf no caminho do laudo).
- Renderização para canvas/PNG (sem `html2canvas`).
- Algoritmo próprio de paginação (sem `Paged.js`, sem medição de altura).
- Geração server-side (sem Edge Function rendering, sem Puppeteer).
- Cache de PDF.

## Implicação

Toda a qualidade visual do laudo depende exclusivamente:
1. Do CSS de impressão (`@page`, `display: table-header-group`, `page-break-inside: avoid`).
2. Do motor de impressão do navegador do usuário (Chrome/Edge/Firefox — comportamentos divergem).
