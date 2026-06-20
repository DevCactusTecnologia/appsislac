# PDF Migration Plan — html2pdf → vetorial

Classificação por uso (ver `pdf-dependency-map.md`).

## ✅ Pode substituir por `window.print()` (vetorial)

| Local | Plano |
|-------|-------|
| `ResultadoDetalhe.doExportPdf` / `doImprimirHtml` | Substituir pelo fluxo `doImprimirVetorial` já validado. Remover `getLaudoCanvasOptions` e o `import('html2pdf.js')`. |
| `lib/lgpdReport.ts` | Trocar render por `printHtmlInHiddenFrame` (`src/lib/printHtml.ts`) com mesmo HTML. UX: usuário salva como PDF. |
| `data/auditLogsStore.ts` (export PDF auditoria) | Idem — `printHtmlInHiddenFrame`, com `@page size: A4 landscape`. |
| `components/configuracoes/ConvenioExamesPanel.tsx` | Idem — `printHtmlInHiddenFrame` paisagem. |
| `ResultadoDetalhe/services/laudoHtmlBuilder.ts` | Apenas atualizar comentários (não há código html2pdf). |

Após estas migrações: 0 chamadas diretas a html2pdf no domínio "laudo + admin".

## ⚠️ Precisa manter html2pdf (bloqueador real)

| Local | Por quê |
|-------|---------|
| `domains/result/services/comprovantesRender.ts` (`renderToBlob`, `renderToBlobAdvanced`) | Produz `Blob` que é **uploaded** para storage e enviado por **WhatsApp** via shortlink. `window.print()` não retorna Blob — não há equivalente client-side sem rasterizar. |
| `lib/comprovantes.ts` (`enviarComprovantePorWhatsapp`, `enviarOrcamentoPorWhatsapp`) | Consome `renderToBlob` acima. Mesmo motivo. |
| `lib/comprovantes.ts` (`gerarComprovantePDF`, `gerarOrcamentoPDF`) | Hoje usa `renderAndSave`. **Pode** virar `window.print()` — mas o motor `comprovantesRender` continuaria existindo para a versão WhatsApp; não há ganho em remover. |

**Conclusão:** Para zerar `html2pdf.js`, seria necessário ou (a) gerar PDF
vetorial server-side via Chromium headless / serviço externo (Browserless,
Gotenberg, PDFShift) — exige infra paga e secret, ou (b) descontinuar o envio
de comprovantes/orçamentos por WhatsApp como anexo PDF (regressão de produto).

## ❌ Não relacionado

Nenhum. Todos os usos foram catalogados.

## Resultado realista da missão

- **Não é possível remover `html2pdf.js` do `package.json`** sem decisão de
  produto/infra sobre o item ⚠️.
- **É possível** migrar laudo + LGPD + auditoria + tabela de convênio para
  vetorial nativo (`window.print()`) — elimina html2pdf de **5 dos 7 pontos**
  de uso e mantém o pacote apenas como motor do pipeline de comprovantes
  WhatsApp.
- Ganho real: laudos instantâneos, menos código próprio de raster, helpers
  mortos removíveis (`getLaudoCanvasOptions`, branches `doExportPdf`).

## Decisão necessária do usuário

1. **Migrar parcial (recomendado)** — laudo + LGPD + auditoria + convênio
   viram vetorial; `html2pdf.js` permanece para WhatsApp de comprovantes. Sem
   regressão funcional.
2. **Migrar total + manter WhatsApp** — exige Chromium headless via serviço
   externo (custo recorrente + secret de API). Implica infra nova.
3. **Migrar total + remover anexo PDF do WhatsApp** — envia só link/texto.
   Regressão de UX.

Sem essa decisão, as Fases 5–10 (remoção de deps, bundle, etc.) não fecham
como prometidas no briefing.
