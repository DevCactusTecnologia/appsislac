# Mapa Técnico — Documentos do SISLAC

## 1. Builders HTML

| Builder | Arquivo | Tipo | Reusa header/footer canônico? |
|---------|---------|------|-------------------------------|
| `buildComprovanteHtml` | `src/domains/result/services/comprovantesHtml.ts` | recibos/comprovantes/declarações | ✅ `buildEmitenteHeader` + `buildAssinaturaRodape` (ou template via `renderDocumentoTemplate`) |
| `buildOrcamentoHtml` / `buildOrcamentoHtmlPublic` | idem | orçamento | ✅ mesmo header, sem QR de quitação |
| `buildEmitenteHeader` | idem | header canônico (logo + lab) | — |
| `buildAssinaturaRodape` | idem | rodapé canônico (QR + verificação) | — |
| `buildDocumentoFooterHtml` | idem | wrapper público do rodapé | usado em editor de templates |
| `renderDocumentoTemplate` / `renderCabecalhoPadrao` / `renderRodapePadrao` | `src/lib/documentoRenderer.ts` | template configurável | sim |
| `buildLaudoHtml` | `src/pages/ResultadoDetalhe/services/laudoHtmlBuilder.ts` | laudo clínico | usa `renderCabecalhoPadrao`/`renderRodapePadrao` (template), CSS próprio congelado |
| `buildMapasHtml` | `src/lib/mapaPrint.ts` | mapa de trabalho operacional | header próprio (placeholders) — NÃO usa o canônico |
| `buildLotePreviewHtml` | `src/lib/mapaLotePreview.ts` | preview A4 de mapa | header próprio |
| `buildLivroCaixaHtml` | `src/pages/Financeiro/services/FinanceiroService.ts` | relatório caixa | header próprio inline |
| `buildDetalhadoHtml` | idem | demonstrativo | header próprio inline |
| `etiquetaAmostra` (sem nome explícito) | `src/lib/etiquetaAmostra.ts` | etiqueta 50×30 | header próprio (sem logo) |
| `gerarRelatorioLGPD` | `src/lib/lgpdReport.ts` | LGPD | header próprio inline |
| `exportAuditLogsPdf` | `src/data/auditLogsStore.ts` | auditoria técnica | header próprio inline |
| `gerarDossie...` | `src/lib/dossieRastreabilidade.ts` | rastreabilidade | header próprio inline |
| Tabelas/catálogos | `ConvenioExamesPanel.tsx`, `TabelasPrecoTab.tsx`, `ExamesTab.tsx`, `Producao.tsx` | tabela A4 | header próprio inline (4 cópias) |
| Detalhe de entrada | `Financeiro/components/dialogs/DetailEntryDialog.tsx` | extrato unitário | header próprio inline |

**14 builders independentes**, dos quais apenas **3 famílias** (comprovantes,
laudo, templates configuráveis) reutilizam o header/footer canônicos.

## 2. CSS / styling

| Origem | Onde mora | Reuso |
|--------|-----------|-------|
| `mapaSharedStyles.ts` (`buildPrintCss`, `prepareMapaHtml`) | `src/lib/` | só Mapa de Trabalho + LoteA4 |
| CSS inline dentro de `comprovantesHtml.ts` | inline em strings de template literal | só comprovantes/orçamento |
| CSS inline em `laudoHtmlBuilder.ts` | congelado (constraint `mem://constraints/layout-impressao-travado.md`) | só laudo |
| CSS inline em `lgpdReport.ts`, `auditLogsStore.ts`, `Financeiro` builders, painéis de Configurações, `dossieRastreabilidade.ts`, `etiquetaAmostra.ts` | string literal por arquivo | nenhum (cópia) |
| `escapeHtml` | `src/lib/escapeHtml.ts` (canônico) **e** ≥6 reimplementações locais | parcial |

**Não existe stylesheet compartilhada para impressão A4 fora do Mapa.** Cada
builder traz seu próprio bloco `@page`, `body`, `table`, etc.

## 3. Helpers

| Helper | Onde | Duplicidades |
|--------|------|--------------|
| `escapeHtml` | `@/lib/escapeHtml.ts` | reimplementado em `mapaPrint.ts`, `etiquetaAmostra.ts`, `dossieRastreabilidade.ts`, `auditLogsStore.ts`, `lgpdReport.ts`, `documentoRenderer.ts` |
| `fmtBRL` | `@/lib/utils.ts` | usado uniformemente |
| `gerarQrSvg` | privado em `comprovantesHtml.ts` | usado só por comprovantes |
| `codigoVerificacao` | `@/domains/result/services/comprovantesValidation.ts` | usado em comprovantes + página `/verificar/:codigo` |
| `dataAtualPorExtenso` | privado em `comprovantesHtml.ts` | exclusivo |
| `valorPorExtenso` | exportado em `comprovantesHtml.ts` | exclusivo |
| `getLabConfig` / `ensureLabLogoLoaded` | `@/data/labConfigStore` | branding único |
| `renderPlaceholders` | `@/lib/mapaPlaceholders` | mapa + documentoRenderer |

## 4. Componentes UI (preview/dialogs)

| Componente | Função | Status pós-simplificação dos comprovantes |
|------------|--------|------|
| `PdfPreviewDialog` | preview + download/whatsapp | **mantido** apenas para Orçamentos |
| `MapaPreviewDialog` | preview + imprimir | em uso |
| `PreviewComprovantesDialog` | preview em Configurações → Documentos | em uso |
| `DocumentoTemplateDialog` | editor CKEditor de templates | em uso |

## 5. Motores de impressão / PDF

| Motor | Arquivo | Saída | Usuários |
|-------|---------|-------|----------|
| `printHtmlInHiddenFrame` (`window.print()` em iframe oculto) | `src/lib/printHtml.ts` | vetorial; usuário escolhe "Salvar como PDF" | comprovantes (todos), laudo (vetorial), mapa, etiqueta, LGPD, auditoria, tabelas, produção, livro caixa, detalhado |
| `html2pdf.js` (≈370 KB, lazy-loaded) | `src/domains/result/services/comprovantesRender.ts` | `Blob` raster | **somente** Orçamentos (download/WhatsApp) e laudo (export PDF / imprimir raster legados em `ResultadoDetalhe.tsx`) |
| `LaudoPrintPage` (rota dedicada) | `src/pages/LaudoPrintPage.tsx` + `printContext.ts` | vetorial via página dedicada | laudo |

## 6. Cabeçalhos/rodapés canônicos vs. inline

- **Canônicos (1 fonte)**: `buildEmitenteHeader`, `buildAssinaturaRodape`,
  `renderCabecalhoPadrao`, `renderRodapePadrao`. Usados por:
  comprovantes/orçamento (sempre) e laudo (via templates configuráveis).
- **Inline (cópias)**: livro caixa, demonstrativo, LGPD, auditoria, tabelas
  de preço, catálogo de exames, produção, detalhe de entrada, dossiê de
  rastreabilidade, etiqueta, mapa de trabalho. **10 cabeçalhos paralelos.**

## 7. Camada de download/upload (pós-PDF)

| Função | Arquivo | Uso |
|--------|---------|-----|
| `renderToBlob` / `renderAndSave` | `comprovantesRender.ts` | gera blob (orçamento/laudo PDF) |
| `uploadPdfAndGetUrl` | `comprovantesUpload.ts` | upload para storage |
| `criarShortlinkPdf` | idem | gera shortlink WhatsApp |
| `enviarPdfWhatsappCloud` / `buildWaUrl` | `comprovantesWhatsapp.ts` | envio |

Após a simplificação dos comprovantes, **somente Orçamentos** ainda exercita
todo esse pipeline. Comprovantes e demais relatórios vão direto para
`window.print()` sem gerar Blob.
