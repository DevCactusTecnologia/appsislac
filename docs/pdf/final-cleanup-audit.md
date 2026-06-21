# PDF — Auditoria Final de Limpeza

> Fase 1 da missão de hardening. Mapeamento read-only de todos os pontos de
> PDF, impressão, exportação e compartilhamento, com identificação de código
> morto, duplicação e legado residual.

## 1. Estado atual (mapa de uso)

### 1.1 Impressão vetorial — `printHtmlInHiddenFrame` (SSOT)

`src/lib/printHtml.ts` é a fonte única para impressão vetorial. Sem
duplicações, sem variantes paralelas. Consumidores:

| Arquivo | Uso |
|---------|-----|
| `src/pages/ResultadoDetalhe.tsx` | Imprimir laudo (vetorial — `doImprimirVetorial`) |
| `src/pages/Producao.tsx` | Imprimir relatórios de produção |
| `src/pages/NovoAtendimento.tsx` | Imprimir comprovantes de atendimento |
| `src/pages/Financeiro.tsx` (×2) | Imprimir relatórios + comprovantes |
| `src/pages/Financeiro/components/dialogs/DetailEntryDialog.tsx` | Imprimir entrada |
| `src/components/configuracoes/ConvenioExamesPanel.tsx` | Tabela de convênios (paisagem) |
| `src/components/configuracoes/ExamesTab.tsx` | Lista de exames |
| `src/components/configuracoes/TabelasPrecoTab.tsx` | Tabelas de preço |
| `src/components/mapa/MapaPreviewDialog.tsx` | Mapa de trabalho |
| `src/lib/lgpdReport.ts` | Relatório LGPD |
| `src/data/auditLogsStore.ts` | Logs de auditoria |
| `src/lib/etiquetaAmostra.ts` | Etiqueta de amostra |

**Total: 13 consumidores. SSOT confirmado.**

### 1.2 Pipeline `html2pdf.js` (Blob → upload → WhatsApp)

`html2pdf.js` é importado em **um único arquivo**:
`src/domains/result/services/comprovantesRender.ts`.

API exportada:

| Símbolo | Consumidores |
|---------|--------------|
| `renderToBlob` | `comprovantes.ts` (envio WhatsApp orçamento + comprovante) |
| `renderAndSave` | `comprovantes.ts` (`gerarOrcamentoPDF`, `gerarComprovantePDF`) |
| `renderToBlobAdvanced` | `PdfPreviewDialog.tsx` |
| `getCachedPdfBlob` | `PdfPreviewDialog.tsx` |
| `clearPdfBlobCache` | re-exportado por `comprovantes.ts` |
| `getDocumentoMarginsMm` | `comprovantesRender.ts` interno |
| `RenderCancelledError`, `RenderProgress`, `RenderStage`, `RenderOptions` | `PdfPreviewDialog.tsx` |
| `loadHtml2Pdf` (~~`export`~~) | **interno apenas** — `export` removido nesta fase |

`html2pdf.js` está restrito ao pipeline WhatsApp + preview de PDF de
comprovantes/orçamentos. Nenhum outro módulo depende dele.

### 1.3 Compartilhamento WhatsApp

| Camada | Arquivo |
|--------|---------|
| Upload + shortlink | `src/domains/result/services/comprovantesUpload.ts` |
| Envio Cloud API + `buildWaUrl` | `src/domains/result/services/comprovantesWhatsapp.ts` |
| Orquestração | `src/lib/comprovantes.ts` |

## 2. Código morto / duplicação / legado

### 2.1 Achados

| # | Tipo | Local | Resolução |
|---|------|-------|-----------|
| 1 | `export` desnecessário | `comprovantesRender.ts` → `loadHtml2Pdf` (0 consumidores externos) | Removido `export` (interno) |
| 2 | Duplicação | `PdfPreviewDialog.tsx` redefinia `buildWaUrl` localmente, idêntico ao de `comprovantesWhatsapp.ts` | Removida cópia local; passa a usar a versão re-exportada por `comprovantes.ts` |

### 2.2 Não-achados (verificados explicitamente)

- ✅ `doExportPdf`, `doImprimirHtml`, `getLaudoCanvasOptions` — já removidos em migração anterior. 0 referências.
- ✅ Sem hooks PDF órfãos.
- ✅ Sem componentes PDF órfãos.
- ✅ Sem tipos PDF órfãos.
- ✅ Sem imports PDF órfãos.
- ✅ Apenas 2 ocorrências residuais da string `html2pdf` fora do módulo central — ambas em **comentários** (`ResultadoDetalhe.tsx:960`, `lgpdReport.ts:4`) marcando que o fluxo NÃO depende mais de html2pdf. Documentação intencional.

## 3. Domínio dedicado `src/domains/pdf/` — decisão

A missão pede para criar `src/domains/pdf/` **somente se houver ganho real**.
Avaliação:

- `printHtml.ts` = 120 linhas, 1 função exportada, 13 consumidores estáveis.
- `comprovantesRender.ts` já vive em `src/domains/result/services/` (pertence
  ao domínio "result/comprovante", não a um domínio "pdf" genérico).
- Não há constantes/tipos PDF compartilhados entre os dois fluxos.

**Decisão: não criar `src/domains/pdf/`.** Criaria abstração artificial sem
consumidor real — a regra "não criar abstrações artificiais" se aplica.

## 4. `html2pdf.js` em `package.json` — decisão

Mantido. Bloqueador identificado anteriormente (`pdf-migration-plan.md`):
o pipeline WhatsApp precisa de `Blob` PDF para upload em storage + shortlink.
`window.print()` não retorna Blob. Removê-lo exigiria infra externa (Chromium
headless pago) ou regressão de UX (perder anexo PDF no WhatsApp).

Tamanho: 11 MB em `node_modules` (incluindo `html2canvas` 3,4 MB e `jspdf` 29
MB transitivos). **Já é carregado via `import()` dinâmico** — não entra no
chunk inicial.

## 5. Conclusão da auditoria

O sistema já está no estado-alvo. Esta fase de hardening encontrou **2
limpezas pontuais** (1 `export` redundante + 1 função duplicada), nenhum
arquivo órfão e nenhum legado significativo. O grosso da consolidação foi
feito nas migrações anteriores.

Próximas fases (2–8) executam apenas as 2 limpezas + medições + relatório.
Sem refatorações estruturais.
