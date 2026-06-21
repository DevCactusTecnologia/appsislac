# Duplicação — Documentos do SISLAC

Classificação: **Baixa** = cosmética/aceitável · **Média** = manutenção dói ·
**Alta** = mudar branding exige editar N arquivos.

## 1. HTML repetido

| Padrão | Locais | Severidade |
|--------|--------|------------|
| Boilerplate `<!DOCTYPE html><html lang="pt-BR"><head>...<style>@page{}</style></head><body>...<script>window.print()</script>` | `lgpdReport.ts`, `auditLogsStore.ts`, `ConvenioExamesPanel.tsx`, `TabelasPrecoTab.tsx`, `ExamesTab.tsx`, `Producao.tsx`, `Financeiro` builders, `DetailEntryDialog.tsx`, `dossieRastreabilidade.ts` | **Alta** |
| Cabeçalho com nome do laboratório + data de emissão | os mesmos 9 arquivos acima | **Alta** |
| Tabela A4 paisagem com `<thead>` repetido por página | LGPD, auditoria, tabelas de preço, catálogo, produção | **Média** |

## 2. CSS repetido

| Padrão | Locais | Severidade |
|--------|--------|------------|
| `@page { size: A4 ...; margin: ... }` + `body { font-family: Inter, system-ui ... }` + `print-color-adjust: exact` | 9+ builders inline | **Alta** |
| `table { border-collapse:collapse } th { background:#f1f5f9 } td { border:1px solid #e2e8f0 }` | LGPD, auditoria, tabelas, produção | **Média** |
| `font-family:'Inter','Segoe UI',system-ui,sans-serif;color:#1a1a2e;` | comprovantes, documentoRenderer | **Baixa** (já compartilhado, só não está numa constante) |

## 3. Cabeçalhos repetidos

- **1 cabeçalho canônico** (`buildEmitenteHeader`) é usado **somente** por
  comprovantes/orçamento e templates configuráveis.
- **10 cabeçalhos inline distintos** (Mapa, Etiqueta, Livro Caixa,
  Demonstrativo, LGPD, Auditoria, Tabelas Preço, Catálogo, Produção,
  Detalhe de Entrada, Dossiê).
- Todos exibem variações de: nome do lab + data + título do relatório.
  Nenhum reaproveita logo/CNPJ/endereço de `getLabConfig()` consistentemente.

**Severidade: Alta.** Trocar o logo institucional hoje só impacta comprovantes
e laudo (via template). Os demais 10 documentos continuariam com
`<h1>Auditoria técnica</h1>` ou similar, sem branding.

## 4. Rodapés repetidos

- **1 rodapé canônico** (`buildAssinaturaRodape`/`buildDocumentoFooterHtml`)
  com QR + código de verificação — usado só por comprovantes.
- Demais documentos: rodapé ad-hoc (LGPD: linha "Documento gerado…", auditoria:
  nenhum, mapa: assinatura analista, etiqueta: nenhum).

**Severidade: Média.** Faz sentido: LGPD, auditoria e mapa não precisam de QR
de quitação. Mas a forma de inserir "data de emissão + paginação" está
copiada à mão em cada um.

## 5. Helpers equivalentes

| Helper | Cópias |
|--------|--------|
| `escapeHtml` | 7 implementações (canônica em `@/lib/escapeHtml.ts` + 6 reimplementações locais idênticas ou quase) |
| Função `fmtData`/`formatDateBR` | 4 versões locais (`mapaPrint`, `etiquetaAmostra`, `comprovantesHtml`, `dossieRastreabilidade`) |
| Wrappers `printHtmlInHiddenFrame({ html, frameId })` com try/catch | 12 callers, todos copiando o mesmo bloco de criação de filename |

**Severidade: Média.**

## 6. Builders equivalentes

- `buildOrcamentoHtmlPublic` é alias literal de `buildOrcamentoHtml`
  (`return buildOrcamentoHtml(o);`). **Severidade: Baixa.**
- `buildLivroCaixaHtml` e `buildDetalhadoHtml` compartilham ~70% do CSS e do
  layout de cabeçalho/rodapé. **Severidade: Média.**
- Tabelas de preço (Convênio × CBHPM/TUSS/Própria × Catálogo Exames):
  4 builders quase idênticos. **Severidade: Alta.**

## 7. Estruturas repetidas

- `<script>window.print()</script>` inline está duplicado em 4 builders
  (LGPD, auditoria, ConvenioExamesPanel, ResultadoDetalhe). O
  `printHtmlInHiddenFrame` já dispara o print — esse script é redundante,
  mas inofensivo.

## Resumo

| Categoria | Severidade |
|-----------|------------|
| HTML boilerplate | **Alta** |
| CSS de impressão (`@page` + tabela) | **Alta** |
| Cabeçalhos institucionais | **Alta** |
| Tabelas de preço (4 builders quase iguais) | **Alta** |
| Helpers `escapeHtml` / `fmtData` | Média |
| Pares de builders financeiros | Média |
| Aliases triviais (`*Public`) | Baixa |
| `<script>print()</script>` redundante | Baixa |
