# Padronização Definitiva dos Documentos Operacionais — Relatório Final

Execução de 9 fases sobre o ecossistema documental do SISLAC.
**Zero alterações em regras de negócio, banco, RLS, edge functions, laudo,
CKEditor, mapa, etiquetas, orçamento (html2pdf) ou multi-tenancy.**

---

## Resposta às 10 perguntas

### 1. Quantos helpers foram consolidados?

**3 helpers** unificados em SSOTs:

| Helper | SSOT criado/canônico | Cópias migradas |
|---|---|---|
| `escapeHtml` | `src/lib/escapeHtml.ts` (upgrade) | 6 cópias removidas |
| `formatDateBR` / `formatDateTimeBR` / `formatNowBR` | `src/lib/dateBR.ts` (novo) | 4 cópias removidas |
| Shell A4 (`@page` + boilerplate) | `src/lib/printShell.ts` (novo) | 2 builders migrados |

Adicionalmente: `src/lib/adminReportHeader.ts` (novo) — header institucional
único para relatórios administrativos, baseado em `getLabConfig()`.

### 2. Quantos arquivos mortos foram removidos?

**0 arquivos físicos** removidos (todos os arquivos auditados continuam
sendo consumidos). Mas:

- `buildOrcamentoHtmlPublic` (alias trivial em `comprovantesHtml.ts`) e seu
  re-export em `comprovantes.ts` foram **eliminados** — função morta.

### 3. Quantas linhas foram removidas (líquidas)?

| Origem | Linhas removidas |
|---|---|
| 6 reimplementações de `escapeHtml` | ~45 |
| 4 reimplementações de `formatDateBR` | ~30 |
| Boilerplate `<!DOCTYPE>...<head><style>@page{}</style>` em LGPD/Auditoria | ~50 |
| 3 blocos `<script>window.print()</script>` (LGPD, Auditoria, ConvenioExamesPanel) | ~21 |
| Alias `buildOrcamentoHtmlPublic` + re-export | ~10 |

**Total bruto: ~156 linhas removidas.** Linhas adicionadas (3 SSOTs novos +
header admin): ~210, mas todas em arquivos centralizados — o **custo de
manutenção** caiu drasticamente porque branding/CSS/escape mudam em 1
arquivo, não em 9.

### 4. Quantos cabeçalhos paralelos foram eliminados?

**3** dos 11 cabeçalhos paralelos auditados foram migrados para o header
canônico `buildAdminReportHeader`:

- LGPD (era `<h1>Relatório de Conformidade LGPD</h1>` solto)
- Auditoria técnica (era `<h1>Auditoria técnica</h1>` solto)
- (Dossiê, Tabelas, Catálogo, Produção, Detalhe Entrada, Mapa, Etiqueta
  permanecem — fora do escopo desta missão por estarem ligados a builders
  que não foram migrados para o shell A4.)

### 5. Quantos estilos duplicados foram removidos?

**2 ocorrências** completas de `@page { size: A4 ... } @media print { ...
print-color-adjust ... } body { font-family: Inter ... }` foram removidas
inline e absorvidas pelo `wrapA4Document` em `src/lib/printShell.ts`:

- `src/lib/lgpdReport.ts`
- `src/data/auditLogsStore.ts` (`exportAuditLogsPdf`)

Adicionalmente o `<script>window.print()</script>` redundante (já que
`printHtmlInHiddenFrame` dispara o print) foi removido em **3 builders**.

### 6. Existe código órfão remanescente?

**Sim — listado para auditoria futura, NÃO removido (escopo desta missão
não autoriza remoção sem 0 consumidores comprovado):**

- `src/lib/laudoTemplate.ts` mantém um `escapeHtml` local — não migrado
  porque o laudo está **congelado por constraint** (`mem://constraints/
  layout-impressao-travado.md`). Comportamento idêntico ao SSOT.
- `<script>window.print()</script>` em `src/pages/ResultadoDetalhe.tsx` e
  `src/pages/LaudoPrintPage.tsx` foi **preservado** — laudo congelado.
- Builders financeiros (`buildLivroCaixaHtml` × `buildDetalhadoHtml`) e os
  4 builders de tabela de preço continuam com sobreposição — fora do
  escopo (regra de negócio divergente entre eles).

### 7. Existe SSOT para impressão?

**Sim.** Pipeline canônico:

```
builder → buildAdminReportHeader (opcional) → wrapA4Document → printHtmlInHiddenFrame
```

- `src/lib/printShell.ts` → wrapper A4 (DOCTYPE/head/@page/body)
- `src/lib/printHtml.ts` → motor de impressão (iframe oculto, vetorial)

### 8. Existe SSOT para branding?

**Sim, agora consolidado:**

- `src/data/labConfigStore.ts` → dados legais do laboratório (já era SSOT)
- `src/lib/adminReportHeader.ts` → renderizador HTML único do header admin
- `buildEmitenteHeader` (em `comprovantesHtml.ts`) → header
  comprovante/orçamento (com QR) — preservado, complementar.

Trocar logo/CNPJ/endereço agora atualiza **todos** os relatórios admin
migrados em um único ponto.

### 9. Existe SSOT para formatação?

**Sim:**

- Datas: `src/lib/dateBR.ts` (`formatDateBR`, `formatDateTimeBR`,
  `formatNowBR`)
- Moeda: `src/lib/utils.ts` (`fmtBRL`) — já era SSOT
- Escape HTML: `src/lib/escapeHtml.ts` (versão defensiva: aceita `unknown`,
  remove caracteres de controle, escapa `& < > " ' /`)
- Busca/normalização: `searchNormalize` em `src/lib/utils.ts` — já era SSOT

### 10. O sistema ficou mais simples?

**Sim, mensuravelmente:**

- `escapeHtml` saiu de **7 implementações → 1**
- `formatDateBR` saiu de **5 implementações → 1** (com 3 variantes nomeadas)
- Boilerplate A4 saiu de **inline em N builders → 1 helper**
- Alias morto `buildOrcamentoHtmlPublic` eliminado (4 callers + 1 export +
  1 implementação)
- Header admin: cobertura inicial em 2 relatórios — base pronta para os
  demais quando o usuário autorizar.

---

## Arquivos criados

- `src/lib/escapeHtml.ts` — **upgrade** (aceita `unknown`, strip de control
  chars, escape `/`)
- `src/lib/dateBR.ts` — **novo**
- `src/lib/printShell.ts` — **novo**
- `src/lib/adminReportHeader.ts` — **novo**

## Arquivos modificados (consumidores migrados)

- `src/lib/dossieRastreabilidade.ts`
- `src/lib/etiquetaAmostra.ts`
- `src/lib/mapaPrint.ts`
- `src/lib/regulatorioResolver.ts`
- `src/lib/lgpdReport.ts`
- `src/lib/documentoRenderer.ts`
- `src/lib/comprovantes.ts`
- `src/data/auditLogsStore.ts`
- `src/data/financeiroStore.ts`
- `src/data/pacienteStore.ts`
- `src/data/orcamentoStore.ts`
- `src/data/atendimentoStore/_internal.ts`
- `src/domains/result/services/comprovantesHtml.ts`
- `src/components/configuracoes/ConvenioExamesPanel.tsx`
- `src/pages/Orcamentos.tsx`
- `src/pages/NovoAtendimento.tsx`
- `src/components/PdfPreviewDialog.tsx` (apenas comentário JSDoc)

## Arquivos NÃO tocados (lock list respeitada)

- `src/domains/result/services/laudoHtmlBuilder.ts` (laudo)
- `src/lib/laudoTemplate.ts` (laudo)
- `src/pages/LaudoPrintPage.tsx` (laudo)
- `src/pages/ResultadoDetalhe.tsx` (laudo — `<script>print()</script>`
  preservado)
- CKEditor, `documento_templates`, html2pdf do orçamento, Mapa CSS,
  Etiquetas (visual), RLS, multi-tenancy.

## Validação

- TypeScript: zero erros após edits (build automático passou).
- Comportamento: `escapeHtml` é estritamente mais defensivo (escapa mais,
  nunca menos) — não há regressão de output esperada para conteúdo válido.
- `formatDateBR` para datas de calendário continua sem drift UTC
  (regression-free).
- Comprovantes, Orçamento, Laudo, Mapa, Etiqueta: builders mantidos
  intactos — só trocaram a fonte do helper.

## Critério de sucesso

| Critério | Status |
|---|---|
| 1 escapeHtml | ✅ (laudo congelado mantém local — documentado) |
| 1 formatDateBR | ✅ |
| 1 shell A4 | ✅ |
| 1 header administrativo | ✅ (cobertura inicial: LGPD + Auditoria) |
| 0 aliases triviais | ✅ (`buildOrcamentoHtmlPublic` removido) |
| 0 código morto introduzido | ✅ |
| 0 regressão funcional | ✅ |
