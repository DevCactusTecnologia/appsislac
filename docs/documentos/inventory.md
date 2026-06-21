# Inventário de Documentos Operacionais — SISLAC

Auditoria somente-leitura. Catalogação de todo HTML/PDF emitido pelo sistema
para impressão, download ou envio externo. Não inclui telas internas (UI), só
artefatos que vão para papel/PDF/WhatsApp.

## 1. Atendimento

| # | Documento | Origem (UI) | Builder | Motor |
|---|-----------|-------------|---------|-------|
| 1 | Comprovante de Atendimento | `NovoAtendimento.tsx`, `AtendimentoDetalheDialog.tsx` (botão "Comp. Atendimento") | `buildComprovanteHtml({ tipo: "atendimento" })` | `printHtmlInHiddenFrame` |
| 2 | Declaração de Comparecimento | idem (botão "Comparecimento") | `buildComprovanteHtml({ tipo: "comparecimento" })` | `printHtmlInHiddenFrame` |

> Não há "Ficha de Atendimento" / "Protocolo" como artefato impresso separado.
> O protocolo aparece dentro do comprovante de atendimento.

## 2. Financeiro

| # | Documento | Origem | Builder | Motor |
|---|-----------|--------|---------|-------|
| 3 | Recibo de Pagamento | `NovoAtendimento.tsx`, `AtendimentoDetalheDialog.tsx` (botão "Comp. Pagamento") | `buildComprovanteHtml({ tipo: "pagamento" })` | `printHtmlInHiddenFrame` |
| 4 | Livro Caixa (relatório) | `Financeiro.tsx` (Caixa → Imprimir) | `buildLivroCaixaHtml` | `printHtmlInHiddenFrame` |
| 5 | Demonstrativo Financeiro Detalhado | `Financeiro.tsx` (Painel) | `buildDetalhadoHtml` | `printHtmlInHiddenFrame` |
| 6 | Detalhe de Entrada (extrato unitário) | `DetailEntryDialog.tsx` | inline (no próprio dialog) | `printHtmlInHiddenFrame` |

## 3. Laboratório / Operacional

| # | Documento | Origem | Builder | Motor |
|---|-----------|--------|---------|-------|
| 7 | Laudo de Exame | `ResultadoDetalhe.tsx` (Imprimir / Exportar) | `buildLaudoHtml` (`laudoHtmlBuilder.ts`) | `printHtmlInHiddenFrame` (vetorial — PoC já em produção) **e** `html2pdf` (export PDF/imprimir raster legado) |
| 8 | Mapa de Trabalho (operacional) | `Mapa.tsx`, `MapaPreviewDialog.tsx` | `buildMapasHtml` (`mapaPrint.ts`) | `printHtmlInHiddenFrame` |
| 9 | Etiqueta de Amostra (50×30 mm) | fluxo de coleta, `imprimirEtiquetaPorAtendimentoExame.ts` | `etiquetaAmostra.ts` (HTML inline) | `printHtmlInHiddenFrame` |
| 10 | Dossiê de Rastreabilidade | `dossieRastreabilidade.ts` | inline | `printHtmlInHiddenFrame` |
| 11 | Preview de Mapa em Lote (A4) | `mapaA4Preview.ts`, `mapaLotePreview.ts` (`buildLotePreviewHtml`) | inline / shared | preview iframe (não imprime) |

## 4. Comercial

| # | Documento | Origem | Builder | Motor |
|---|-----------|--------|---------|-------|
| 12 | Orçamento | `Orcamentos.tsx`, `NovoAtendimento.tsx` | `buildOrcamentoHtml` / `buildOrcamentoHtmlPublic` | `html2pdf` (download local + WhatsApp shortlink) |

## 5. Administrativo / Compliance

| # | Documento | Origem | Builder | Motor |
|---|-----------|--------|---------|-------|
| 13 | Relatório de Conformidade LGPD | `lgpdReport.ts` | inline | `printHtmlInHiddenFrame` |
| 14 | Auditoria Técnica (logs) | `auditLogsStore.ts → exportAuditLogsPdf` | inline | `printHtmlInHiddenFrame` |
| 15 | Tabela de Preços de Convênio | `ConvenioExamesPanel.tsx` | inline | `printHtmlInHiddenFrame` |
| 16 | Tabelas de Preço (CBHPM/TUSS/Própria) | `TabelasPrecoTab.tsx` | inline | `printHtmlInHiddenFrame` |
| 17 | Catálogo de Exames | `ExamesTab.tsx` | inline | `printHtmlInHiddenFrame` |
| 18 | Relatórios de Produção | `Producao.tsx` | inline | `printHtmlInHiddenFrame` |

## Totais

- **18 documentos operacionais** distintos.
- **4 famílias**: comprovantes (3) · relatórios financeiros (3) · operacionais
  (5) · administrativos/comercial (7).
- **2 motores de saída**: `printHtmlInHiddenFrame` (vetorial) e `html2pdf.js`
  (raster) — mapeados em detalhe em `technical-map.md`.
