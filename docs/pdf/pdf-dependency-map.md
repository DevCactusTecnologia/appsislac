# PDF Dependency Map — SISLAC

Auditoria de todos os pontos que utilizam `html2pdf.js` / `html2canvas` / `jsPDF`
(estes 3 vêm em conjunto: `html2pdf.js` empacota `html2canvas` + `jsPDF`).

## Dependência única em `package.json`

- `html2pdf.js@^0.14.0` — único pacote declarado.
- `html2canvas` e `jsPDF` **não** estão em `package.json`: vêm transitivamente
  embutidos em `html2pdf.js`. Remover `html2pdf.js` remove os três.

## Mapa de uso

| # | Arquivo | Função/Uso | Saída | Consumidor final |
|---|---------|------------|-------|------------------|
| 1 | `src/pages/ResultadoDetalhe.tsx` (`doExportPdf`, `doImprimirHtml`) | Laudo de exames — exportar PDF e imprimir laudo | Download `.pdf` / impressão raster | Operador clínico |
| 2 | `src/pages/ResultadoDetalhe.tsx` (`doImprimirVetorial`) | **PoC já em produção** — usa `window.print()` sem html2pdf | Vetorial nativo | Operador clínico |
| 3 | `src/domains/result/services/comprovantesRender.ts` (`renderToBlob`, `renderToBlobAdvanced`, `renderAndSave`) | Pipeline central de PDFs do domínio "result": recibos, orçamentos, comprovantes | **Blob `application/pdf`** (download local **e** upload para storage / shortlink) | `comprovantes.ts` → WhatsApp Cloud, download local |
| 4 | `src/lib/comprovantes.ts` | Fachada que chama `renderToBlob` / `renderAndSave` (não usa html2pdf direto) | Blob/download | `gerarComprovantePDF`, `enviarComprovantePorWhatsapp`, `gerarOrcamentoPDF`, `enviarOrcamentoPorWhatsapp` |
| 5 | `src/lib/lgpdReport.ts` (`gerarRelatorioLGPD`) | Relatório de conformidade LGPD on-demand | Download `.pdf` | Admin/DPO |
| 6 | `src/data/auditLogsStore.ts` (export PDF de auditoria) | Exporta logs de auditoria como PDF paisagem | Download `.pdf` | Admin |
| 7 | `src/components/configuracoes/ConvenioExamesPanel.tsx` | Exporta tabela de preços de convênio | Download `.pdf` paisagem | Admin/Convênios |
| 8 | `src/pages/ResultadoDetalhe/services/laudoHtmlBuilder.ts` | **Apenas comentários** referenciando html2canvas. Sem código ativo. | — | — |

## Observações

- Item 3 (`comprovantesRender`) é o **bloqueador da remoção total**: produz `Blob`
  que é uploaded para storage e transformado em shortlink enviado por WhatsApp.
  `window.print()` **não retorna Blob** — não há substituto trivial sem servidor
  (Chromium headless / serviço externo).
- Itens 1, 5, 6, 7 produzem download local — são candidatos diretos a
  `window.print()` (UX muda: usuário escolhe "Salvar como PDF" no diálogo).
- Item 2 já está vetorial e validado.

## Tamanho

`html2pdf.js` minificado ≈ 370 KB. Já é carregado via `import()` dinâmico em
todos os pontos (não entra no chunk inicial). O ganho ao remover o pacote
está no `node_modules` / install time, não no first paint.
