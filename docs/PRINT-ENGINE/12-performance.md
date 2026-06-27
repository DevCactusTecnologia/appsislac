# 12 — Performance

## Custo medido (logs existentes)

`ResultadoDetalhe.tsx:1073` e `:1087` já emitem:

```
[PDF Vetorial] HTML pronto em XXXms — exames=N (nova aba)
```

Sem amostras coletadas neste relatório (read-only). Análise estática abaixo.

## Hotspots

| Etapa | Custo | Notas |
|---|---|---|
| `preloadLayoutsParaExames` | I/O Supabase | Cache em memória após primeira carga |
| `renderExameComLayout` (por exame) | CPU regex | N substituições por placeholder; tolerância de chave faz 4× lookups |
| `buildLaudoHtmlPure` | CPU concat string | ~6 KB de CSS + N blocos de exame |
| `sanitizeHtmlForPrint` (DOMPurify) | CPU parsing DOM | Custoso em HTML grande — roda 2× se entrar pelos dois caminhos |
| `savePrintContext` + `sessionStorage.setItem` | Síncrono | HTML grande (~200 KB) pode exceder cota (~5 MB total) |
| `<iframe srcDoc>` na `LaudoPrintPage` | Re-parse completo | Sem cache entre impressões |
| `window.print()` | Render do Chrome | Maior custo; varia por SO |

## Bundle

- `html2pdf.js` está em **lazy import** (`src/domains/result/services/comprovantesRender.ts:42`) — não pesa no chunk inicial.
- `dompurify` é sincronicamente importado pelo builder do laudo (via `sanitizeHtmlForPrint`).

## Riscos

1. **`sessionStorage` 5 MB**: laudos com layouts pesados (imagens em base64) podem estourar. `savePrintContext` falha silenciosamente (catch ignora).
2. Sem cache do `customByExame` entre re-impressões — re-renderiza tudo.
3. Logs `[PDF Vetorial]` só medem geração do HTML, não o `print()` real do navegador (impossível medir client-side).
